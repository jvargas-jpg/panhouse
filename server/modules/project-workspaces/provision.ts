import { eq } from 'drizzle-orm';
import { db,pool } from '../../db/client.js';
import { notificaciones,projectWorkspaceRequests,projectDriveWorkspaces,proyectos } from '../../db/schema/index.js';
import { obtenerEspecialistaActual } from '../../helpers/carga.js';
import { registrarEvento } from '../../helpers/auditLog.js';
import { projectWorkspaceService,workspaceAccess } from './service.js';
import { emptyWorkspace,workspaceSummaries,workspaceErrorMessage,specialistCanRetry } from './queries.js';
import { WorkspaceError } from './errors.js';
import { safeDriveError } from '../integrations/google-drive/errors.js';
import { dispatchProjectWorkspace } from './dispatch.js';
import type { ActorFicha } from '../../helpers/intakeRrpp.js';

export async function retryProjectWorkspace(projectId:string,actor:ActorFicha){
  await db.transaction(async tx=>{
    await tx.select({id:proyectos.id}).from(proyectos).where(eq(proyectos.id,projectId)).for('update');
    const project=await workspaceAccess(projectId,actor,true,tx);
    if(!await obtenerEspecialistaActual(projectId,project.especialistaId,tx))throw new WorkspaceError('SPECIALIST_REQUIRED');
    const current=(await workspaceSummaries([projectId],tx)).get(projectId)??emptyWorkspace();
    if(current.status==='READY'&&!current.contextChanged)return;
    if(['PENDING','PROVISIONING'].includes(current.status))return;
    if(actor.rol==='especialista'&&!current.legacy&&!current.canRetry)throw new WorkspaceError('ADMIN_RECOVERY_REQUIRED',403);
    await tx.insert(projectWorkspaceRequests).values({projectId,requestedByUserId:actor.id,source:'RECOVERY'})
      .onConflictDoUpdate({target:projectWorkspaceRequests.projectId,set:{status:'PENDING',lastErrorCode:null,updatedAt:new Date()}});
    await registrarEvento(tx,{actorId:actor.id,accion:'PROJECT_WORKSPACE_RECUPERACION_SOLICITADA',entityType:'proyecto',entityId:projectId,proyectoId:projectId});
  });
  dispatchProjectWorkspace(projectId);
  return (await workspaceSummaries([projectId])).get(projectId)??emptyWorkspace();
}

/** BullMQ processor. Session lock also protects against duplicate/stalled deliveries. */
export async function provisionProjectWorkspace(projectId:string,options:{retryTransient?:boolean}={}){
  const lease=await pool.connect();let acquired=false;
  try{
    const lock=await lease.query<{acquired:boolean}>('select pg_try_advisory_lock(hashtextextended($1,0)) as acquired',[`workspace:${projectId}`]);
    acquired=!!lock.rows[0]?.acquired;if(!acquired)throw new WorkspaceError('BUSY');
    const [request]=await db.select().from(projectWorkspaceRequests).where(eq(projectWorkspaceRequests.projectId,projectId));
    if(!request)return; // Never sweep legacy projects into Drive.
    const [existing]=await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId,projectId));
    if(existing?.status==='READY'){
      await db.update(projectWorkspaceRequests).set({status:'READY',lastErrorCode:null,updatedAt:new Date()}).where(eq(projectWorkspaceRequests.projectId,projectId));
      return;
    }
    await db.update(projectWorkspaceRequests).set({status:'PROVISIONING',lastErrorCode:null,updatedAt:new Date()}).where(eq(projectWorkspaceRequests.projectId,projectId));
    try{
      const [project]=await db.select().from(proyectos).where(eq(proyectos.id,projectId));
      const specialist=project&&await obtenerEspecialistaActual(projectId,project.especialistaId);
      if(!specialist)throw new WorkspaceError('SPECIALIST_REQUIRED');
      await projectWorkspaceService.create(projectId,{id:specialist,rol:'especialista'},true);
      await db.update(projectWorkspaceRequests).set({status:'READY',lastErrorCode:null,updatedAt:new Date()}).where(eq(projectWorkspaceRequests.projectId,projectId));
    }catch(error){
      const code=error instanceof WorkspaceError?error.code:safeDriveError(error).code;
      const retrying=!!options.retryTransient&&specialistCanRetry(code);
      await db.transaction(async tx=>{
        await tx.update(projectWorkspaceRequests).set({status:retrying?'PENDING':'ERROR',lastErrorCode:code,updatedAt:new Date()}).where(eq(projectWorkspaceRequests.projectId,projectId));
        if(!retrying&&request.status!=='ERROR'){
          await registrarEvento(tx,{actorId:null,accion:'PROJECT_WORKSPACE_ATENCION_REQUERIDA',entityType:'proyecto',entityId:projectId,proyectoId:projectId,detalles:{code}});
          const [project]=await tx.select().from(proyectos).where(eq(proyectos.id,projectId));
          const specialist=project&&await obtenerEspecialistaActual(projectId,project.especialistaId,tx);
          const recoverable=specialistCanRetry(code);
          await tx.insert(notificaciones).values({proyectoId:projectId,rolDestino:recoverable?'especialista':code==='CRUDO_SUBTYPE_REQUIRED'?'jefe_area':'direccion',
            usuarioDestinoId:recoverable?specialist??null:null,mensaje:workspaceErrorMessage(code)??'El espacio documental requiere revisión.'});
        }
      });
      throw new WorkspaceError(code,503);
    }
  }finally{
    let destroy=false;
    try{if(acquired)await lease.query('select pg_advisory_unlock(hashtextextended($1,0))',[`workspace:${projectId}`]);}
    catch{destroy=true;}
    finally{lease.release(destroy);}
  }
}

import { randomBytes,randomUUID } from 'node:crypto';
import { afterAll,afterEach,beforeAll,beforeEach,describe,expect,it,vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../server/app.js';
import { db,pool } from '../server/db/client.js';
import { env } from '../server/config/env.js';
import { auditLogs,externalIntegrations,fichasTrazabilidad,preparacionesProyecto,projectDriveFolders,projectDriveWorkspaces,proyectos,servicios,users,workItems,projectAssignments } from '../server/db/schema/index.js';
import { createSession } from '../server/helpers/session.js';
import { encryptGoogleSecret } from '../server/modules/integrations/google-drive/encryption.js';
import { GoogleDriveOAuth } from '../server/modules/integrations/google-drive/oauth.js';
import { DriveIntegrationError } from '../server/modules/integrations/google-drive/errors.js';
import { FOLDER_MIME } from '../server/modules/integrations/google-drive/adapter.js';
import type { ProjectDriveStorageProvider,StorageItem } from '../server/modules/integrations/google-drive/provider.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearProyectoDePrueba } from './helpers/fixtures.js';
import { obtenerColaTrabajoEspecialista } from '../server/helpers/especialistaMiTrabajo.js';
import { historialFicha } from '../server/helpers/fichaViva.js';
import { eliminarProyecto } from '../server/helpers/proyectos.js';

describe('Project workspaces · Fastify/DB reales y Google mockeado',()=>{
  const app=buildApp(),original={...env};let specialist:string,other:string,admin:string,manager:string,cookie:string,otherCookie:string,adminCookie:string,managerCookie:string;
  const items=new Map<string,StorageItem>();let sequence=0,failKey:string|null=null,lostResponse=false,metadataUnavailable:string|null=null;
  const storage:ProjectDriveStorageProvider={
    allocateFolderIds:vi.fn(async count=>Array.from({length:count},()=>`unit-reserved-${++sequence}`)),
    validateConnection:vi.fn(async()=>({accountEmail:'unit@example.test',accountId:'unit-account'})),
    createFolder:vi.fn(async input=>{
      if(input.appProperties?.panhouseFolderKey===failKey&&!lostResponse){failKey=null;throw new DriveIntegrationError('GOOGLE_UNAVAILABLE');}
      const id=input.providerFileId!;
      if(items.has(id))throw new Error('Duplicate create');
      const f:StorageItem={providerFileId:id,name:input.name,mimeType:FOLDER_MIME,parents:input.parentFolderId?[input.parentFolderId]:[],appProperties:input.appProperties??{},webViewLink:'https://drive.google.com/drive/folders/'+id};items.set(id,f);
      if(input.appProperties?.panhouseFolderKey===failKey&&lostResponse){failKey=null;metadataUnavailable=id;throw new DriveIntegrationError('GOOGLE_UNAVAILABLE');}
      return f;
    }),
    getMetadata:vi.fn(async id=>{if(metadataUnavailable===id){metadataUnavailable=null;throw new DriveIntegrationError('GOOGLE_UNAVAILABLE');}const f=items.get(id);if(!f)throw new DriveIntegrationError('NOT_FOUND',404);return f;}),
    listFolders:vi.fn(async input=>[...items.values()].filter(i=>input.parentFolderId?i.parents.includes(input.parentFolderId):true)),
    deleteFileOrFolder:vi.fn(async()=>{}),shareFolder:vi.fn(async(_id,email)=>({permissionId:'unit-permission',email,role:'writer'})),listFolderPermissions:vi.fn(async()=>[]),
  };
  const api=(method:'GET'|'POST',path:string,auth=cookie,body:unknown={})=>app.inject({method,url:'/api'+path,headers:{cookie:auth},...(method==='POST'?{payload:body as Record<string,unknown>}:{})});
  const make=async(code='EF',subtype:'Capítulo'|'Tripa'|null=null)=>{
    const p=await crearProyectoDePrueba({especialistaId:specialist,jefeAreaId:manager});const [s]=await db.select().from(servicios).where(eq(servicios.codigo,code));
    const serviceId=s?.id??(await db.insert(servicios).values({codigo:code,nombre:code,plazoDias:150,pesoComplejidad:2}).returning())[0]!.id;
    await db.update(proyectos).set({servicioId:serviceId,notificadoJefatura:true}).where(eq(proyectos.id,p.id));
    await db.insert(fichasTrazabilidad).values({proyectoId:p.id,ingresoServicioSubtipoCrudo:subtype});return p;
  };
  const create=(id:string,auth=cookie)=>api('POST','/proyectos/'+id+'/workspace',auth);
  const workspace=async(id:string)=>(await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId,id)))[0]!;
  const queue=()=>obtenerColaTrabajoEspecialista(specialist,{tab:'pendientes',search:'',page:1,pageSize:50});
  beforeAll(()=>app.ready());afterAll(()=>app.close());afterEach(()=>{vi.restoreAllMocks();Object.assign(env,original);});
  beforeEach(async()=>{
    await limpiarBaseDeDatos();items.clear();sequence=0;failKey=null;lostResponse=false;metadataUnavailable=null;vi.clearAllMocks();
    Object.assign(env,{GOOGLE_CLIENT_ID:'unit-client',GOOGLE_CLIENT_SECRET:'unit-secret',GOOGLE_TOKEN_ENCRYPTION_KEY:randomBytes(32).toString('base64')});
    async function user(rol:typeof users.$inferInsert.rol){const [u]=await db.insert(users).values({rol,nombre:'Workspace '+rol,email:randomUUID()+'@test.local',passwordHash:'session-only'}).returning();return u!.id;}
    specialist=await user('especialista');other=await user('especialista');admin=await user('direccion');manager=await user('jefe_area');
    cookie='panhouse_sid='+await createSession(specialist);otherCookie='panhouse_sid='+await createSession(other);adminCookie='panhouse_sid='+await createSession(admin);managerCookie='panhouse_sid='+await createSession(manager);
    const [integration]=await db.insert(externalIntegrations).values({provider:'google_drive',status:'connected',scope:['https://www.googleapis.com/auth/drive.file'],projectsRootFolderId:'unit-dev-root',projectsRootFolderUrl:'https://drive.google.com/drive/folders/unit-dev-root',projectsRootReady:true,
      encryptedRefreshToken:encryptGoogleSecret('unit-refresh',Buffer.from(env.GOOGLE_TOKEN_ENCRYPTION_KEY!,'base64'),'refresh-token')}).returning();
    items.set('unit-dev-root',{providerFileId:'unit-dev-root',name:'PANHOUSE - PROYECTOS EDITORIALES - DEV',mimeType:FOLDER_MIME,parents:[],appProperties:{panhousePurpose:'project_workspace_dev_root',panhouseContext:integration!.storageContextId},webViewLink:'https://drive.google.com/drive/folders/unit-dev-root'});
    vi.spyOn(GoogleDriveOAuth.prototype,'workspaceStorage').mockReturnValue(storage);
  });
  it.each([['EF',null,28],['CR','Capítulo',28],['CR','Tripa',28],['SE',null,17]] as const)('%s/%s crea template completo bajo DEV y persiste cada key',(code,subtype,count)=>{return (async()=>{
    const p=await make(code,subtype),r=await create(p.id);expect(r.statusCode).toBe(200);expect(r.json()).toMatchObject({status:'READY',folderCount:count,expectedFolderCount:count,sharingStatus:'PENDING_VALIDATION'});
    const w=await workspace(p.id),folders=await db.select().from(projectDriveFolders).where(eq(projectDriveFolders.workspaceId,w.id));expect(folders).toHaveLength(count);expect(folders.every(f=>f.status==='READY')).toBe(true);
    expect(items.get(w.rootFolderId!)?.parents).toEqual(['unit-dev-root']);expect(storage.shareFolder).not.toHaveBeenCalled();expect(storage.deleteFileOrFolder).not.toHaveBeenCalled();
    expect(JSON.stringify(r.json())).not.toMatch(/unit-refresh|unit-secret|encryptedRefresh/);
  })();});
  it('GET ausente es NOT_CONFIGURED y nunca llama Google',async()=>{const p=await make();expect((await api('GET','/proyectos/'+p.id+'/workspace')).json()).toMatchObject({status:'NOT_CONFIGURED'});expect(storage.getMetadata).not.toHaveBeenCalled();});
  it('RBAC rechaza otra persona, Jefatura en escritura y sesión ausente',async()=>{
    const p=await make();expect((await create(p.id,otherCookie)).statusCode).toBe(403);expect((await create(p.id,managerCookie)).statusCode).toBe(403);expect((await create(p.id,'')).statusCode).toBe(401);
    expect((await api('GET','/proyectos/'+p.id+'/workspace',otherCookie)).statusCode).toBe(403);expect(storage.createFolder).not.toHaveBeenCalled();
  });
  it('Dirección puede recuperar; Jefatura solo lee',async()=>{const p=await make();expect((await create(p.id,adminCookie)).statusCode).toBe(200);expect((await api('GET','/proyectos/'+p.id+'/workspace/folders',managerCookie)).json().folders).toHaveLength(28);});
  it('rechaza IDs/nombres/cuenta arbitrarios del frontend y origen externo',async()=>{
    const p=await make();expect((await api('POST','/proyectos/'+p.id+'/workspace',cookie,{parentFolderId:'evil',name:'evil'})).statusCode).toBe(400);
    expect((await app.inject({method:'POST',url:'/api/proyectos/'+p.id+'/workspace',headers:{cookie,origin:'https://evil.test'},payload:{}})).statusCode).toBe(403);
    expect(storage.createFolder).not.toHaveBeenCalled();
  });
  it('Crudo sin subtipo bloquea y audita inconsistencia sin crear nada',async()=>{
    const p=await make('CR');const r=await create(p.id);expect(r.statusCode).toBe(409);expect(r.json().error).toContain('falta definir el subtipo de Crudo');
    expect(storage.createFolder).not.toHaveBeenCalled();expect(await db.select().from(projectDriveWorkspaces)).toHaveLength(0);
    expect((await db.select().from(auditLogs)).some(e=>e.accion==='PROJECT_WORKSPACE_INCONSISTENCIA')).toBe(true);
  });
  it('integración desconectada y raíz no configurada no crean en Mi unidad',async()=>{
    const p=await make();await db.update(externalIntegrations).set({status:'disconnected'});expect((await create(p.id)).json().error).toContain('Google Drive no está disponible');
    await db.update(externalIntegrations).set({status:'connected',projectsRootReady:false,projectsRootFolderId:null});expect((await create(p.id)).json().code).toBe('ROOT_NOT_CONFIGURED');expect(storage.createFolder).not.toHaveBeenCalled();
  });
  it('idempotencia repetida no llama Google ni duplica workspace/carpetas',async()=>{
    const p=await make();await create(p.id);const calls=vi.mocked(storage.createFolder).mock.calls.length;const r=await create(p.id);expect(r.json().status).toBe('READY');
    expect(storage.createFolder).toHaveBeenCalledTimes(calls);expect(await db.select().from(projectDriveWorkspaces)).toHaveLength(1);expect(items.size).toBe(29);
    expect((await db.select().from(auditLogs)).filter(e=>e.accion==='PROJECT_WORKSPACE_CONFIGURADO')).toHaveLength(1);
  });
  it('doble click concurrente genera una sola raíz',async()=>{
    const p=await make(),responses=await Promise.all([create(p.id),create(p.id)]);expect(responses.some(r=>r.statusCode===200)).toBe(true);expect(responses.every(r=>[200,409].includes(r.statusCode))).toBe(true);
    expect(await db.select().from(projectDriveWorkspaces)).toHaveLength(1);expect(items.size).toBe(29);
  });
  it('fallo parcial queda ERROR; retry reutiliza IDs y completa solo faltantes',async()=>{
    const p=await make();failKey='DESIGN';expect((await create(p.id)).statusCode).toBe(503);const partial=await workspace(p.id);expect(partial.status).toBe('ERROR');
    const before=[...items.keys()];expect(before.length).toBeGreaterThan(1);
    const r=await api('POST','/proyectos/'+p.id+'/workspace/retry');expect(r.json().status).toBe('READY');expect((await workspace(p.id)).rootFolderId).toBe(partial.rootFolderId);expect(items.size).toBe(29);
    for(const id of before.filter(id=>id!=='unit-dev-root'))expect(vi.mocked(storage.createFolder).mock.calls.filter(([input])=>input.providerFileId===id)).toHaveLength(1);
    expect((await db.select().from(auditLogs)).filter(e=>e.accion==='PROJECT_WORKSPACE_REINTENTO_EXITOSO')).toHaveLength(1);
  });
  it('create exitoso con respuesta perdida se recupera por ID reservado, sin buscar nombre',async()=>{
    const p=await make();failKey='ROOT';lostResponse=true;expect((await create(p.id)).statusCode).toBe(503);
    const [planned]=await db.select().from(projectDriveFolders).where(eq(projectDriveFolders.key,'ROOT'));expect(planned!.status).toBe('PLANNED');expect(items.has(planned!.driveFolderId)).toBe(true);
    expect((await create(p.id)).json().status).toBe('READY');expect(vi.mocked(storage.createFolder).mock.calls.filter(([input])=>input.providerFileId===planned!.driveFolderId)).toHaveLength(1);expect(storage.listFolders).not.toHaveBeenCalled();
  });
  it('no reescribe el template en un retry si cambian datos del proyecto',async()=>{
    const p=await make();failKey='DESIGN';await create(p.id);const old=await workspace(p.id);await db.update(fichasTrazabilidad).set({condicionesEspeciales:['Ilustraciones']});
    await create(p.id);expect((await workspace(p.id)).plan).toEqual(old.plan);expect(items.size).toBe(29);
  });
  it('reasignación conserva workspace; nuevo Especialista ve el mismo y anterior pierde acceso',async()=>{
    const p=await make();await create(p.id);const old=await workspace(p.id);await db.update(proyectos).set({especialistaId:other}).where(eq(proyectos.id,p.id));
    expect((await create(p.id)).statusCode).toBe(403);expect((await create(p.id,otherCookie)).json().id).toBe(old.id);expect(items.size).toBe(29);
  });
  it('el historial de asignación vigente prevalece sobre FK legacy',async()=>{
    const p=await make();await db.insert(projectAssignments).values({proyectoId:p.id,tipo:'especialista',usuarioId:other,asignadoPorId:manager});
    expect((await create(p.id)).statusCode).toBe(403);expect((await create(p.id,otherCookie)).statusCode).toBe(200);
  });
  it('cambiar cuenta/contexto nunca crea otra raíz ni reasocia carpetas silenciosamente',async()=>{
    const p=await make();await create(p.id);const w=await workspace(p.id);await db.update(externalIntegrations).set({storageContextId:randomUUID()});
    expect((await api('GET','/proyectos/'+p.id+'/workspace')).json().contextChanged).toBe(true);expect((await create(p.id)).json().code).toBe('CONTEXT_CHANGED');expect((await workspace(p.id)).rootFolderId).toBe(w.rootFolderId);expect(items.size).toBe(29);
  });
  it('READY completa subacción, Mi trabajo y Preparación total si el resto ya existe',async()=>{
    const p=await make(),now=new Date();await db.insert(preparacionesProyecto).values({proyectoId:p.id,recibidoEn:now,expedienteRevisadoEn:now,primerContactoEn:now,reunionOperativaFecha:now,reunionOperativaRealizada:true,grabacionUrl:'https://example.test/a',transcripcionUrl:'https://example.test/b',minutaUrl:'https://example.test/c',cronogramaUrl:'https://example.test/d'});
    expect((await queue()).items.some(i=>i.proyectoId===p.id&&i.actionType==='preparacion-drive')).toBe(true);
    await create(p.id);expect((await queue()).items.some(i=>i.proyectoId===p.id&&i.proceso==='preparacion_inicial')).toBe(false);
    const [wi]=await db.select().from(workItems).where(eq(workItems.tipo,'preparacion_inicial'));expect(wi!.estado).toBe('completado');
    const cc=await api('GET','/proyectos/'+p.id+'/command-center');expect(cc.json().preparacion).toMatchObject({estado:'Completo',driveEstado:'configurado'});
    expect((await historialFicha(p.id)).items.some(i=>i.label.includes('espacio documental'))).toBe(true);
  });
  it('crear Drive solo no finge reunión ni documentos completos',async()=>{
    const p=await make();await create(p.id);const cc=(await api('GET','/proyectos/'+p.id+'/command-center')).json();expect(cc.preparacion.estado).toBe('En curso');
    expect((await queue()).items.some(i=>i.actionType==='preparacion-drive')).toBe(false);expect((await queue()).items.some(i=>i.actionType==='preparacion-contacto')).toBe(true);
  });
  it('no elimina en cascada la trazabilidad de un proyecto con workspace',async()=>{
    const p=await make();await create(p.id);await expect(eliminarProyecto(p.id)).rejects.toMatchObject({statusCode:409});
    expect(await workspace(p.id)).toBeDefined();expect(storage.deleteFileOrFolder).not.toHaveBeenCalled();
  });
  it('Dirección configura raíz DEV una vez; Especialista no puede hacerlo',async()=>{
    await db.update(externalIntegrations).set({projectsRootFolderId:null,projectsRootReady:false,projectsRootFolderUrl:null});
    expect((await api('POST','/integrations/google-drive/projects-root')).statusCode).toBe(403);
    const first=await api('POST','/integrations/google-drive/projects-root',adminCookie),second=await api('POST','/integrations/google-drive/projects-root',adminCookie);
    expect(first.json().folderId).toBe(second.json().folderId);expect(first.json().name).toBe('PANHOUSE - PROYECTOS EDITORIALES - DEV');expect(storage.createFolder).toHaveBeenCalledTimes(1);
  });
});

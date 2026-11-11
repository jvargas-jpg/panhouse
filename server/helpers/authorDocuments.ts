import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { approvalArtifacts, approvalRequests, authorDocuments, projectDriveWorkspaces, proyectos } from '../db/schema/index.js';
import { withCorporateDrive } from '../modules/integrations/google-drive/corporate.js';
import type { AuthenticatedUser } from './session.js';
import { authorScope, cancelApprovalInTransaction, ensure, portalAudit, portalProject } from './authorPortal.js';

export async function shareAuthorDocument(projectId:string,input:{authorId:string;driveFileId:string;title:string;version:string;category:string},actor:AuthenticatedUser){
  ensure(['especialista','jefe_area'].includes(actor.rol),'Acceso no autorizado',403);
  await portalProject(projectId,actor);
  const revision=await withCorporateDrive(async({storage})=>{
    const [workspace]=await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId,projectId));
    ensure(workspace?.status==='READY'&&workspace.rootFolderId,'El espacio Drive del proyecto no está disponible');
    const file=await storage.getMetadata(input.driveFileId);ensure(!file.trashed,'Archivo no disponible',400);
    ensure(['application/pdf','image/png','image/jpeg'].includes(file.mimeType),'Comparte un PDF o imagen para conservar una revisión exacta',400);
    ensure(!file.size||file.size<=50*1024*1024,'El archivo supera el límite de 50 MB',400);
    let parents=file.parents,inside=false;const visited=new Set<string>();
    for(let depth=0;depth<30&&parents.length;depth++){
      if(parents.includes(workspace.rootFolderId)){inside=true;break;}
      const next:string[]=[];for(const parent of parents){if(visited.has(parent))continue;visited.add(parent);next.push(...(await storage.getMetadata(parent)).parents);}parents=next;
    }
    ensure(inside,'El archivo no pertenece al proyecto',400);ensure(storage.pinAuthorRevision,'El proveedor no permite revisiones exactas');
    return storage.pinAuthorRevision(input.driveFileId);
  });
  return db.transaction(async tx=>{
    await portalProject(projectId,actor,tx,true);
    const [owner]=await tx.select({id:proyectos.id}).from(proyectos).where(and(eq(proyectos.id,projectId),authorScope(input.authorId)));ensure(owner,'Autor ajeno al proyecto',400);
    const [d]=await tx.insert(authorDocuments).values({...input,projectId,sharedBy:actor.id,...revision}).returning();
    await portalAudit(tx,actor.id,projectId,'DOCUMENTO_COMPARTIDO_AUTOR',d!.id,{revisionId:revision.revisionId});return {id:d!.id};
  });
}
export async function authorDocument(id:string,actor:AuthenticatedUser){
  ensure(actor.rol==='autor'&&actor.autorId,'Acceso no autorizado',403);
  const [d]=await db.select({document:authorDocuments}).from(authorDocuments).innerJoin(proyectos,eq(proyectos.id,authorDocuments.projectId)).where(and(eq(authorDocuments.id,id),eq(authorDocuments.authorId,actor.autorId),authorScope(actor.autorId),isNull(authorDocuments.revokedAt)));
  ensure(d,'Documento no encontrado',404);return d.document;
}
export async function revokeAuthorDocument(id:string,actor:AuthenticatedUser){
  return db.transaction(async tx=>{const [d]=await tx.select().from(authorDocuments).where(eq(authorDocuments.id,id));ensure(d,'Documento no encontrado',404);
    await portalProject(d.projectId,actor,tx,true);ensure(actor.rol!=='autor','Acceso no autorizado',403);
    if(d.revokedAt)return {ok:true};
    await tx.update(authorDocuments).set({revokedAt:new Date()}).where(eq(authorDocuments.id,id));
    const pending=await tx.select({request:approvalRequests}).from(approvalArtifacts).innerJoin(approvalRequests,eq(approvalRequests.id,approvalArtifacts.approvalId)).where(and(eq(approvalArtifacts.documentId,id),eq(approvalRequests.status,'pending')));
    for(const {request} of pending)await cancelApprovalInTransaction(tx,request,'El equipo retiró un documento de esta solicitud. Te avisaremos cuando haya una nueva revisión.',actor);
    await portalAudit(tx,actor.id,d.projectId,'DOCUMENTO_RETIRADO_AUTOR',id);return {ok:true};});
}

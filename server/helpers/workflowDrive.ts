import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { correcciones, editorialDeliveries, projectAssignments, projectDriveFolders, projectDriveWorkspaces, proyectos, users, workItems } from '../db/schema/index.js';
import { withCorporateDrive, type CorporateDriveOperation } from '../modules/integrations/google-drive/corporate.js';
import type { StorageItem } from '../modules/integrations/google-drive/provider.js';
import { editorialInterventions } from './editorialChief.js';
import { registrarEntregaEditorial } from './editorialDeliveries.js';
import { registrarEntregaCorreccion } from './correcciones.js';
import { DRIVE_DELIVERY_SCOPE } from '../modules/integrations/google-drive/config.js';

// No file-name matching. The folder belongs to a persisted project workspace;
// private app metadata binds a work/cycle, or a unique waiting Editor + contributor.
const valid = (f: StorageItem, folder: string, after: Date) => !f.trashed && f.parents.includes(folder) && !!f.size && f.size <= 50*1024*1024 && !!f.modifiedAt && new Date(f.modifiedAt) >= after && !['application/vnd.google-apps.folder','application/vnd.google-apps.shortcut'].includes(f.mimeType);
export async function detectWorkflowDeliveries(operate: CorporateDriveOperation = withCorporateDrive) {
 let editorialReceived=0,correctionReceived=0;
 const pending = (await editorialInterventions()).filter(i=>i.workItemId && i.editorId && i.actionable && ['Pendiente','En edición','Requiere ajustes'].includes(i.state));
 const corrections=await db.select({c:correcciones,w:workItems,p:proyectos}).from(correcciones).innerJoin(workItems,eq(workItems.id,correcciones.workItemId)).innerJoin(proyectos,eq(proyectos.id,correcciones.proyectoId)).where(and(isNull(correcciones.fechaEntrega),inArray(workItems.estado,['pendiente','en_progreso'])));
 const ids=[...new Set([...pending.map(i=>i.projectId),...corrections.map(c=>c.p.id)])];
 for (const id of ids) {
  const [p]=await db.select().from(proyectos).where(eq(proyectos.id,id));
  if(!p || ['pausado','stand_by','culminado','retirado'].includes(p.estado))continue;
  const [ws]=await db.select().from(projectDriveWorkspaces).where(and(eq(projectDriveWorkspaces.projectId,id),eq(projectDriveWorkspaces.status,'READY')));if(!ws)continue;
  const folders=await db.select().from(projectDriveFolders).where(and(eq(projectDriveFolders.workspaceId,ws.id),eq(projectDriveFolders.status,'READY')));
  const captured: {file:StorageItem;workId:string;editorId:string}[]=[];
  const corrected: {id:string;word:StorageItem;report:StorageItem;assignedAt:Date}[]=[];
  await operate(async ({integration,storage})=>{
   if(ws.integrationId!==integration.id || ws.storageContextId!==integration.storageContextId || !integration.scope.includes(DRIVE_DELIVERY_SCOPE) || !storage.listFiles)return;
   const cache=new Map<string,StorageItem[]>();
   const files=async(folder:string)=>{if(cache.has(folder))return cache.get(folder)!;const all:StorageItem[]=[];let pageToken: string|undefined;do{const page=await storage.listFiles!({parentFolderId:folder,pageToken});all.push(...page.items);pageToken=page.nextPageToken??undefined;if(all.length>5000)throw new Error('Demasiados archivos en una carpeta de entregas');}while(pageToken);cache.set(folder,all);return all;};
   const history=await db.select().from(editorialDeliveries).where(eq(editorialDeliveries.projectId,id)).orderBy(desc(editorialDeliveries.submittedAt),desc(editorialDeliveries.id));
   const known=new Set(history.map(x=>x.driveFileId));
   const works=pending.filter(i=>i.projectId===id);
   for(const i of works) {
    const previous=history.find(d=>d.workItemId===i.workItemId);
    const [editor]=await db.select().from(users).where(eq(users.id,i.editorId!));
    const [assignment]=await db.select().from(projectAssignments).where(and(eq(projectAssignments.proyectoId,id),eq(projectAssignments.tipo,'editor'),isNull(projectAssignments.workItemId),isNull(projectAssignments.finalizadoEn)));
    if(!editor?.activo || assignment && assignment.usuarioId!==editor.id)continue;
    const keys=i.chapter ? i.interventionType==='feedback'?['EDITING_FEEDBACK_APPLIED']:['EDITING_OUTPUT'] : ['EDITING','FULL_MANUSCRIPT','FULL_MANUSCRIPT_FEEDBACK_APPLIED'];
    const candidates:StorageItem[]=[];
    for(const folder of folders.filter(f=>keys.includes(f.key)))for(const file of await files(folder.driveFolderId)) {
     if(!valid(file,folder.driveFolderId,assignment?.asignadoEn??new Date(0)) || previous && new Date(file.modifiedAt!)<=previous.submittedAt || known.has(file.providerFileId) || !['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','application/pdf','application/vnd.google-apps.document'].includes(file.mimeType))continue;
     const m=file.appProperties;
     const bound=m.panhouseProjectId===id && m.panhouseWorkItemId===i.workItemId && m.panhouseActorId===editor.id && (!m.panhouseAssignmentId || m.panhouseAssignmentId===assignment?.id) && (previous ? m.panhouseCycle===previous.id : !m.panhouseCycle || m.panhouseCycle==='initial') && m.panhouseDeliverable===(i.interventionType==='feedback'?'feedback_applied':'edited');
     const unambiguous=!m.panhouseWorkItemId && !m.panhouseProjectId && !m.panhouseActorId && works.length===1 && file.contributorEmails?.some(e=>e.toLowerCase()===editor.email.toLowerCase());
     if(bound||unambiguous)candidates.push(file);
    }
    if(candidates.length===1)captured.push({file:candidates[0]!,workId:i.workItemId!,editorId:editor.id});
   }
   for(const {c} of corrections.filter(c=>c.p.id===id && c.c.asignadoEn && (c.c.freelance || c.c.correctorNombre))) {
    const folder=folders.find(f=>f.key==='CORRECTION_OUTPUT');if(!folder)continue;
    const matches=(await files(folder.driveFolderId)).filter(f=>valid(f,folder.driveFolderId,c.asignadoEn!) && f.appProperties.panhouseProjectId===id && f.appProperties.panhouseWorkItemId===c.workItemId);
    const word=matches.filter(f=>f.appProperties.panhouseDeliverable==='correction_word' && ['application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(f.mimeType));
    const report=matches.filter(f=>f.appProperties.panhouseDeliverable==='technical_report' && ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(f.mimeType));
    if(word.length===1&&report.length===1&&word[0]!.providerFileId!==report[0]!.providerFileId)corrected.push({id:c.id,word:word[0]!,report:report[0]!,assignedAt:c.asignadoEn!});
   }
  });
  // The corporate Drive lease has ended; native commands acquire their own lease
  // and revalidate current assignment/project before committing a delivery.
  for(const c of captured) { await registrarEntregaEditorial(c.workId,`https://drive.google.com/file/d/${c.file.providerFileId}/view`,c.editorId,'Entrega correlacionada detectada en Drive',operate);editorialReceived++; }
  for(const c of corrected)await db.transaction(async tx=>{
   const [p]=await tx.select().from(proyectos).where(eq(proyectos.id,id)).for('update');
   const [current]=await tx.select().from(correcciones).where(eq(correcciones.id,c.id)).for('update');
   if(!p || ['pausado','stand_by','culminado','retirado'].includes(p.estado) || !current || current.fechaEntrega || current.asignadoEn?.getTime()!==c.assignedAt.getTime())return;
   await registrarEntregaCorreccion(c.id,{controlCambiosUrl:`https://drive.google.com/file/d/${c.word.providerFileId}/view`,informeTecnicoUrl:`https://drive.google.com/file/d/${c.report.providerFileId}/view`,motivo:'Word e informe técnico correlacionados en Drive'},null,tx);correctionReceived++;
  });
 }
 return {editorialReceived,correctionReceived};
}

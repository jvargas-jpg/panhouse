import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { approvalArtifacts, approvalRequests, authorDocuments, capitulos, editorialBlockers, editorialDeliveries, notificaciones, pausas, projectDriveFolders, projectDriveWorkspaces, proyectos, reunionesExtraccion, reunionExtraccionSolicitudes, servicios, users, workItems } from '../db/schema/index.js';
import { withCorporateDrive, type CorporateDriveOperation } from '../modules/integrations/google-drive/corporate.js';
import type { ProjectDriveStorageProvider } from '../modules/integrations/google-drive/provider.js';
import type { EditorialReviewFile, EditorialReviewGuide, EditorialReviewMetadata, EditorialReviewResponse, EditorialReviewVersion, SubmitEditorialReview } from '../../shared/editorialReview.js';
import { authorNotice, ensure, portalAudit, portalProject, decideApproval } from './authorPortal.js';
import type { AuthenticatedUser } from './session.js';
import type { Tx } from './tx.js';
import { diaCaracas } from './atencionEspecialista.js';
import { sincronizarCapituloEditorial } from './editorialInterventions.js';
import { crearWorkItemSiNoExiste } from './workItems.js';
import { calcularFechaPautadaFeedbackCapitulo, calcularFechaPautadaFeedbackTripa } from './edicionSla.js';

const fileSchema=z.object({name:z.string().trim().min(1).max(180),contentBase64:z.string().min(4).max(28_000_000)}).strict();
const titlesSchema=z.array(z.string().trim().min(2).max(200)).min(1).max(20).refine(t=>new Set(t.map(s=>s.toLocaleLowerCase())).size===t.length,'No repitas los títulos propuestos');
export const submitEditorialReviewSchema=z.object({kind:z.enum(['chapter','manuscript','titles']),chapterNumber:z.number().int().min(1).max(200).optional(),expectedVersion:z.number().int().min(0),requestKey:z.string().uuid(),file:fileSchema.optional(),proposedTitles:titlesSchema.optional(),chaptersConfirmed:z.boolean().optional()}).strict();
export const editorialDecisionSchema=z.object({decision:z.enum(['approved','changes_requested']),feedback:z.string().trim().max(20000).optional(),selectedTitle:z.string().trim().max(200).optional(),file:fileSchema.optional()}).strict();
type ReviewRow=typeof approvalRequests.$inferSelect;

async function editorProject(projectId:string,actor:AuthenticatedUser,client:typeof db|Tx=db,lock=false){
  ensure(actor.rol==='editor','Esta acción corresponde al Editor asignado',403);
  const query=client.select().from(proyectos).where(eq(proyectos.id,projectId));
  const [p]=await(lock?query.for('update'):query);
  ensure(p&&p.editorId===actor.id,'Proyecto no encontrado o asignado a otro Editor',404);
  return p;
}
async function projectBlocked(p:typeof proyectos.$inferSelect,client:typeof db|Tx){
  if(['retirado','culminado','stand_by','pausado'].includes(p.estado))return 'El proyecto está cerrado o en pausa.';
  const [pause]=await client.select({id:pausas.id}).from(pausas).where(and(eq(pausas.proyectoId,p.id),sql`${pausas.fechaInicio}<=now()`,sql`(${pausas.fechaFin} IS NULL OR ${pausas.fechaFin}>now())`));
  if(pause)return 'El proyecto está en pausa.';
  const [blocker]=await client.select({reason:editorialBlockers.reason}).from(editorialBlockers).innerJoin(workItems,eq(workItems.id,editorialBlockers.workItemId)).where(and(eq(workItems.proyectoId,p.id),isNull(editorialBlockers.resolvedAt)));
  return blocker?`Resuelve el bloqueo editorial: ${blocker.reason}`:null;
}
async function reviews(projectId:string,client:typeof db|Tx=db){
  return client.select().from(approvalRequests).where(and(eq(approvalRequests.projectId,projectId),sql`${approvalRequests.editorialReview} IS NOT NULL`)).orderBy(desc(approvalRequests.requestedAt),desc(approvalRequests.id));
}
function latest(rows:ReviewRow[],kind:EditorialReviewMetadata['kind'],number?:number){
  return rows.filter(r=>r.editorialReview?.kind===kind&&(kind!=='chapter'||r.editorialReview.chapterNumber===number)).sort((a,b)=>b.editorialReview!.version-a.editorialReview!.version)[0]??null;
}
async function chapterNumbers(projectId:string,client:typeof db|Tx){
  const chapters=await client.select({number:capitulos.numero}).from(capitulos).where(eq(capitulos.proyectoId,projectId));
  const sessions=await client.select({number:reunionesExtraccion.numero}).from(reunionesExtraccion).where(eq(reunionesExtraccion.proyectoId,projectId));
  return [...new Set([...chapters,...sessions].map(c=>c.number))].sort((a,b)=>a-b);
}
async function interviewsReady(p:typeof proyectos.$inferSelect,client:typeof db|Tx){
  const [service]=await client.select({code:servicios.codigo}).from(servicios).where(eq(servicios.id,p.servicioId));
  if(service?.code!=='EF')return true;
  const sessions=await client.select().from(reunionesExtraccion).where(eq(reunionesExtraccion.proyectoId,p.id));
  return sessions.length>0&&sessions.every(s=>s.realizada&&s.videoUrl&&s.notasGeminiUrl);
}
export async function getEditorialReviewGuide(projectId:string,actor:AuthenticatedUser):Promise<EditorialReviewGuide>{
  const p=await editorProject(projectId,actor),rows=await reviews(projectId);
  const files=await db.select({approvalId:approvalArtifacts.approvalId,name:authorDocuments.title,id:authorDocuments.id}).from(approvalArtifacts).innerJoin(authorDocuments,eq(authorDocuments.id,approvalArtifacts.documentId)).where(eq(authorDocuments.projectId,projectId));
  const snapshots=rows.map((r):EditorialReviewVersion=>{
    const file=files.find(f=>f.approvalId===r.id);
    return {id:r.id,status:r.status,metadata:r.editorialReview!,response:r.editorialResponse?{...r.editorialResponse,...(r.editorialResponse.feedbackFile?{feedbackFile:{...r.editorialResponse.feedbackFile,url:`/api/editores/proyectos/${projectId}/revisiones/${r.id}/feedback`}}:{})}:null,
      feedback:r.feedback,requestedAt:r.requestedAt.toISOString(),decidedAt:r.decidedAt?.toISOString()??null,file:file?{name:file.name,url:`/api/editores/proyectos/${projectId}/revisiones/${r.id}/archivo`}:null};
  });
  const snapshot=(r:ReviewRow|null)=>r?snapshots.find(s=>s.id===r.id)!:null;
  const numbers=await chapterNumbers(projectId,db);
  const chapters=numbers.map(number=>({number,latest:snapshot(latest(rows,'chapter',number)),history:snapshots.filter(r=>r.metadata.kind==='chapter'&&r.metadata.chapterNumber===number).sort((a,b)=>b.metadata.version-a.metadata.version)}));
  const manuscript=snapshot(latest(rows,'manuscript')),titles=snapshot(latest(rows,'titles'));
  const ready=await interviewsReady(p,db),allApproved=chapters.length>0&&chapters.every(c=>c.latest?.status==='approved');
  const [account]=await db.select({id:users.id}).from(users).where(and(eq(users.autorId,p.autorId),eq(users.rol,'autor'),eq(users.activo,true)));
  const [service]=await db.select({code:servicios.codigo}).from(servicios).where(eq(servicios.id,p.servicioId));
  const authors=await db.execute<{names:string}>(sql`SELECT string_agg(a.nombre, ', ' ORDER BY a.nombre) names FROM autores a WHERE a.id=${p.autorId} OR a.id IN (SELECT autor_id FROM proyectos_autores WHERE proyecto_id=${p.id})`);
  const sessions=await db.select().from(reunionesExtraccion).where(eq(reunionesExtraccion.proyectoId,p.id)).orderBy(reunionesExtraccion.numero);
  const changes=await db.select().from(reunionExtraccionSolicitudes).where(and(eq(reunionExtraccionSolicitudes.proyectoId,p.id),eq(reunionExtraccionSolicitudes.estado,'pendiente')));
  return {projectId,title:p.tituloDefinitivo??p.titulo??'Proyecto editorial',authors:authors.rows[0]?.names??p.codigo,serviceCode:service?.code??'',
    currentStep:!ready?'interviews':!allApproved?'chapters':manuscript?.status!=='approved'?'manuscript':titles?.status!=='approved'?'titles':'complete',
    blockedReason:await projectBlocked(p,db),authorHasAccount:!!account,chapters,manuscript,titles,history:snapshots,selectedTitle:titles?.response?.selectedTitle??null,
    extraction:service?.code==='EF'&&sessions.length?{sesiones:sessions.map(s=>{
      const c=changes.find(c=>c.reunionId===s.id);
      return {id:s.id,numero:s.numero,fechaHora:s.fechaHora?.toISOString()??null,duracionMinutos:s.duracionMinutos,realizada:s.realizada,meetUrl:s.meetUrl,videoUrl:s.videoUrl,notasGeminiUrl:s.notasGeminiUrl,
        solicitudCambio:c?.solicitadoPor==='autor'?{id:c.id,fechaHoraPropuesta:c.fechaHoraPropuesta.toISOString(),motivo:c.motivo}:null,
        solicitudCambioPropia:c?.solicitadoPor==='editor'?{id:c.id,fechaHoraPropuesta:c.fechaHoraPropuesta.toISOString()}:null};
    })}:undefined};
}

function decodeFile(file:EditorialReviewFile){
  const ext=file.name.split('.').pop()?.toLowerCase();
  const mimeType=ext?({pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'} as Record<string,string>)[ext]:undefined;
  ensure(mimeType&&!/[\x00-\x1f]/.test(file.name),'Selecciona un documento Word o PDF',400);
  const content=Buffer.from(file.contentBase64,'base64');
  ensure(content.length>0&&content.length<=20*1024*1024&&content.toString('base64')===file.contentBase64,'El documento debe pesar entre 1 byte y 20 MB',400);
  const valid=ext==='pdf'?content.subarray(0,5).toString()==='%PDF-':ext==='docx'?content[0]===0x50&&content[1]===0x4b:content.subarray(0,8).equals(Buffer.from('d0cf11e0a1b11ae1','hex'));
  ensure(valid,'El contenido del archivo no coincide con el formato Word o PDF',400);
  return {content,mimeType,ext:ext!};
}
async function reviewFolder(storage:ProjectDriveStorageProvider,editingId:string,key:string,name:string,number?:number){
  const ensureFolder=async(parent:string,folderKey:string,folderName:string)=>{
    const existing=(await storage.listFolders({parentFolderId:parent})).find(f=>!f.trashed&&f.appProperties.panhouseEditorialReview===folderKey);
    return existing??storage.createFolder({name:folderName,parentFolderId:parent,appProperties:{panhouseEditorialReview:folderKey}});
  };
  const root=await ensureFolder(editingId,key,name);
  return number===undefined?root:ensureFolder(root.providerFileId,`chapter_${number}`,`Capítulo ${number}`);
}
async function editingFolder(tx:Tx,p:typeof proyectos.$inferSelect,integrationId:string,contextId:string){
  const [workspace]=await tx.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId,p.id));
  ensure(workspace?.status==='READY'&&workspace.integrationId===integrationId&&workspace.storageContextId===contextId,'El espacio documental no está listo o cambió la conexión de Drive');
  const [folder]=await tx.select().from(projectDriveFolders).where(and(eq(projectDriveFolders.workspaceId,workspace.id),eq(projectDriveFolders.key,'EDITING'),eq(projectDriveFolders.status,'READY')));
  ensure(folder?.driveFolderId,'La carpeta de Edición no está disponible');return folder.driveFolderId;
}
async function manuscriptFolder(tx:Tx,projectId:string,storage:ProjectDriveStorageProvider,editingId:string,feedback=false){
  const [folder]=await tx.select({id:projectDriveFolders.driveFolderId}).from(projectDriveFolders).innerJoin(projectDriveWorkspaces,eq(projectDriveWorkspaces.id,projectDriveFolders.workspaceId)).where(and(eq(projectDriveWorkspaces.projectId,projectId),eq(projectDriveFolders.key,feedback?'FULL_MANUSCRIPT_FEEDBACK':'FULL_MANUSCRIPT'),eq(projectDriveFolders.status,'READY')));
  return folder?{providerFileId:folder.id}:reviewFolder(storage,editingId,feedback?'manuscript_feedback':'manuscript_drafts',feedback?'Tripa con feedback':'Tripa completa');
}
async function createReview(tx:Tx,p:typeof proyectos.$inferSelect,workItemId:string,originId:string,metadata:EditorialReviewMetadata,actorId:string,previousId?:string,documentId?:string){
  const label=metadata.kind==='chapter'?`Capítulo ${metadata.chapterNumber}`:metadata.kind==='manuscript'?'Tripa completa':'Títulos propuestos';
  const type=metadata.kind==='chapter'?'capitulo':metadata.kind==='manuscript'?'tripa_completa':'titulos_propuestos';
  const id=randomUUID(),today=diaCaracas(new Date());
  const due=metadata.kind==='chapter'?calcularFechaPautadaFeedbackCapitulo(today):metadata.kind==='manuscript'?calcularFechaPautadaFeedbackTripa(today):null;
  const [wait]=await tx.insert(workItems).values({proyectoId:p.id,tipo:'aprobacion_autor',businessKey:id,estado:'bloqueado',gateBloqueante:'ESPERANDO_AUTOR',observaciones:label}).returning();
  const [review]=await tx.insert(approvalRequests).values({id,projectId:p.id,authorId:p.autorId,type,title:`${label} · v${metadata.version}`,
    instructions:metadata.kind==='titles'?'Elige uno de los títulos propuestos o pulsa No aprobar para solicitar otras propuestas. Puedes añadir un comentario opcional.':'Revisa esta versión. Puedes aprobarla o subir el documento con tus comentarios para que el Editor prepare una nueva versión.',
    originId,originWorkItemId:workItemId,waitWorkItemId:wait!.id,requestedBy:actorId,previousId,dueAt:due?new Date(due+'T23:59:59-04:00'):null,editorialReview:metadata}).returning();
  if(documentId)await tx.insert(approvalArtifacts).values({approvalId:id,documentId});
  await tx.update(workItems).set({estado:'bloqueado',gateBloqueante:'ESPERANDO_AUTOR',fechaFinReal:null}).where(eq(workItems.id,workItemId));
  await authorNotice(tx,p.autorId,p.id,metadata.kind==='chapter'?`Tienes un capítulo que revisar: ${label} v${metadata.version}.`:metadata.kind==='titles'?'Tienes títulos propuestos para elegir.':`Tienes una nueva versión de la tripa completa para revisar: v${metadata.version}.`,`/autor/aprobaciones/${id}`,`approval:${id}`);
  await portalAudit(tx,actorId,p.id,'APROBACION_AUTOR_CREADA',id,{type,version:metadata.version,chapter:metadata.chapterNumber});
  return review!;
}
export async function submitEditorialReview(projectId:string,input:SubmitEditorialReview,actor:AuthenticatedUser,operate:CorporateDriveOperation=withCorporateDrive){
  input=submitEditorialReviewSchema.parse(input);
  await editorProject(projectId,actor);
  const decoded=input.kind==='titles'?null:decodeFile(input.file??{name:'',contentBase64:''});
  if(input.kind!=='chapter')titlesSchema.parse(input.proposedTitles);
  return operate(async({integration,storage})=>db.transaction(async tx=>{
    const p=await editorProject(projectId,actor,tx,true);
    const rows=await reviews(projectId,tx),repeated=rows.find(r=>r.editorialReview?.requestKey===input.requestKey);
    if(repeated){
      ensure(repeated.editorialReview?.kind===input.kind&&repeated.editorialReview.chapterNumber===input.chapterNumber,'Esta clave de envío ya pertenece a otra entrega');
      return {id:repeated.id,version:repeated.editorialReview!.version};
    }
    ensure(!await projectBlocked(p,tx),'El proyecto tiene un bloqueo o está en pausa');
    ensure(await interviewsReady(p,tx),'Completa las entrevistas, sus grabaciones y sus notas antes de subir capítulos');
    const current=latest(rows,input.kind,input.chapterNumber);
    ensure((current?.editorialReview?.version??0)===input.expectedVersion,'La revisión cambió. Actualiza la guía antes de enviar otra versión');
    ensure(!current||['changes_requested','cancelled'].includes(current.status),'Esta entrega ya está aprobada o está esperando al Autor');
    if(input.kind==='titles'){
      ensure(!input.file,'Las propuestas de títulos se escriben en la lista, sin adjuntar un archivo',400);
      if(current)ensure(input.proposedTitles?.some(t=>!current.editorialReview?.proposedTitles?.some(old=>old.toLocaleLowerCase()===t.toLocaleLowerCase())),'Propón al menos un título diferente a los que el Autor no aprobó',400);
    }
    const [account]=await tx.select({id:users.id}).from(users).where(and(eq(users.autorId,p.autorId),eq(users.rol,'autor'),eq(users.activo,true)));
    ensure(account,'El Autor necesita una cuenta activa en su portal. Solicita al Especialista que lo invite.');
    const editingId=await editingFolder(tx,p,integration.id,integration.storageContextId);
    let workItemId:string,originId:string;
    if(input.kind==='chapter'){
      ensure(input.chapterNumber,'Indica el número del capítulo',400);
      ensure(!latest(rows,'manuscript'),'La revisión de la tripa completa ya comenzó');
      let [chapter]=await tx.select().from(capitulos).where(and(eq(capitulos.proyectoId,p.id),eq(capitulos.numero,input.chapterNumber)));
      if(!chapter)[chapter]=await tx.insert(capitulos).values({proyectoId:p.id,numero:input.chapterNumber}).returning();
      const today=diaCaracas(new Date());
      await tx.update(capitulos).set({fechaInicioEditor:chapter!.fechaInicioEditor??today,fechaEntregaEditor:today,fechaEnvioAutor:today,fechaRespuestaReal:null,fechaPautadaFeedback:calcularFechaPautadaFeedbackCapitulo(today)}).where(eq(capitulos.id,chapter!.id));
      const sync=await sincronizarCapituloEditorial(tx,chapter!.id,'editor',true);ensure(sync,'No se pudo preparar el capítulo');
      workItemId=sync.workItemId;originId=chapter!.id;
    }else{
      const numbers=await chapterNumbers(p.id,tx);
      ensure(numbers.length>0&&numbers.every(n=>latest(rows,'chapter',n)?.status==='approved'),'Todos los capítulos deben estar aprobados por el Autor');
      if(input.kind==='manuscript')ensure(input.chaptersConfirmed===true,'Confirma que la tripa incluye todos los capítulos aprobados',400);
      else ensure(latest(rows,'manuscript')?.status==='approved','El Autor debe aprobar la tripa completa antes de elegir el título');
      workItemId=await crearWorkItemSiNoExiste(tx,{proyectoId:p.id,tipo:'edicion',businessKey:'tripa_completa'});originId=workItemId;
    }
    const [work]=await tx.select().from(workItems).where(eq(workItems.id,workItemId));
    ensure(!work?.gateBloqueante||work.gateBloqueante==='ESPERANDO_AUTOR','Resuelve el bloqueo editorial antes de enviar al Autor');
    ensure(!rows.some(r=>r.originWorkItemId===workItemId&&r.status==='pending'),'Ya existe una revisión pendiente del Autor');
    const version=(current?.editorialReview?.version??0)+1;
    let documentId:string|undefined;
    if(decoded){
      ensure(storage.uploadFile&&storage.pinAuthorRevision,'Drive no permite guardar y conservar esta versión');
      const folder=input.kind==='chapter'?await reviewFolder(storage,editingId,'chapter_drafts','Caps para corregir',input.chapterNumber):await manuscriptFolder(tx,p.id,storage,editingId);
      const name=`${input.kind==='chapter'?`Capítulo ${input.chapterNumber}`:'Tripa completa'} v${version}.${decoded.ext}`;
      const file=await storage.uploadFile({name,mimeType:decoded.mimeType,parentFolderId:folder.providerFileId,content:decoded.content});
      const revision=await storage.pinAuthorRevision(file.providerFileId);
      const [document]=await tx.insert(authorDocuments).values({projectId:p.id,authorId:p.autorId,title:name,version:`v${version}`,driveFileId:file.providerFileId,...revision,sharedBy:actor.id}).returning();
      documentId=document!.id;
      await tx.insert(editorialDeliveries).values({projectId:p.id,workItemId,submittedBy:actor.id,driveFileId:file.providerFileId,driveUrl:`https://drive.google.com/file/d/${file.providerFileId}/view`,observaciones:`${name} enviado al Autor`});
    }
    const review=await createReview(tx,p,workItemId,originId,{kind:input.kind,version,requestKey:input.requestKey,...(input.kind==='chapter'?{chapterNumber:input.chapterNumber}:{}),...(input.proposedTitles?{proposedTitles:input.proposedTitles}:{})},actor.id,current?.id,documentId);
    return {id:review.id,version};
  }));
}

export async function decideEditorialReview(id:string,input:z.infer<typeof editorialDecisionSchema>,actor:AuthenticatedUser,operate:CorporateDriveOperation=withCorporateDrive){
  input=editorialDecisionSchema.parse(input);
  const [initial]=await db.select().from(approvalRequests).where(eq(approvalRequests.id,id));ensure(initial?.editorialReview,'Revisión editorial no encontrada',404);
  await portalProject(initial.projectId,actor);ensure(actor.rol==='autor'&&initial.authorId===actor.autorId,'Revisión no encontrada',404);
  ensure(initial.status==='pending','Esta decisión ya está registrada');
  const metadata=initial.editorialReview;
  ensure(metadata.kind==='titles'||!input.selectedTitle,'La elección de título corresponde a la revisión de títulos',400);
  if(input.decision==='approved')ensure(!input.file,'Aprueba el documento o sube comentarios, no ambas acciones',400);
  if(metadata.kind==='titles'){
    ensure(!input.file,'Los títulos se responden eligiendo una propuesta o con un comentario',400);
    if(input.decision==='approved')ensure(input.selectedTitle&&metadata.proposedTitles?.includes(input.selectedTitle),'Elige uno de los títulos propuestos',400);
  }else if(input.decision==='changes_requested')ensure(input.file,'Sube el documento con tus comentarios antes de enviarlo al Editor',400);
  const response:EditorialReviewResponse={...(input.selectedTitle?{selectedTitle:input.selectedTitle}:{})};
  if(!input.file)return decideApproval(id,{decision:input.decision,feedback:input.feedback,editorialResponse:response},actor);
  const decoded=decodeFile(input.file);
  return operate(async({integration,storage})=>db.transaction(async tx=>{
    const p=await portalProject(initial.projectId,actor,tx,true);
    const [current]=await tx.select().from(approvalRequests).where(eq(approvalRequests.id,id));ensure(current?.status==='pending','Esta decisión ya está registrada');
    ensure(!await projectBlocked(p,tx),'El proyecto está bloqueado o en pausa');
    const editingId=await editingFolder(tx,p,integration.id,integration.storageContextId);
    ensure(storage.uploadFile&&storage.pinAuthorRevision,'Drive no permite guardar esta revisión');
    const chapter=metadata.kind==='chapter';
    const folder=chapter?await reviewFolder(storage,editingId,'chapter_feedback','Caps con feedback',metadata.chapterNumber):await manuscriptFolder(tx,p.id,storage,editingId,true);
    const name=`${chapter?`Capítulo ${metadata.chapterNumber}`:'Tripa completa'} v${metadata.version} con feedback.${decoded.ext}`;
    const file=await storage.uploadFile({name,mimeType:decoded.mimeType,parentFolderId:folder.providerFileId,content:decoded.content});
    const revision=await storage.pinAuthorRevision(file.providerFileId);
    response.feedbackFile={id:file.providerFileId,name,url:`https://drive.google.com/file/d/${file.providerFileId}/view`,mimeType:revision.mimeType,revisionId:revision.revisionId};
    return decideApproval(id,{decision:input.decision,feedback:input.feedback,editorialResponse:response},actor,tx);
  }));
}

// Called inside the same transaction as the canonical author decision.
export async function applyEditorialReviewDecision(tx:Tx,r:ReviewRow,p:typeof proyectos.$inferSelect){
  const metadata=r.editorialReview;if(!metadata)return;
  const approved=r.status==='approved';
  if(metadata.kind==='chapter'){
    await tx.update(capitulos).set({fechaRespuestaReal:diaCaracas(new Date())}).where(eq(capitulos.id,r.originId));
    const numbers=await chapterNumbers(p.id,tx),rows=await reviews(p.id,tx);
    if(approved&&numbers.length>0&&numbers.every(n=>latest(rows,'chapter',n)?.status==='approved')){
      const nextId=await crearWorkItemSiNoExiste(tx,{proyectoId:p.id,tipo:'edicion',businessKey:'tripa_completa'});
      await tx.update(workItems).set({estado:'en_progreso'}).where(and(eq(workItems.id,nextId),eq(workItems.estado,'pendiente')));
    }
  }
  if(metadata.kind==='manuscript'&&approved){
    await createReview(tx,p,r.originWorkItemId,r.originWorkItemId,{kind:'titles',version:1,requestKey:randomUUID(),proposedTitles:metadata.proposedTitles},r.requestedBy);
  }
  if(metadata.kind==='titles'&&approved){
    ensure(r.editorialResponse?.selectedTitle&&metadata.proposedTitles?.includes(r.editorialResponse.selectedTitle),'Elige un título propuesto',400);
    await tx.update(proyectos).set({tituloDefinitivo:r.editorialResponse.selectedTitle}).where(eq(proyectos.id,p.id));
    await tx.update(workItems).set({estado:'completado',gateBloqueante:null,fechaFinReal:diaCaracas(new Date())}).where(eq(workItems.id,r.originWorkItemId));
    await tx.update(workItems).set({estado:'completado',gateBloqueante:null,fechaFinReal:diaCaracas(new Date())}).where(and(eq(workItems.proyectoId,p.id),eq(workItems.tipo,'edicion'),eq(workItems.businessKey,'default')));
  }
  if(p.editorId)await tx.insert(notificaciones).values({proyectoId:p.id,rolDestino:'editor',usuarioDestinoId:p.editorId,
    mensaje:approved?`El Autor aprobó ${r.title}.${metadata.kind==='manuscript'?' Ahora está eligiendo el título.':''}`:metadata.kind==='titles'?'El Autor no aprobó los títulos. Envía nuevas propuestas.':`Tienes feedback del Autor para ${r.title}. Descarga sus comentarios y sube la siguiente versión.`,
    targetPath:`/?vista=mi-trabajo&guideProject=${p.id}`});
}

export async function editorialReviewContent(projectId:string,reviewId:string,feedback:boolean,actor:AuthenticatedUser){
  await editorProject(projectId,actor);
  const [review]=await db.select().from(approvalRequests).where(and(eq(approvalRequests.id,reviewId),eq(approvalRequests.projectId,projectId)));
  ensure(review?.editorialReview,'Revisión no encontrada',404);
  let file:{driveFileId:string;revisionId:string;mimeType:string;title:string};
  if(feedback){const f=review.editorialResponse?.feedbackFile;ensure(f,'Feedback no encontrado',404);file={driveFileId:f.id,revisionId:f.revisionId,mimeType:f.mimeType,title:f.name};}
  else{
    const [document]=await db.select({d:authorDocuments}).from(approvalArtifacts).innerJoin(authorDocuments,eq(authorDocuments.id,approvalArtifacts.documentId)).where(and(eq(approvalArtifacts.approvalId,reviewId),isNull(authorDocuments.revokedAt)));
    ensure(document,'Documento no encontrado',404);file=document.d;
  }
  const content=await withCorporateDrive(async({storage})=>{ensure(storage.readAuthorRevision,'La revisión no está disponible');return storage.readAuthorRevision(file.driveFileId,file.revisionId);});
  await editorProject(projectId,actor);
  return {content,mimeType:file.mimeType,name:file.title};
}

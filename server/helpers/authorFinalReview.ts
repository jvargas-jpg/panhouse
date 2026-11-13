import { and, eq } from 'drizzle-orm';
import { disenoVersiones, fichaCalidadFases, notificaciones, proyectos } from '../db/schema/index.js';
import { obtenerEspecialistaActual } from './carga.js';
import { registrarEvento } from './auditLog.js';
import type { Tx } from './tx.js';
import { crearWorkItemSiNoExiste } from './workItems.js';
// Shared by the legacy coordinator and portal decision. Caller holds the
// project lock, has checked the quality gate, and recorded author approval.
export async function requestAuthorFinalReview(tx:Tx,q:typeof fichaCalidadFases.$inferSelect,v:typeof disenoVersiones.$inferSelect,projectId:string,numerosLegalesUrl?:string){
 const [retry]=await tx.select().from(fichaCalidadFases).where(and(eq(fichaCalidadFases.disenoVersionId,v.id),eq(fichaCalidadFases.numeroFase,3)));if(retry)return retry;
 const previous=await tx.select().from(fichaCalidadFases).where(and(eq(fichaCalidadFases.fichaId,q.fichaId),eq(fichaCalidadFases.numeroFase,3)));
 const wi=await crearWorkItemSiNoExiste(tx,{proyectoId:projectId,tipo:'calidad',businessKey:`revision-final:${v.id}`});
 const [final]=await tx.insert(fichaCalidadFases).values({fichaId:q.fichaId,numeroFase:3,ronda:Math.max(0,...previous.map(x=>x.ronda))+1,pdfUrl:v.enlace,pdfVersion:`V${v.numero}`,fecha:new Date().toISOString().slice(0,10),workItemId:wi,disenoVersionId:v.id,solicitadoEn:new Date(),numerosLegalesUrl:numerosLegalesUrl??null}).returning();
 await tx.update(disenoVersiones).set({calidadWorkItemId:wi,calidadFaseId:final!.id}).where(eq(disenoVersiones.id,v.id));
 const [p]=await tx.select().from(proyectos).where(eq(proyectos.id,projectId));
 await tx.insert(notificaciones).values({proyectoId:projectId,rolDestino:'especialista',usuarioDestinoId:await obtenerEspecialistaActual(projectId,p?.especialistaId??null,tx),targetPath:`/proyectos/${projectId}?proceso=calidad`,mensaje:'Versión aprobada por el Autor: solicita Validador para Revisión Final.'});
 await registrarEvento(tx,{actorId:null,accion:'CALIDAD_REVISION_FINAL_SOLICITADA',entityType:'work_item',entityId:wi,proyectoId:projectId,detalles:{faseId:final!.id,versionId:v.id,version:`V${v.numero}`,ronda:final!.ronda}});
 return final!;
}

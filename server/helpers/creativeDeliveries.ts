import {creativeDeliveries} from '../db/schema/index.js';
import type {Tx} from './tx.js';
export async function saveCreativeDelivery(tx:Tx,input:{projectId:string;creativeProcessId:string;conceptId?:string|null;type:'BRIEF'|'CONCEPT_IMAGE'|'CONCEPT_PDF';url:string;actorId:string}){
  const url=new URL(input.url);
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Object.assign(new Error('Utiliza un enlace web válido.'),{statusCode:400});
  const driveFileId=['drive.google.com','docs.google.com'].includes(url.hostname)?url.pathname.match(/\/d\/([^/]+)/)?.[1]??url.searchParams.get('id'):null;
  await tx.insert(creativeDeliveries).values({projectId:input.projectId,creativeProcessId:input.creativeProcessId,conceptId:input.conceptId??null,type:input.type,driveFileId,
    driveUrl:input.url,submittedBy:input.actorId}).onConflictDoUpdate({target:[creativeDeliveries.creativeProcessId,creativeDeliveries.type],
      set:{conceptId:input.conceptId??null,driveFileId,driveUrl:input.url,submittedBy:input.actorId,submittedAt:new Date()}});
}

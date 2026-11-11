import { randomUUID, createHash } from 'node:crypto';
import { withCorporateDrive } from '../server/modules/integrations/google-drive/corporate.js';
import { pool } from '../server/db/client.js';
const purpose='author-portal-revision-smoke-v1';
try{
 const result=await withCorporateDrive(async({integration,storage})=>{
  if(!integration.projectsRootReady||!integration.projectsRootFolderId||!storage.uploadFile||!storage.pinAuthorRevision||!storage.readAuthorRevision)throw Error('Corporate revision smoke unavailable');
  const root=integration.projectsRootFolderId;
  const folder=await storage.createFolder({name:'QA Portal Autor · '+randomUUID(),parentFolderId:root,appProperties:{panhousePurpose:purpose}});
  if(folder.providerFileId===root)throw Error('Invalid fixture identity');
  let fileId:string|undefined;const report={created:false,pinned:false,exactBytes:false,cleaned:false};
  try{
   const content=Buffer.from('%PDF-1.4\n% PanHouse synthetic revision QA '+randomUUID()+'\n%%EOF\n');
   const file=await storage.uploadFile({name:'Revision QA.pdf',mimeType:'application/pdf',parentFolderId:folder.providerFileId,content});fileId=file.providerFileId;report.created=true;
   const pinned=await storage.pinAuthorRevision(fileId);report.pinned=!!pinned.revisionId;
   const read=await storage.readAuthorRevision(fileId,pinned.revisionId);
   report.exactBytes=createHash('sha256').update(read).digest('hex')===createHash('sha256').update(content).digest('hex');
   if(!report.exactBytes)throw Error('Revision bytes differ');
  }finally{
   const check=await storage.getMetadata(folder.providerFileId);
   if(check.appProperties.panhousePurpose!==purpose||!check.parents.includes(root))throw Error('Fixture cleanup verification failed');
   if(fileId){const file=await storage.getMetadata(fileId);if(!file.parents.includes(folder.providerFileId))throw Error('Fixture file moved');await storage.deleteFileOrFolder(fileId);}
   await storage.deleteFileOrFolder(folder.providerFileId);report.cleaned=true;
  }
  return report;
 });console.log(JSON.stringify(result));
}finally{await pool.end();}

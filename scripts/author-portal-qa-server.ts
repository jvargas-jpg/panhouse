/** Isolated, disposable local preview. Drive revision fixtures are metadata,
 * not copies of production files. No SMTP worker is started. */
import 'dotenv/config';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
const target=new URL(process.env.DATABASE_URL!);if(!['localhost','127.0.0.1'].includes(target.hostname))throw Error('Local QA only');
const admin=new Pool({connectionString:target.href}),name='panhouse_author_preview_20261111';
if(!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount)await admin.query('CREATE DATABASE '+name);await admin.end();
target.pathname='/'+name;process.env.DATABASE_URL=target.href;process.env.NODE_ENV='development';process.env.APP_FRONTEND_URL='http://127.0.0.1:5183';
const {db}=await import('../server/db/client.js');await migrate(db,{migrationsFolder:'./server/db/migrations'});
const {users,autores,servicios,unidades,presupuestos,proyectos,proyectosAutores,fichasTrazabilidad,workItems,authorDocuments,direccionesCreativas,disenos,disenoVersiones}=await import('../server/db/schema/index.js');
const {hashPassword}=await import('../server/helpers/password.js');const {createApproval,decideApproval}=await import('../server/helpers/authorPortal.js');
if(!(await db.select({id:users.id}).from(users).limit(1)).length){
 const [a,b]=await db.insert(autores).values([{nombre:'Elisa Márquez'},{nombre:'Gabriel · Otro Autor'}]).returning();const passwordHash=await hashPassword(process.env.AUTHOR_QA_PASSWORD??'PanhousePreview2026!');
 const [specialist,chief,author,other]=await db.insert(users).values([{email:'especialista@author.qa.test',nombre:'Mariana Rivas',rol:'especialista',passwordHash},{email:'jefatura@author.qa.test',nombre:'Jefatura QA',rol:'jefe_area',passwordHash},{email:'elisa@author.qa.test',nombre:a!.nombre,rol:'autor',autorId:a!.id,accountType:'external',passwordHash},{email:'gabriel@author.qa.test',nombre:b!.nombre,rol:'autor',autorId:b!.id,accountType:'external',passwordHash}]).returning();
 const [s]=await db.insert(servicios).values({codigo:'EF',nombre:'Escritura Fantasma',pesoComplejidad:4,plazoDias:180}).returning();const [u]=await db.insert(unidades).values({nombre:'PanHouse'}).returning();const [budget]=await db.insert(presupuestos).values({nombre:'QA'}).returning();
 const [p,p2]=await db.insert(proyectos).values([{codigo:'AUTHORQA1',autorId:a!.id,titulo:'La memoria del agua',servicioId:s!.id,unidadId:u!.id,presupuestoId:budget!.id,especialistaId:specialist!.id,fechaProgramadaInicio:'2026-10-01',fechaRealInicio:'2026-10-02',fechaFinProyectada:'2027-02-15'},{codigo:'AUTHORQA2',autorId:b!.id,titulo:'Otro libro privado',servicioId:s!.id,unidadId:u!.id,presupuestoId:budget!.id,fechaProgramadaInicio:'2026-11-01'}]).returning();await db.insert(proyectosAutores).values([{proyectoId:p!.id,autorId:a!.id},{proyectoId:p2!.id,autorId:b!.id}]);const [f]=await db.insert(fichasTrazabilidad).values({proyectoId:p!.id,disenoEstatus:'En diseño'}).returning();
 const [wi]=await db.insert(workItems).values({proyectoId:p!.id,tipo:'edicion',estado:'en_progreso'}).returning();
 const actor={...specialist!,autorId:null},aa={...author!,autorId:a!.id};
 const doc=async(title:string,version:string,file='fixture_author_pdf')=>(await db.insert(authorDocuments).values({projectId:p!.id,authorId:a!.id,title,version,driveFileId:file,revisionId:'qa-revision-'+version,mimeType:'application/pdf',sharedBy:specialist!.id}).returning())[0]!;
 const d1=await doc('Estructura del libro','V1');const r1=await createApproval(p!.id,{authorId:a!.id,type:'estructura',originId:wi!.id,title:'Estructura del libro',instructions:'Revisa el recorrido y el orden propuesto de los capítulos.',documentIds:[d1.id]},actor);await decideApproval(r1.id,{decision:'changes_requested',feedback:'Me gustaría comenzar con la historia de mi infancia y dar más espacio al capítulo sobre el río.'},aa);
 const d2=await doc('Estructura del libro','V2');const r2=await createApproval(p!.id,{authorId:a!.id,type:'estructura',originId:wi!.id,title:'Estructura del libro',instructions:'Incorporamos tus observaciones y reorganizamos los capítulos.',documentIds:[d2.id],previousId:r1.id},actor);await decideApproval(r2.id,{decision:'approved',feedback:'El orden refleja muy bien la historia que quiero contar.'},aa);
 await db.update(workItems).set({estado:'completado'}).where(eq(workItems.id,wi!.id));
 const [cwi]=await db.insert(workItems).values({proyectoId:p!.id,tipo:'direccion_creativa',estado:'completado'}).returning();const [dc]=await db.insert(direccionesCreativas).values({proyectoId:p!.id,workItemId:cwi!.id,fechaBriefAprobadoAutor:'2026-11-01'}).returning();
 const [dwi]=await db.insert(workItems).values({proyectoId:p!.id,tipo:'diseno',estado:'en_progreso'}).returning();const [d]=await db.insert(disenos).values({proyectoId:p!.id,workItemId:dwi!.id,direccionCreativaId:dc!.id,tipo:'muestra_diagramacion',solicitudKey:randomUUID(),fuenteUrl:'https://drive.google.com/file/d/fixture_author_pdf/view'}).returning();const [v]=await db.insert(disenoVersiones).values({disenoId:d!.id,numero:3,entregaKey:randomUUID(),enlace:'https://drive.google.com/file/d/fixture_author_pdf/view',entregadoPorId:specialist!.id}).returning();const sample=await doc('Muestra de Diagramación','V3');await createApproval(p!.id,{authorId:a!.id,type:'muestra_diagramacion',originId:v!.id,title:'Muestra de Diagramación',instructions:'Revisa el tamaño de letra, los márgenes y la lectura de estas páginas. Esta muestra nos permitirá definir el diseño del resto de tu libro.\n\nSi necesitas ajustes, indícanos la página y qué te gustaría cambiar.',documentIds:[sample.id],dueAt:'2026-11-09T23:59:59-04:00'},actor);
}
// Re-running the preview leaves an actionable new version after the browser
// acceptance test has requested changes. Existing decisions are never edited.
const {approvalRequests}=await import('../server/db/schema/index.js');
const [qaAuthor]=await db.select().from(users).where(eq(users.email,'elisa@author.qa.test'));
const [qaProject]=await db.select().from(proyectos).where(eq(proyectos.codigo,'AUTHORQA1'));
if(qaAuthor&&qaProject){
 const [pending]=await db.select().from(approvalRequests).where(and(eq(approvalRequests.projectId,qaProject.id),eq(approvalRequests.status,'pending')));
 const [last]=await db.select().from(approvalRequests).where(and(eq(approvalRequests.projectId,qaProject.id),eq(approvalRequests.type,'muestra_diagramacion'))).orderBy(desc(approvalRequests.requestedAt)).limit(1);
 if(!pending&&last?.status==='changes_requested'){
  const [v]=await db.select().from(disenoVersiones).where(eq(disenoVersiones.id,last.originId));const [staff]=await db.select().from(users).where(eq(users.id,last.requestedBy));
  if(v&&staff){const [next]=await db.insert(disenoVersiones).values({disenoId:v.disenoId,numero:v.numero+1,entregaKey:randomUUID(),enlace:v.enlace,entregadoPorId:staff.id}).returning();
   const [doc]=await db.insert(authorDocuments).values({projectId:qaProject.id,authorId:qaAuthor.autorId!,title:'Muestra de Diagramación',version:'V'+next!.numero,driveFileId:'fixture_author_pdf',revisionId:'qa-revision-V'+next!.numero,mimeType:'application/pdf',sharedBy:staff.id}).returning();
   await createApproval(qaProject.id,{authorId:qaAuthor.autorId!,type:'muestra_diagramacion',originId:next!.id,title:'Muestra de Diagramación',instructions:'Incorporamos tus observaciones sobre el tamaño de letra y los márgenes. Revisa la nueva versión.',documentIds:[doc!.id],previousId:last.id,dueAt:new Date(Date.now()+86400000).toISOString()},staff);
  }
 }
}
function previewPdf(version:string){
 const lines=`BT /F1 22 Tf 50 735 Td (PanHouse - Author Portal QA) Tj 0 -45 Td /F1 14 Tf (Revision ${version.replace(/[^A-Za-z0-9 ]/g,'')}) Tj 0 -35 Td (Documento sintetico de prueba.) Tj 0 -25 Td (No contiene material de clientes.) Tj ET`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(lines)} >>\nstream\n${lines}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(pdf);
}
const {buildApp}=await import('../server/app.js');const app=buildApp();
// This preview-only adapter uses the production session and ownership helpers.
// The production app always reads the pinned corporate Drive revision.
const {requireAuth}=await import('../server/middleware/auth.middleware.js');const {authorDocument}=await import('../server/helpers/authorDocuments.js');
app.addHook('preHandler',async(req,reply)=>{
 const match=/^\/api\/autor\/documents\/([a-f0-9-]{36})\/content$/.exec(req.url);if(!match||req.method!=='GET')return;
 await requireAuth(req,reply);if(reply.sent)return;
 try{const d=await authorDocument(match[1]!,req.user!);if(d.driveFileId==='fixture_author_pdf')return reply.type('application/pdf').header('Cache-Control','no-store').send(previewPdf(d.version));}
 catch{return reply.code(404).send({error:'Documento no encontrado'});}
});
await app.listen({host:'127.0.0.1',port:3013});console.log('Author preview ready on 3013 (isolated database).');

/** Explicit, reusable fixtures for the isolated local browser QA database. */
import 'dotenv/config';
import {eq} from 'drizzle-orm';
const target=new URL(process.env.DATABASE_URL!);
if(!['localhost','127.0.0.1'].includes(target.hostname))throw Error('Local QA only');
target.pathname='/panhouse_edicion_preview';process.env.DATABASE_URL=target.toString();process.env.NODE_ENV='development';
const {db,pool}=await import('../server/db/client.js');
const {users,autores,proyectos,proyectosAutores,fichasTrazabilidad,workItems}=await import('../server/db/schema/index.js');
const {solicitarEditor}=await import('../server/helpers/proyectos.js');
const {hashPassword}=await import('../server/helpers/password.js');
const {diaCaracas}=await import('../server/helpers/atencionEspecialista.js');
try{
 const [specialist]=await db.select().from(users).where(eq(users.email,'especialista@edicion.qa.test'));
 const [sample]=await db.select().from(proyectos).limit(1);
 if(!specialist||!sample)throw Error('Run editorial-preview.ts first');
 if(!(await db.select().from(users).where(eq(users.email,'editor-c@edicion.qa.test'))).length)await db.insert(users).values({email:'editor-c@edicion.qa.test',nombre:'Editor de prueba C',rol:'editor',passwordHash:await hashPassword('PanhousePreview2026!')});
 const today=diaCaracas(new Date());
 for(const [key,title,notes] of [['DECISION','Verificación de asignación consciente','Revisión del material completada. Decidir responsable de Edición.'],['CONTEXTO','Preparación del trabajo editorial','Alcance registrado por el Especialista.'],['PLAZO','Revisión de plazo editorial','Fecha de entrega registrada para la prueba.'],['ORIGEN','Verificación de origen de solicitud','Solicitud vinculada al proyecto del Especialista.']] as const){
  if((await db.select().from(proyectos).where(eq(proyectos.codigo,'QA2-'+key))).length)continue;
  const [author]=await db.insert(autores).values({nombre:'Autor de verificación '+key.toLowerCase()}).returning();
  const [p]=await db.insert(proyectos).values({codigo:'QA2-'+key,titulo:title,autorId:author!.id,servicioId:sample.servicioId,unidadId:sample.unidadId,presupuestoId:sample.presupuestoId,especialistaId:specialist.id,fechaProgramadaInicio:today}).returning();
  await db.insert(proyectosAutores).values({proyectoId:p!.id,autorId:author!.id});await db.insert(fichasTrazabilidad).values({proyectoId:p!.id});
  if(key!=='DECISION'){await solicitarEditor(p!.id,specialist.id);await db.update(workItems).set({observaciones:notes,fechaFinPautada:today}).where(eq(workItems.proyectoId,p!.id));}
 }
 console.log(JSON.stringify({database:'panhouse_edicion_preview',projects:await db.select({id:proyectos.id,code:proyectos.codigo,title:proyectos.titulo}).from(proyectos)}));
}finally{await pool.end();}

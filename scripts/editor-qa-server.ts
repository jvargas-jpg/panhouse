/** Disposable local QA database. No development data or credentials modified. */
import 'dotenv/config';
import {Pool} from 'pg';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {eq} from 'drizzle-orm';
const target=new URL(process.env.DATABASE_URL!);
if(!['localhost','127.0.0.1'].includes(target.hostname))throw Error('Local QA only');
const admin=new Pool({connectionString:target.toString()});
console.log('Starting isolated Editor QA preview');
if(!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',['panhouse_editor_preview_20261026'])).rowCount)await admin.query('CREATE DATABASE panhouse_editor_preview_20261026');
await admin.end();target.pathname='/panhouse_editor_preview_20261026';process.env.DATABASE_URL=target.toString();process.env.NODE_ENV='development';
const {db,pool}=await import('../server/db/client.js');
await migrate(db,{migrationsFolder:'./server/db/migrations'});
const {users,servicios,unidades,presupuestos,autores,proyectos,proyectosAutores,workItems}=await import('../server/db/schema/index.js');
const {hashPassword}=await import('../server/helpers/password.js');
const {solicitarEditor,asignarEditor}=await import('../server/helpers/proyectos.js');
const {crearCapitulo,actualizarCapituloAutor,actualizarCapituloEditor}=await import('../server/helpers/capitulos.js');
const {diaCaracas}=await import('../server/helpers/atencionEspecialista.js');
const today=diaCaracas(new Date()),day=(offset:number)=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);};
if(!(await db.select({id:users.id}).from(users).limit(1)).length){
 const passwordHash=await hashPassword('PanhousePreview2026!');
 const [chief,specialist,editor,other]=await db.insert(users).values([
  {nombre:'Jefatura de Edición · QA',email:'jefe@edicion.qa.test',rol:'jefe_edicion',passwordHash},
  {nombre:'Especialista · QA',email:'especialista@edicion.qa.test',rol:'especialista',passwordHash},
  {nombre:'Editor de prueba A',email:'editor@edicion.qa.test',rol:'editor',passwordHash},
  {nombre:'Editor de prueba B',email:'editor-b@edicion.qa.test',rol:'editor',passwordHash},
 ]).returning();
 const [service]=await db.insert(servicios).values({codigo:'EF',nombre:'Escritura fantasma',pesoComplejidad:4,plazoDias:180}).returning();
 const [unit]=await db.insert(unidades).values({nombre:'Unidad QA'}).returning();
 const [budget]=await db.insert(presupuestos).values({nombre:'Presupuesto QA'}).returning();
 const project=async(name:string)=>{
  const [a]=await db.insert(autores).values({nombre:'Autor de prueba · '+name}).returning();
  const [p]=await db.insert(proyectos).values({codigo:'QA-'+name.toUpperCase(),titulo:'Prueba de '+name,autorId:a!.id,servicioId:service!.id,unidadId:unit!.id,presupuestoId:budget!.id,especialistaId:specialist!.id,fechaProgramadaInicio:today}).returning();
  await db.insert(proyectosAutores).values({proyectoId:p!.id,autorId:a!.id});await solicitarEditor(p!.id,specialist!.id);return p!;
 };
 await project('asignación');
 const extra=await project('estructura');await asignarEditor(extra.id,editor!.id,chief!.id);await crearCapitulo(extra.id,1);await crearCapitulo(extra.id,2);
 const pending=await project('lectura');await asignarEditor(pending.id,editor!.id,chief!.id);await crearCapitulo(pending.id,1);
 for(const [name,owner,offset] of [['vencimiento',editor!,-10],['entrega',editor!,0],['feedback',editor!,-7],['espera',editor!,-12]] as const){
  const p=await project(name);await asignarEditor(p.id,owner.id,chief!.id);await crearCapitulo(p.id,1);await actualizarCapituloEditor(p.id,1,{fechaInicioEditor:day(offset)},owner.id);
  if(name==='feedback'||name==='espera'){await actualizarCapituloEditor(p.id,1,{fechaEntregaEditor:day(offset+1)},owner.id);await actualizarCapituloAutor(p.id,1,{fechaEnvioAutor:day(offset+1)},specialist!.id);}
  if(name==='feedback')await actualizarCapituloAutor(p.id,1,{fechaRespuestaReal:today},specialist!.id);
 }
 const blocked=await project('bloqueo');await asignarEditor(blocked.id,editor!.id,chief!.id);const {reportarBloqueoEditorial}=await import('../server/helpers/editorialBlockers.js');const [wi]=await db.select().from(workItems).where(eq(workItems.proyectoId,blocked.id));await reportarBloqueoEditorial(wi!.id,'Material pendiente de revisión',editor!.id);
}
const {crearRequestEditor}=await import('../server/helpers/editorOwnRequests.js');
const editorQa=(await db.select().from(users).where(eq(users.email,'editor@edicion.qa.test')))[0]!;
const ownItems=(await db.select({id:workItems.id}).from(workItems).innerJoin(proyectos,eq(proyectos.id,workItems.proyectoId)).where(eq(proyectos.editorId,editorQa.id))).slice(0,4);
for(const [index,item] of ownItems.entries()){try{await crearRequestEditor(editorQa.id,item.id,index%2?'editor_reasignacion':'editor_apoyo','Solicitud de prueba operativa en el entorno de QA');}catch{}}
await pool.query('INSERT INTO fichas_trazabilidad (proyecto_id) SELECT id FROM proyectos ON CONFLICT DO NOTHING');
const {buildApp}=await import('../server/app.js');const app=buildApp();await app.listen({host:'127.0.0.1',port:3009});
console.log('Editorial QA API ready on http://localhost:3009 (isolated panhouse_editor_preview_20261026)');

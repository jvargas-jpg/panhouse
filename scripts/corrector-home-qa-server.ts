/** Isolated Corrector QA. Does not modify development projects or credentials. */
import 'dotenv/config';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
const url=new URL(process.env.DATABASE_URL!);
if(!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Local QA only');
const dbName='panhouse_corrector_preview_20261027',admin=new Pool({connectionString:url.toString()});
if(!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[dbName])).rowCount)await admin.query('CREATE DATABASE panhouse_corrector_preview_20261027');
await admin.end();url.pathname='/'+dbName;process.env.DATABASE_URL=url.toString();process.env.NODE_ENV='development';
const {db,pool}=await import('../server/db/client.js');await migrate(db,{migrationsFolder:'./server/db/migrations'});
const {users,autores,proyectos,proyectosAutores,servicios,unidades,presupuestos,correcciones,workItems}=await import('../server/db/schema/index.js');
const {hashPassword}=await import('../server/helpers/password.js');
const {solicitarCorreccion,asignarCorrector,marcarInicioCorreccion,registrarEntregaCorreccion}=await import('../server/helpers/correcciones.js');
if(!(await db.select().from(users).limit(1)).length){
 const passwordHash=await hashPassword('PanhouseCorrectorQA2026!');
 const [a,b,empty,one,specialist]=await db.insert(users).values([
  {nombre:'Corrector de prueba',email:'corrector@correccion.qa.test',rol:'corrector',passwordHash},
  {nombre:'Corrector de prueba B',email:'corrector-b@correccion.qa.test',rol:'corrector',passwordHash},
  {nombre:'Corrector sin asignaciones',email:'corrector-vacio@correccion.qa.test',rol:'corrector',passwordHash},
  {nombre:'Corrector con una asignación',email:'corrector-uno@correccion.qa.test',rol:'corrector',passwordHash},
  {nombre:'Especialista de prueba',email:'especialista@correccion.qa.test',rol:'especialista',passwordHash},
 ]).returning();
 const [service]=await db.insert(servicios).values({codigo:'EF',nombre:'Escritura fantasma',pesoComplejidad:4,plazoDias:180}).returning();
 const [unit]=await db.insert(unidades).values({nombre:'Unidad de prueba'}).returning(),[budget]=await db.insert(presupuestos).values({nombre:'Presupuesto de prueba'}).returning();
 const now=new Date(),hour=(n:number)=>new Date(now.getTime()+n*3600000);
 for(const [index,[title,state,owner,alcance]] of ([
  ['Revisión editorial de prueba','overdue',a,'tripa_completa'],['Informe y coherencia editorial','soon',a,'preliminares'],['Texto en revisión ortotipográfica','started',a,'tripa_completa'],['Documento pendiente de revisión','assigned',a,'tripa_completa'],['Material pendiente de confirmar','blocked',a,'tripa_completa'],['Corrección en pausa de proyecto','paused',a,'preliminares'],['Revisión entregada de prueba','completed',a,'tripa_completa'],['Corrección reservada al segundo usuario','assigned',b,'tripa_completa'],['Asignación individual de prueba','assigned',one,'cubierta_extendida']
 ] as const).entries()){
  const [author]=await db.insert(autores).values({nombre:'Autor de prueba de corrección'}).returning();
  const [p]=await db.insert(proyectos).values({codigo:'COH-QA-'+(index+1),titulo:title,autorId:author!.id,especialistaId:specialist!.id,servicioId:service!.id,unidadId:unit!.id,presupuestoId:budget!.id,fechaProgramadaInicio:'2026-10-27'}).returning();
  await db.insert(proyectosAutores).values({proyectoId:p!.id,autorId:author!.id});
  const requested=await solicitarCorreccion(p!.id,{alcance,paginas:90},specialist!.id);
  const result=await asignarCorrector(requested.id,{correctorId:owner!.id,freelance:false,contratoConfirmado:true},specialist!.id);if(!result.ok)throw Error(result.error);
  const [c]=await db.select().from(correcciones).where(eq(correcciones.id,requested.id));
  await db.update(correcciones).set({dueAt:state==='overdue'||state==='paused'||state==='blocked'?hour(-8):state==='soon'?hour(7):hour(72)}).where(eq(correcciones.id,c!.id));
  if(['soon','started','completed'].includes(state))await marcarInicioCorreccion(c!.id,undefined,owner!.id);
  if(state==='blocked')await db.update(workItems).set({estado:'bloqueado',gateBloqueante:'Pendiente confirmar la versión autorizada del documento de entrada.'}).where(eq(workItems.id,c!.workItemId));
  if(state==='paused')await db.update(proyectos).set({estado:'pausado'}).where(eq(proyectos.id,p!.id));
  if(state==='completed')await registrarEntregaCorreccion(c!.id,{},owner!.id);
 }
}
const {buildApp}=await import('../server/app.js');await buildApp().listen({host:'127.0.0.1',port:3012});console.log('Corrector isolated QA ready on 3012');

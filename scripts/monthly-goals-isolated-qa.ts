/** Datos exclusivamente en una nueva base QA local; nunca modifica PanHouse. */
import 'dotenv/config';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
const name='panhouse_goals_qa_20261016',url=new URL(process.env.DATABASE_URL!);
if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Solo QA local');
const admin=new Pool({connectionString:url.toString()});
if((await admin.query('select 1 from pg_database where datname=$1',[name])).rowCount)throw new Error('La base QA ya existe; no se sobrescribe');
await admin.query('CREATE DATABASE panhouse_goals_qa_20261016');await admin.end();
url.pathname='/'+name;process.env.DATABASE_URL=url.toString();process.env.NODE_ENV='development';
const {db,pool}=await import('../server/db/client.js');
await migrate(db,{migrationsFolder:'./server/db/migrations'});
if((await pool.query('select current_database() name')).rows[0].name!==name)throw new Error('Base de datos inesperada');
const {users,proyectos,workItems,fichasTrazabilidad}=await import('../server/db/schema/index.js');
const {crearProyectoDePrueba}=await import('../tests/helpers/fixtures.js');
const {createMonthlyGoal}=await import('../server/helpers/monthlyGoals.js');
const {createSession}=await import('../server/helpers/session.js');
const {diaCaracas}=await import('../server/helpers/atencionEspecialista.js');
const {randomUUID}=await import('node:crypto');
const people=[];
for(const [i,nombre] of ['Marina Editorial','Adriana Salcedo','Gabriel Peña','Lucía Montero','Tomás Rivas'].entries()) {
  const [u]=await db.insert(users).values({nombre,email:`objetivos-qa-${i}@panhouse.test`,passwordHash:'session-only-isolated-qa',rol:i?'especialista':'jefe_area'}).returning();people.push(u!);
}
const manager=people[0]!,specialist=people[1]!,now=new Date(),today=diaCaracas(now),period=today.slice(0,7),[year,month]=period.split('-').map(Number);
const end=new Date(Date.UTC(year!,month!,0)).toISOString().slice(0,10),early=new Date(period+'-01T16:00:00Z');
const projects=[];
for(const [i,title]of ['El jardín de los días','Cuadernos del río','La memoria del viento','Mapas para volver','El oficio de mirar','Voces de la ciudad'].entries()) {
  const p=await crearProyectoDePrueba({especialistaId:i===5?people[2]!.id:specialist.id,jefeAreaId:manager.id});
  await db.update(proyectos).set({tituloDefinitivo:title,fechaProgramadaInicio:period+'-01',notificadoJefatura:true}).where(eq(proyectos.id,p.id));projects.push(p);
  await db.insert(fichasTrazabilidad).values({proyectoId:p.id});
}
async function goal(index:number|null,title:string,source:'JEFATURA'|'ESPECIALISTA',type:'GENERAL'|'CIERRE_PROYECTO'|'ALCANZAR_PROCESO'='GENERAL',targetProcess:string|null=null,owner=specialist.id) {
  return createMonthlyGoal(source==='JEFATURA'?{id:manager.id,rol:'jefe_area'}:{id:owner,rol:'especialista'},
    {periodYear:year!,periodMonth:month!,title,description:index===null?'Mantener el contexto y la documentación de los proyectos organizados durante el mes.':null,goalType:type,projectId:index===null?null:projects[index]!.id,targetProcess,targetWorkItemId:null,targetDate:end,specialistId:owner,idempotencyKey:randomUUID()},early);
}
const closure=await goal(0,'Cerrar el proyecto editorial','JEFATURA','CIERRE_PROYECTO');
await goal(1,'Llegar a Calidad editorial','JEFATURA','ALCANZAR_PROCESO','calidad');
await goal(2,'Completar la entrega editorial del proyecto','JEFATURA','CIERRE_PROYECTO');
await goal(3,'Alcanzar Diseño y diagramación','ESPECIALISTA','ALCANZAR_PROCESO','diseno');
await goal(null,'Consolidar la documentación de mi cartera','ESPECIALISTA');
const complete=await goal(4,'Llegar a Calidad editorial','ESPECIALISTA','ALCANZAR_PROCESO','calidad');
await goal(5,'Cerrar el proyecto editorial','JEFATURA','CIERRE_PROYECTO',null,people[2]!.id);
await db.insert(workItems).values([
  {proyectoId:projects[0]!.id,tipo:'diseno',estado:'en_progreso',createdAt:early},
  {proyectoId:projects[1]!.id,tipo:'edicion',estado:'en_progreso',createdAt:early},
  {proyectoId:projects[2]!.id,tipo:'correccion',estado:'bloqueado',observaciones:'Entrega pendiente de Corrección',createdAt:early},
  {proyectoId:projects[3]!.id,tipo:'edicion',estado:'en_progreso',createdAt:early},
  {proyectoId:projects[4]!.id,tipo:'calidad',estado:'pendiente',createdAt:now},
]);
const folder=join(tmpdir(),'panhouse-monthly-goals-qa');await mkdir(folder,{recursive:true});
const cookies=async(userId:string)=>({cookies:[{name:'panhouse_sid',value:await createSession(userId),domain:'localhost',path:'/',httpOnly:true,secure:false,sameSite:'Lax',expires:-1}],origins:[]});
await writeFile(join(folder,'specialist-state.json'),JSON.stringify(await cookies(specialist.id)));
await writeFile(join(folder,'manager-state.json'),JSON.stringify(await cookies(manager.id)));
await writeFile(join(folder,'private.json'),JSON.stringify({databaseName:name,period,specialistId:specialist.id,managerId:manager.id,projects:projects.map(p=>p.id),closureGoalId:closure.id,completedGoalId:complete.id}));
await pool.end();console.log('QA aislado preparado: '+name+'; '+people.length+' usuarios, '+projects.length+' proyectos.');

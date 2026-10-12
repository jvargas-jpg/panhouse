import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import pg from 'pg';

const database = 'panhouse_cartera_qa_20261012';
const source = new URL(process.env.DATABASE_URL!);
if (!['localhost','127.0.0.1'].includes(source.hostname) || source.pathname !== '/panhouse') throw new Error('QA requiere entorno local panhouse');
const adminUrl = new URL(source); adminUrl.pathname='/postgres';
const admin = new pg.Client({connectionString:adminUrl.toString()});await admin.connect();
const privatePath=join(tmpdir(),'panhouse-cartera-qa','private.json');
if (process.argv.includes('--cleanup')) {
  // Solo la base de fixtures creada por este script. No contiene datos del usuario.
  await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
  await rm(privatePath,{force:true});await admin.end();console.log('Base QA y credenciales temporales eliminadas');
} else {
  if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rowCount) throw new Error('La base QA ya existe; limpia el escenario anterior antes de recrear');
  await admin.query(`CREATE DATABASE ${database}`);await admin.end();
  source.pathname='/'+database;process.env.DATABASE_URL=source.toString();
  const {db,pool}=await import('../server/db/client.js');
  const {migrate}=await import('drizzle-orm/node-postgres/migrator');await migrate(db,{migrationsFolder:'server/db/migrations'});
  const {users,proyectos,projectAssignments,workItems,fichasTrazabilidad,servicios,capitulos,pausas,auditLogs,autores}=await import('../server/db/schema/index.js');
  const {crearProyectoDePrueba}=await import('../tests/helpers/fixtures.js');
  const {hashPassword}=await import('../server/helpers/password.js');const {eq}=await import('drizzle-orm');
  const identities=[];
  for (const cantidad of [15,0,1]) {
    const id=randomUUID(),email='qa-cartera-'+cantidad+'@panhouse.test',password='QA-'+randomBytes(20).toString('base64url');
    await db.insert(users).values({id,email,rol:'especialista',nombre:cantidad===15?'Valentina Ríos':'Especialista QA '+cantidad,passwordHash:await hashPassword(password)});
    identities.push({id,email,password,cantidad});
  }
  const owner=identities[0]!.id;
  const titles=['El arte de volver a casa','La memoria de los árboles','Cuando el silencio habla','Cartas para un nuevo comienzo','El mapa de nuestros días','La luz que llevamos dentro','Historias al otro lado del río','Un lugar para las preguntas','La forma del horizonte','Pequeñas decisiones, grandes caminos','El tiempo entre nosotros','La ciudad que nos recuerda','Todo lo que florece','Los nombres del viento','Una vida en palabras'];
  const names=['Lucía Mendoza','Andrés Salvatierra','Camila Torres','Diego Acosta','Valeria León','Elena Márquez','Gabriel Silva','Mariana Reyes','Santiago Rojas','Isabel Navarro','Paula Benítez','Tomás Méndez','Emilio Cabrera','Daniela Suárez','Sebastián Molina'];
  let crudoId:string | undefined, ghostId:string | undefined, selloId:string | undefined;
  for(let i=0;i<15;i++) {
    const p=await crearProyectoDePrueba({especialistaId:owner});
    await db.update(proyectos).set({tituloDefinitivo:titles[i],subtituloDefinitivo:'Una historia PanHouse',notificadoRrpp:true,notificadoJefatura:true,fechaProgramadaInicio:'2026-10-01',fechaRealInicio:i<13?'2026-10-02':null,fechaFinProyectada:'2026-'+(i<7?'11':'12')+'-'+String(3+i).padStart(2,'0'),estado:i===7?'pausado':i===8?'stand_by':'en_proceso'}).where(eq(proyectos.id,p.id));
    await db.update(autores).set({nombre:names[i]}).where(eq(autores.id,p.autorId));
    await db.insert(projectAssignments).values({proyectoId:p.id,tipo:'especialista',usuarioId:owner});
    await db.insert(fichasTrazabilidad).values({proyectoId:p.id,ingresoFechaIngreso:'2026-10-01',ingresoServicioSubtipoCrudo:i===0||i===3?'Tripa':i===5?'Capítulo':null});
    if([0,3,5].includes(i)){if(!crudoId){await db.update(servicios).set({codigo:'CR',nombre:'Crudo'}).where(eq(servicios.id,p.servicioId));crudoId=p.servicioId;}else await db.update(proyectos).set({servicioId:crudoId}).where(eq(proyectos.id,p.id));}
    else if(i===1||i===9){if(!ghostId){await db.update(servicios).set({codigo:'EF',nombre:'Ghostwriting'}).where(eq(servicios.id,p.servicioId));ghostId=p.servicioId;}else await db.update(proyectos).set({servicioId:ghostId}).where(eq(proyectos.id,p.id));}
    else {if(!selloId){await db.update(servicios).set({codigo:'SE',nombre:'Sello editorial'}).where(eq(servicios.id,p.servicioId));selloId=p.servicioId;}else await db.update(proyectos).set({servicioId:selloId}).where(eq(proyectos.id,p.id));}
    if(i<7)await db.insert(workItems).values([{proyectoId:p.id,tipo:i===0?'correccion':'edicion',estado:'en_progreso',fechaFinPautada:i<3?'2026-10-10':'2026-10-22'},{proyectoId:p.id,tipo:'direccion_creativa',estado:'en_progreso'},...(i===0?[{proyectoId:p.id,tipo:'lanzamiento',estado:'en_progreso' as const}]:[])]);
    if(i===3)await db.insert(capitulos).values({proyectoId:p.id,numero:1,fechaEntregaEditor:'2026-10-11'});
    if(i===4)await db.insert(capitulos).values({proyectoId:p.id,numero:1,fechaEnvioAutor:'2026-10-11',fechaPautadaFeedback:'2026-10-20'});
    if(i===7)await db.insert(pausas).values({proyectoId:p.id,causa:'autor',fechaInicio:new Date('2026-10-05T12:00:00Z'),esPausadoFormal:true});
    if(i===0||i===3){const {obtenerDashboardJefatura}=await import('../server/helpers/jefatura.js');await db.update(proyectos).set({fechaDeseadaAutor:'2026-11-03'}).where(eq(proyectos.id,p.id));const s=await obtenerDashboardJefatura(new Date(),{proyectoId:p.id});const express=s.proyectos[0]!.express;await db.update(proyectos).set({expressDecision:'confirmado',expressFechaEstandar:express.fechaEstandar,expressFechaDeseada:express.fechaDeseada}).where(eq(proyectos.id,p.id));}
  }
  const closed=await crearProyectoDePrueba({especialistaId:owner,estado:'culminado'});
  await db.update(proyectos).set({tituloDefinitivo:'El último capítulo',notificadoJefatura:true}).where(eq(proyectos.id,closed.id));
  await db.insert(auditLogs).values({actorId:owner,entityType:'proyecto',entityId:closed.id,proyectoId:closed.id,accion:'PROYECTO_ESTADO_CAMBIADO',detalles:{anterior:'en_proceso',nuevo:'culminado',especialistaId:owner}});
  const single=await crearProyectoDePrueba({especialistaId:identities[2]!.id});await db.update(proyectos).set({tituloDefinitivo:'Un proyecto, una historia',notificadoJefatura:true}).where(eq(proyectos.id,single.id));
  await mkdir(join(tmpdir(),'panhouse-cartera-qa'),{recursive:true});await writeFile(privatePath,JSON.stringify({identities,database}));
  await pool.end();console.log('QA aislado preparado: carteras 0/1/15, procesos paralelos, Crudo, riesgo, Express, pausa y cierre');
}

import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const url=new URL(process.env.DATABASE_URL!);
if(!['localhost','127.0.0.1'].includes(url.hostname) || url.pathname!=='/panhouse')throw Error('Solo copia QA local');
url.pathname='/panhouse_command_center_qa';process.env.DATABASE_URL=url.toString();
const {db,pool}=await import('../server/db/client.js');
if((await pool.query('SELECT current_database() nombre')).rows[0].nombre!=='panhouse_command_center_qa')throw Error('Base incorrecta');
const {users,proyectos,fichasTrazabilidad}=await import('../server/db/schema/index.js');
const {eq}=await import('drizzle-orm');const {hashPassword}=await import('../server/helpers/password.js');
const config=JSON.parse(await readFile(join(tmpdir(),'panhouse-browser-qa/command-center-private.json'),'utf8'));
const identities=[];
for(const cantidad of [15,0,1]) {
  const password='QA-'+randomBytes(18).toString('base64url');
  const hash=await hashPassword(password);
  let email='qa-inicio-'+randomUUID()+'@panhouse.test',id=randomUUID();
  if(cantidad===15){email='especialista.demo@panhouse.test';const [u]=await db.select({id:users.id}).from(users).where(eq(users.email,email));if(!u)throw Error('Demo ausente');id=u.id;await db.update(users).set({passwordHash:hash}).where(eq(users.id,id));}
  else {await db.insert(users).values({id,rol:'especialista',nombre:'QA Inicio '+cantidad,email,passwordHash:hash});}
  if(cantidad===1){const {crearProyectoDePrueba}=await import('../tests/helpers/fixtures.js');const p=await crearProyectoDePrueba({especialistaId:id});await db.update(proyectos).set({notificadoJefatura:true,titulo:'QA Un proyecto'}).where(eq(proyectos.id,p.id));await db.insert(fichasTrazabilidad).values({proyectoId:p.id});}
  identities.push({email,password,cantidad});
}
await writeFile(join(tmpdir(),'panhouse-browser-qa/inicio-private.json'),JSON.stringify({identities,critical:config.id}));
console.log('Escenarios QA 0/1/15 preparados exclusivamente en la copia aislada');await pool.end();

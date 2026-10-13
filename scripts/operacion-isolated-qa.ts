/** QA temporal: copia fixtures existentes; no crea autores/proyectos demo ni cambia desarrollo. */
import 'dotenv/config';
import pg from 'pg';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const sourceUrl = new URL(process.env.DATABASE_URL!);
if (!['localhost','127.0.0.1'].includes(sourceUrl.hostname) || sourceUrl.pathname !== '/panhouse') throw Error('Solo QA local de Panhouse');
const database = 'panhouse_operacion_visual_qa';
const adminUrl = new URL(sourceUrl); adminUrl.pathname = '/postgres';
const source = new pg.Pool({connectionString:sourceUrl.toString()});
const admin = new pg.Pool({connectionString:adminUrl.toString()});
const serveOnly=process.argv.includes('--serve');
const existe=(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rowCount;
if(existe&&!serveOnly)throw Error('La base QA ya existe; no se sobreescribe');
if(!existe&&serveOnly)throw Error('No existe la copia QA que se quiere servir');
if(!serveOnly)await admin.query('CREATE DATABASE '+database);
await admin.end();
const qaUrl = new URL(sourceUrl);qaUrl.pathname='/'+database;
process.env.DATABASE_URL=qaUrl.toString();process.env.PORT='3007';process.env.SESSION_COOKIE_NAME='panhouse_qa_sid';
const {db,pool}=await import('../server/db/client.js');
const {migrate}=await import('drizzle-orm/node-postgres/migrator');await migrate(db,{migrationsFolder:'./server/db/migrations'});
const manifest=JSON.parse(await readFile('docs/demo/panhouse-datos-varios.json','utf8'));
const ids=[48,56,72,74,78].map(i=>manifest.casos[i].id) as string[];
if(!serveOnly) {
const fids=(await source.query('SELECT id FROM fichas_trazabilidad WHERE proyecto_id=ANY($1::uuid[])',[ids])).rows.map(r=>r.id);
const tableMeta=(await source.query("SELECT table_name,array_agg(column_name) columns FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name")).rows;
const parents=(await source.query("SELECT child.relname child,parent.relname parent FROM pg_constraint fk JOIN pg_class child ON child.oid=fk.conrelid JOIN pg_class parent ON parent.oid=fk.confrelid WHERE fk.contype='f'")).rows;
const base=new Set(['autores','usuarios','servicios','unidades','presupuestos','colecciones','fases','pasos','servicio_fases']);
const pending=new Map<string,unknown[]>();
for(const t of tableMeta) {
  if(!/^[a-z_]+$/.test(t.table_name)||t.table_name==='sesiones')continue;
  let args:unknown[]=[],where='';
  if(t.table_name==='proyectos'){where=' WHERE id=ANY($1::uuid[])';args=[ids];}
  else if(t.columns.includes('proyecto_id')){where=' WHERE proyecto_id=ANY($1::uuid[])';args=[ids];}
  else if(t.columns.includes('ficha_id')){where=' WHERE ficha_id=ANY($1::uuid[])';args=[fids];}
  else if(!base.has(t.table_name))continue;
  const rows=(await source.query(`SELECT * FROM "${t.table_name}"${where}`,args)).rows;
  if(rows.length)pending.set(t.table_name,rows);
}
while(pending.size) {
  const ready=[...pending.keys()].filter(t=>!parents.some(r=>r.child===t&&r.parent!==t&&pending.has(r.parent)));
  if(!ready.length)throw Error('Dependencias cíclicas pobladas en QA; revisar copia de fixtures');
  for(const name of ready) {
    const rows=pending.get(name)!;
    await pool.query(`INSERT INTO "${name}" SELECT * FROM json_populate_recordset(NULL::"${name}",$1::json)`,[JSON.stringify(rows)]);
    pending.delete(name);
  }
}
// Fixture copiado con hito de Sello ya alcanzado: retira únicamente su planificación legacy en QA.
await pool.query("DELETE FROM work_items WHERE proyecto_id=$1 AND tipo='lanzamiento' AND business_key='planificacion'",[ids[3]]);
await pool.query("INSERT INTO ficha_documental_datos(proyecto_id,seccion,datos) VALUES($1,'diseno',$2::jsonb) ON CONFLICT(proyecto_id,seccion) DO UPDATE SET datos=ficha_documental_datos.datos||excluded.datos",[ids[4],JSON.stringify({paqueteFinalCargado:true})]);
}
await source.end();
const accounts=(await pool.query("SELECT id,rol,email FROM usuarios WHERE email=ANY($1::text[])",[['especialista.demo@panhouse.test','rrpp.demo@panhouse.test','jefatura.demo@panhouse.test']])).rows;
if(accounts.length!==3)throw Error('Faltan cuentas existentes para QA');
const {buildApp}=await import('../server/app.js');
const {createSession}=await import('../server/helpers/session.js');
const app=buildApp();
app.get('/api/qa/session/:rol',async(req,reply)=>{
  const rol=(req.params as {rol:string}).rol;
  const account=accounts.find(a=>a.rol===rol);if(!account)return reply.code(404).send({error:'Cuenta QA no encontrada'});
  const token=await createSession(account.id);
  reply.setCookie('panhouse_qa_sid',token,{httpOnly:true,path:'/',sameSite:'lax',secure:false});
  return reply.redirect('http://localhost:5178/proyectos/'+ids[3]+'/operacion');
});
await mkdir('docs/evidencias/operacion-especialista',{recursive:true});
await writeFile('docs/evidencias/operacion-especialista/qa-contexto.json',JSON.stringify({database,frontend:'http://localhost:5178',backend:'http://localhost:3007',copiados:ids,casos:manifest.casos.filter((c:{id:string})=>ids.includes(c.id)),sinNuevosAutoresProyectos:true},null,2));
await app.listen({host:'127.0.0.1',port:3007});
console.log('QA aislado listo en 3007; fixtures existentes copiados.');

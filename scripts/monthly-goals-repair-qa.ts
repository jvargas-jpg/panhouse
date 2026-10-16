/** Reparación acotada a fixtures QA: ficha faltante y fecha futura del escenario. */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const fixture=JSON.parse(await readFile(join(tmpdir(),'panhouse-monthly-goals-qa/private.json'),'utf8'));
if(fixture.databaseName!=='panhouse_goals_qa_20261016')throw new Error('Base QA no reconocida');
const url=new URL(process.env.DATABASE_URL!);if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Solo local');url.pathname='/'+fixture.databaseName;process.env.DATABASE_URL=url.toString();
const {db,pool}=await import('../server/db/client.js');
const {fichasTrazabilidad,workItems}=await import('../server/db/schema/index.js');
const {eq,and}=await import('drizzle-orm');
for(const id of fixture.projects)await db.insert(fichasTrazabilidad).values({proyectoId:id}).onConflictDoNothing();
await db.update(workItems).set({createdAt:new Date(Date.now()-60000)}).where(and(eq(workItems.proyectoId,fixture.projects[4]),eq(workItems.tipo,'calidad')));
await pool.end();console.log('Fixtures QA corregidas; proyectos reales intactos.');

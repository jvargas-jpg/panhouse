/** Explicit second cover delivery for the existing synthetic portfolio case. Local development only. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {desc,eq} from 'drizzle-orm';
import {env} from '../server/config/env.js';
import {db,pool} from '../server/db/client.js';
import {disenoVersiones} from '../server/db/schema/index.js';
import {getCreativeProjectDetail,listCreativeProjects} from '../server/helpers/creativePortfolio.js';
import {entregarDiseno} from '../server/helpers/diseno.js';
try{
 const url=new URL(env.DATABASE_URL);assert(env.NODE_ENV==='development'&&['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname==='/panhouse','Local development only');assert(process.argv.includes('--cover-v2'),'Pass --cover-v2 for this explicit QA transition');
 const fixture=JSON.parse(await readFile('secrets/creative-portfolio-qa.local.json','utf8')),c=fixture.cases.find((x:{kind:string})=>x.kind==='cover');
 const [latest]=await db.select().from(disenoVersiones).where(eq(disenoVersiones.disenoId,c.designId)).orderBy(desc(disenoVersiones.numero)).limit(1);assert(latest);
 if(latest.numero===2)console.log(JSON.stringify({existing:true,version:2}));
 else{
  assert.equal(latest.numero,1);assert(latest.feedbackEn,'Chrome must return V1 before advancing QA');
  const before=await getCreativeProjectDetail(c.projectId,fixture.identities.lider_creativo);assert.equal(before.summary.creativeState,'COVER');assert.equal(before.summary.waitingOn,'DESIGN');assert.equal(before.summary.currentWorkItem,null);assert.equal(before.summary.creativeProcessId,c.processId);
  const delivered=await entregarDiseno(c.designId,{enlace:'https://example.test/qa/portfolio/extended-cover-v2.pdf',entregaKey:randomUUID()},{id:fixture.identities.disenador,rol:'disenador'});
  const after=await getCreativeProjectDetail(c.projectId,fixture.identities.lider_creativo);assert.equal(after.cover!.version,2);assert.equal(after.summary.currentWorkItem!.type,'COVER_REVIEW');assert.equal(after.summary.creativeProcessId,c.processId);
  const rows=await listCreativeProjects(fixture.identities.lider_creativo,{search:'QA · Portafolio',scope:'all',pageSize:50});assert.equal(rows.items.filter(p=>p.projectId===c.projectId).length,1);
  await writeFile('docs/evidencias/lider-creativo/proyectos-creativos/cover-v2-transition.json',JSON.stringify({at:new Date().toISOString(),before:{stage:before.summary.creativeState,waitingOn:before.summary.waitingOn,action:null},after:{stage:after.summary.creativeState,waitingOn:after.summary.waitingOn,action:after.summary.currentWorkItem!.type,version:2},stableRoot:true,oneRow:true,googleCalled:false,versionId:delivered.id},null,2));
  console.log(JSON.stringify({delivered:true,version:2,action:after.summary.currentWorkItem!.type,stableRoot:true,oneRow:true}));
 }
}finally{await pool.end();}

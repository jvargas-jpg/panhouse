/** Read-only local verification of the portfolio fixtures, before or after the Chrome cover loop. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {eq} from 'drizzle-orm';
import {env} from '../server/config/env.js';
import {db,pool} from '../server/db/client.js';
import {proyectos,disenoVersiones} from '../server/db/schema/index.js';
import {listCreativeProjects,getCreativeProjectDetail} from '../server/helpers/creativePortfolio.js';
import {getCreativeDashboard} from '../server/helpers/creativeLeader.js';
try{
 const url=new URL(env.DATABASE_URL);assert(env.NODE_ENV==='development'&&['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname==='/panhouse','Local development only');
 const fixture=JSON.parse(await readFile('secrets/creative-portfolio-qa.local.json','utf8')),leader=fixture.identities.lider_creativo,after=process.argv.includes('--after-cover');
 const data=await listCreativeProjects(leader,{search:'QA · Portafolio',scope:'all',pageSize:50}),dashboard=await getCreativeDashboard(leader);
 assert.equal(data.total,10);assert.equal(new Set(data.items.map(i=>i.projectId)).size,10);
 const expectations:Record<string,[string,string|null,string|null]>={brief:['BRIEF',null,'BRIEF'],concepts:['CONCEPTS',null,'CONCEPTS'],rrpp_feedback:['CONCEPTS',null,'CONCEPT_ADJUSTMENT'],author_feedback:['CONCEPTS',null,'CONCEPT_ADJUSTMENT'],resources:['RESOURCES',null,'RESOURCES'],design_work:['COVER','DESIGN',null],cover:[after?'COMPLETED':'COVER',null,after?null:'COVER_REVIEW'],completed:['COMPLETED',null,null],waiting_rrpp:['CONCEPTS','RRPP',null],waiting_author:['CONCEPTS','AUTHOR',null]};
 const results=[];
 for(const c of fixture.cases){
  const row=data.items.find(i=>i.projectId===c.projectId)!;assert(row,c.kind);const expected=expectations[c.kind]!;
  assert.equal(row.creativeState,expected[0],c.kind);assert.equal(row.waitingOn,expected[1],c.kind);assert.equal(row.currentWorkItem?.type??null,expected[2],c.kind);assert.equal(row.creativeProcessId,c.processId,'stable root');
  if(row.currentWorkItem){const task=dashboard.tasks.find(t=>t.workItemId===row.currentWorkItem!.workItemId);assert(task,'same real work item');assert.equal(task.type,row.currentWorkItem.type);assert.equal(task.conceptId,row.currentWorkItem.conceptId);}
  const detail=await getCreativeProjectDetail(c.projectId,leader);assert(detail.activity.length<=6);for(const resource of detail.resources)assert(detail.concepts.some(x=>x.id===resource.conceptId&&x.approved),'resources linked to approved concept');
  const [project]=await db.select({state:proyectos.estado}).from(proyectos).where(eq(proyectos.id,c.projectId));assert.equal(project!.state,'en_proceso','creative completion is not editorial completion');
  if(c.kind==='cover'&&after){const versions=await db.select().from(disenoVersiones).where(eq(disenoVersiones.disenoId,c.designId));assert.equal(versions.length,2,'V2 belongs to the same Design job');}
  results.push({kind:c.kind,stage:row.creativeState,waitingOn:row.waitingOn,action:row.currentWorkItem?.type??null,stableRoot:true,resourceCount:detail.resources.length});
 }
 const active=await listCreativeProjects(leader,{search:'QA · Portafolio'});assert.equal(active.total,after?8:9);
 await writeFile('docs/evidencias/lider-creativo/proyectos-creativos/'+(after?'post-cover-qa.json':'initial-domain-qa.json'),JSON.stringify({at:new Date().toISOString(),readOnly:true,phase:after?'after Chrome reject → Design V2 → Chrome approve':'initial',projects:data.total,activeProjects:active.total,uniqueRows:true,editorialProjectsRemainActive:true,results,googleCalled:false},null,2));
 console.log(JSON.stringify({passed:true,phase:after?'after-cover':'initial',projects:data.total,active:active.total,cases:results.length}));
}finally{await pool.end();}

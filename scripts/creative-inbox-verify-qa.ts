/** Read-only verification after the explicit Chrome QA workflow. No API keys or sessions are printed. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {eq} from 'drizzle-orm';
import {env} from '../server/config/env.js';
import {pool,db} from '../server/db/client.js';
import {disenos,workItems,disenoVersiones} from '../server/db/schema/index.js';
import {listCreativeWork} from '../server/helpers/creativeInbox.js';
try{
 const url=new URL(env.DATABASE_URL);assert(env.NODE_ENV==='development'&&['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname==='/panhouse','Local development only');
 const fixture=JSON.parse(await readFile('secrets/creative-inbox-qa.local.json','utf8'));
 const leader=fixture.identities.find((i:{rol:string})=>i.rol==='lider_creativo').id;
 const page=await listCreativeWork(leader,{search:'QA · Mi trabajo',alcance:'todas',pageSize:50});
 const results=[];
 for(const [kind,status] of [['brief','Esperando Especialista'],['concepts','Esperando RRPP'],['rrpp_feedback','Esperando RRPP'],['author_feedback','Esperando autor'],['resources','Completada'],['cover','Completada'],['waiting_rrpp','Esperando RRPP'],['waiting_author','Esperando autor'],['completed','Completada']]){
  const f=fixture.cases.find((c:{kind:string})=>c.kind===kind),item=page.items.find(i=>i.creativeProcessId===(kind==='cover'?f.reviewId:f.processId));
  assert(item,kind+' is visible in full history');assert.equal(item.state,status);assert.equal(item.actionable,false);assert.equal(item.overdue,false);assert.equal(item.cta,'Ver proceso');results.push({kind,state:item.state,actionable:item.actionable,overdue:item.overdue});
 }
 const cover=fixture.cases.find((c:{kind:string})=>c.kind==='cover'),[design]=await db.select().from(disenos).where(eq(disenos.id,cover.designId));
 const [designWork]=await db.select().from(workItems).where(eq(workItems.id,design!.workItemId));assert.equal(designWork!.estado,'en_progreso');
 const [version]=await db.select().from(disenoVersiones).where(eq(disenoVersiones.id,cover.versionId));
 const [internal]=await db.select().from(workItems).where(eq(workItems.id,version!.revisionInternaWorkItemId!));assert.equal(internal!.estado,'cancelado');
 const active=await listCreativeWork(leader,{search:'QA · Mi trabajo'});assert(active.items.every(i=>i.state!=='Completada'&&!i.actionable&&!i.overdue));
 const output={at:new Date().toISOString(),readOnly:true,cases:results,designerState:designWork!.estado,previousInternalReview:internal!.estado,activeScopeTotal:active.total,fullHistoryTotal:page.total,googleCalled:false};
 await writeFile('docs/evidencias/lider-creativo/mi-trabajo/post-workflow-qa.json',JSON.stringify(output,null,2));console.log(JSON.stringify({passed:true,cases:results.length,designerState:designWork!.estado,activeScopeTotal:active.total,fullHistoryTotal:page.total}));
}finally{await pool.end();}

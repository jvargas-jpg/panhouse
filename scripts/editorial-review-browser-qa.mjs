// Isolated frontend acceptance checks. API fixtures never write to Drive or user projects.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
const modulePath=process.env.PANHOUSE_PLAYWRIGHT_MODULE||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const {chromium}=await import(pathToFileURL(modulePath));
const browser=await chromium.launch({headless:true,channel:'chrome'});
const base='http://localhost:5173',output='docs/evidencias/editorial-review',errors=[],checks=[];
await mkdir(output,{recursive:true});
const projectId='11111111-1111-4111-8111-111111111111',workId='22222222-2222-4222-8222-222222222222';
const now='2026-11-20T12:00:00Z',document={name:'capitulo.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nQA document')};
let role='editor',submitted=[],decisions=[],sequence=0;
const review=(kind,version,status='pending',chapterNumber=1)=>({id:'review-'+(++sequence),status,metadata:{kind,version,requestKey:'qa-key-'+sequence,...(kind==='chapter'?{chapterNumber}:{proposedTitles:['La memoria del agua','El camino de regreso']})},response:null,feedback:null,requestedAt:now,decidedAt:status==='pending'?null:now,file:kind==='titles'?null:{name:`${kind==='chapter'?'Capítulo 1':'Tripa completa'} v${version}.pdf`,url:'/api/editores/proyectos/'+projectId+'/revisiones/test/archivo'}});
let guide={projectId,title:'La historia que nos une',authors:'Samuel Vargas',serviceCode:'EF',currentStep:'chapters',blockedReason:null,authorHasAccount:true,chapters:[{number:1,latest:null,history:[]}],manuscript:null,titles:null,history:[],selectedTitle:null};
const work={id:workId,workItemId:workId,projectId,title:guide.title,authors:guide.authors,code:'QA-ED',service:'Escritura Fantasma',label:'Inicio de edición',editorId:'qa-editor',editor:'Pedro',state:'En edición',dueDate:null,overdue:false,atRisk:false,actionable:true,needsAssignment:false,requestedAt:null,situation:null,cta:'Abrir',chapter:null,deliveredAt:null,block:null,interventionType:'default'};
function approval(r){return {...r,projectId,projectTitle:guide.title,type:r.metadata.kind==='titles'?'titulos_propuestos':r.metadata.kind==='chapter'?'capitulo':'tripa_completa',title:r.metadata.kind==='titles'?`Títulos propuestos · v${r.metadata.version}`:`${r.metadata.kind==='chapter'?'Capítulo 1':'Tripa completa'} · v${r.metadata.version}`,instructions:'Revisa esta versión y decide si la apruebas.',dueAt:null,previousId:null,sentBy:'Pedro',external:false,overdueDays:0,editorialReview:r.metadata,editorialResponse:r.response,documents:r.file?[{id:'qa-doc',title:r.file.name,version:'v'+r.metadata.version}]:[]};}
async function setup(page){
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;let body={},status=200;
  if(path==='/api/auth/me')body={user:{id:'qa-'+role,nombre:role==='editor'?'Pedro':'Samuel Vargas',email:'qa@example.test',rol:role,autorId:role==='autor'?'qa-author':null,accountType:role==='autor'?'external':'internal'}};
  else if(path==='/api/notificaciones')body={notificaciones:[]};
  else if(path==='/api/editores/mi-trabajo')body={items:[{...work,lastActivity:null}],total:1,pages:1,page:1,counts:{all:1,inProgress:1,waiting:0,completed:0},options:{states:[],types:[],services:[],projects:[]}};
  else if(path==='/api/editores/mi-trabajo/'+workId)body={item:work,folders:[],deliveries:[],blocker:null,history:[]};
  else if(path.endsWith('/guia'))body=guide;
  else if(path==='/api/editores/proyectos/'+projectId+'/revisiones'){
   const input=req.postDataJSON();submitted.push(input);const r=review(input.kind,input.expectedVersion+1);
   if(input.proposedTitles)r.metadata.proposedTitles=input.proposedTitles;
   if(input.kind==='chapter'){guide.chapters[0].latest=r;guide.chapters[0].history.unshift(r);}else guide[input.kind==='manuscript'?'manuscript':'titles']=r;
   guide.history.unshift(r);body={id:r.id,version:r.metadata.version};
  }else if(path==='/api/autor/projects')body={projects:[{id:projectId,title:guide.title,service:'Escritura Fantasma',serviceCode:'EF',stage:1,stageLabel:'Producción de contenido',status:'En curso',specialist:'María',nextMilestone:'Revisión de capítulos'}]};
  else if(path==='/api/autor/meetings')body={meetings:[]};
  else if(path==='/api/autor/approvals')body={approvals:guide.history.map(approval)};
  else if(path.startsWith('/api/autor/approvals/')){
   const id=path.split('/')[4],r=guide.history.find(r=>r.id===id);
   if(path.endsWith('/editorial-decision')){
    const input=req.postDataJSON();decisions.push(input);r.status=input.decision;r.decidedAt=now;r.feedback=input.feedback??null;
    if(input.file)r.response={feedbackFile:{id:'feedback',revisionId:'rev',name:'Capítulo 1 v1 con feedback.pdf',mimeType:'application/pdf',url:'/api/editores/proyectos/'+projectId+'/revisiones/'+r.id+'/feedback'}};
    if(input.selectedTitle)r.response={selectedTitle:input.selectedTitle};
    body={ok:true};
   }else body={approval:approval(r),history:[]};
  }else if(path==='/api/autor/notifications')body={notifications:[]};
  else body={items:[]};
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
}
const check=(name,value)=>{assert.ok(value,name);checks.push({name,passed:true});};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});await setup(page);
 await page.goto(base+'/?vista=mi-trabajo');await page.getByRole('button',{name:/Abrir Inicio de edición/}).waitFor();
 check('No automatic right panel',await page.locator('.eo-detail').count()===0);
 await page.getByRole('button',{name:/Abrir Inicio de edición/}).click();await page.getByRole('region',{name:'Guía de edición del proyecto'}).waitFor();
 await page.screenshot({path:output+'/editor-capitulos-desktop.png',fullPage:true});
 await page.getByLabel('Documento Word o PDF').setInputFiles(document);await page.getByRole('button',{name:'Guardar v1 y enviar al Autor'}).click();await page.locator('.mw-review-status').getByText('Esperando al Autor · v1',{exact:true}).waitFor();
 check('Chapter upload transitions to waiting',submitted.length===1&&submitted[0].file.contentBase64.length>0);
 await page.screenshot({path:output+'/editor-esperando.png',fullPage:true});
 role='autor';const author=await browser.newPage({viewport:{width:1280,height:1000}});await setup(author);await author.goto(base+'/autor');
 await author.getByRole('link',{name:'Revisar →'}).click();await author.getByRole('button',{name:'Subir archivo con comentarios'}).click();
 await author.getByLabel('Tu documento con comentarios').setInputFiles(document);await author.getByRole('button',{name:'Enviar archivo con comentarios'}).click();await author.getByRole('heading',{name:'Decisión registrada'}).waitFor();
 check('Author sends feedback file without mandatory text',decisions[0].decision==='changes_requested'&&!!decisions[0].file);
 role='editor';await page.reload();await page.getByRole('link',{name:'Descargar capítulo 1 con feedback ↗'}).waitFor();
 await page.screenshot({path:output+'/editor-feedback-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/editor-feedback-mobile.png',fullPage:true});check('Mobile editor has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByLabel('Documento Word o PDF').setInputFiles(document);await page.getByRole('button',{name:'Guardar v2 y enviar al Autor'}).click();await page.locator('.mw-review-status').getByText('Esperando al Autor · v2',{exact:true}).waitFor();
 guide.chapters[0].latest.status='approved';guide.currentStep='manuscript';role='editor';await page.setViewportSize({width:1440,height:1000});await page.reload();
 await page.getByRole('heading',{name:'Tripa completa y posibles títulos'}).waitFor();await page.getByLabel('Documento Word o PDF').setInputFiles(document);
 await page.getByLabel('Propuesta 1',{exact:true}).fill('La memoria del agua');await page.getByLabel('Propuesta 2',{exact:true}).fill('El camino de regreso');await page.getByLabel(/Confirmo que esta tripa/).check();
 await page.screenshot({path:output+'/editor-tripa-titulos.png',fullPage:true});
 await page.getByRole('button',{name:'Guardar v1 y enviar al Autor'}).click();await page.locator('.mw-review-status').getByText('Esperando al Autor · v1',{exact:true}).waitFor();check('Full manuscript includes proposed titles',submitted.at(-1).kind==='manuscript'&&submitted.at(-1).proposedTitles.length===2);
 const titles=review('titles',1);guide.titles=titles;guide.history.unshift(titles);guide.manuscript.status='approved';guide.currentStep='titles';role='autor';await author.goto(base+'/autor/aprobaciones/'+titles.id);
 await author.getByRole('button',{name:'No aprobar',exact:true}).click();await author.getByRole('button',{name:'Pedir nuevos títulos'}).click();await author.getByRole('heading',{name:'Decisión registrada'}).waitFor();check('Titles can be rejected without comment',decisions.at(-1).decision==='changes_requested'&&!decisions.at(-1).feedback);
 const newTitles=review('titles',2);newTitles.metadata.proposedTitles=['Una vida nueva','La historia continúa'];guide.titles=newTitles;guide.history.unshift(newTitles);
 await author.goto(base+'/autor/aprobaciones/'+newTitles.id);await author.setViewportSize({width:390,height:844});await author.screenshot({path:output+'/autor-titulos-mobile.png',fullPage:true});check('Mobile author has no horizontal overflow',await author.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await author.getByRole('radio',{name:/Una vida nueva/}).check();await author.getByRole('button',{name:'Aprobar título elegido'}).click();await author.getByRole('button',{name:'Confirmar aprobación'}).click();await author.getByRole('heading',{name:'Decisión registrada'}).waitFor();check('Author selects the proposed title',decisions.at(-1).selectedTitle==='Una vida nueva');
 check('No browser runtime errors',errors.length===0);await writeFile(output+'/browser-checks.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();}

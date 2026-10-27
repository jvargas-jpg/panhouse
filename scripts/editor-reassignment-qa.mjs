const {chromium}=await import(process.env.PANHOUSE_PLAYWRIGHT_MODULE??'playwright');
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:5176',checks=[],errors=[];
const browser=await chromium.launch({headless:true});
try {
 const session=async email=>{const c=await browser.newContext({viewport:{width:1440,height:900},locale:'es-VE'});const r=await c.request.post(origin+'/api/auth/login',{data:{email,password:'PanhousePreview2026!'}});assert.equal(r.status(),200);return c;};
 const editor=await session('editor@edicion.qa.test'),chief=await session('jefe@edicion.qa.test'),next=await session('editor-b@edicion.qa.test');
 const json=async(c,path)=>{const r=await c.request.get(origin+path);assert.equal(r.status(),200,await r.text());return r.json();};
 const work=await json(editor,'/api/editores/mi-trabajo?pageSize=50'),requests=await json(editor,'/api/editores/mis-solicitudes?pageSize=50');
 let sent=requests.items.find(r=>r.type==='editor_reasignacion'&&r.status==='pendiente'&&work.items.some(w=>w.id===r.workItemId));
 let item=sent?work.items.find(w=>w.id===sent.workItemId):work.items.find(w=>w.actionable);
 assert.ok(item,'QA requires an assigned intervention');
 if(!sent){const r=await editor.request.post(origin+'/api/editores/mis-solicitudes',{data:{workItemId:item.id,type:'editor_reasignacion',motivo:'Verificación de reasignación en el entorno aislado de QA'}});assert.equal(r.status(),200,await r.text());sent=(await json(editor,'/api/editores/mis-solicitudes?pageSize=50')).items.find(r=>r.type==='editor_reasignacion'&&r.workItemId===item.id&&r.status==='pendiente');}
 assert.ok(sent);
 const early=await chief.request.post(origin+'/api/editores/solicitudes-editor/'+sent.id+'/decidir',{data:{expectedVersion:sent.version,action:'resolve',text:'Resultado de reasignación desde QA'}});
 assert.equal(early.status(),409);checks.push('resolution requires an actual reassignment');
 const team=await json(chief,'/api/editores/equipo'),target=team.editors.find(e=>e.name==='Editor de prueba B');assert.ok(target);
 const change=await chief.request.patch(origin+'/api/editores/asignaciones/'+item.id,{data:{editorId:target.id,reason:'Reasignación solicitada por Editor durante QA',expectedEditorId:item.editorId,expectedAssignmentId:item.assignmentId}});assert.equal(change.status(),200,await change.text());
 const page=await chief.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/?vista=solicitudes-edicion&tab=pending&selectedRequest='+sent.id,{waitUntil:'domcontentloaded'});
 await page.getByLabel('Respuesta',{exact:true}).fill('Reasignación realizada al Editor de prueba B.');await page.getByRole('button',{name:'Registrar decisión',exact:true}).click();await page.getByRole('heading',{name:'Resultado de la decisión',exact:true}).waitFor();checks.push('chief resolves through UI after canonical assignment command');
 const detail=await json(editor,'/api/editores/mis-solicitudes/'+sent.id);assert.equal(detail.summary.reassignment.previousEditor,'Editor de prueba A');assert.equal(detail.summary.reassignment.nextEditor,'Editor de prueba B');assert.ok(detail.summary.reassignment.assignedAt);
 const old=await editor.newPage();old.setDefaultTimeout(90000);old.on('pageerror',e=>errors.push(e.message));await old.goto(origin+'/?vista=mis-solicitudes&request='+sent.id,{waitUntil:'domcontentloaded'});await old.getByText('Editor anterior',{exact:true}).waitFor();await old.getByText('Nuevo Editor',{exact:true}).waitFor();await old.getByText('Editor de prueba B',{exact:true}).waitFor();await old.screenshot({path:new URL('../docs/evidencias/editor/reassignment-result.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});checks.push('former Editor sees actual previous/new Editor and assignment date');
 assert.ok(!(await json(editor,'/api/editores/mi-trabajo?pageSize=50')).items.some(i=>i.id===item.id));assert.ok((await json(next,'/api/editores/mi-trabajo?pageSize=50')).items.some(i=>i.id===item.id));checks.push('work moves to new Editor and former Editor retains own request');
 assert.deepEqual(errors,[]);await writeFile(new URL('../docs/evidencias/editor/reassignment-qa.json',import.meta.url),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
} finally { await browser.close(); }

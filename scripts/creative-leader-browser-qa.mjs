import {pathToFileURL} from 'node:url';
const {chromium}=await import('playwright').catch(()=>import(process.env.PLAYWRIGHT_MODULE_URL??pathToFileURL(process.env.USERPROFILE+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href));
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const fixture=JSON.parse(await readFile('secrets/creative-leader-qa.local.json','utf8'));
const out='docs/evidencias/lider-creativo';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}});
await context.addCookies([{name:'panhouse_sid',value:fixture.identities.find(i=>i.rol==='lider_creativo').cookie,domain:'localhost',path:'/'}]);
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const base='http://localhost:5173';
const dashboard=async()=>{const r=await context.request.get(base+'/api/direccion-creativa/inicio');assert.equal(r.status(),200);return r.json();};
const ready=async()=>{await page.locator('.cl-attention-list,.cl-attention .cl-empty').first().waitFor();};
const shot=async name=>page.screenshot({path:`${out}/${name}.png`,fullPage:true});
await page.goto(base);await ready();
assert.equal(await page.locator('.cl-kpi').count(),4);
assert.equal(await page.locator('.cl-account-bar').count(),1);
const before=await dashboard();
await page.goto(base+'/?vista=metricas');await ready();assert.equal(await page.locator('header.jp-account,.jp-account').count(),1);
await page.goto(base);await ready();
for(const kind of ['waiting_rrpp','waiting_author']){const c=fixture.cases.find(x=>x.kind===kind);assert(c,kind);assert(!before.tasks.some(t=>t.creativeProcessId===c.processId),kind+' excluded from active');}
for(const [width,height,name] of [[1440,900,'final-1440'],[768,1024,'tablet-768'],[375,812,'mobile-375']]){
  await page.setViewportSize({width,height});await ready();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`overflow ${width}`);
  for(const box of await page.locator('.cl-shell,.cl-body,.cl-kpis,.cl-dashboard-grid,.cl-attention,.cl-right-rail').all()){
    const b=await box.boundingBox();assert(!b||b.x>=0&&b.x+b.width<=width+1,`container overflow ${width}`);
  }
  await shot(name);
  if(width===375){await page.locator('.cl-updated').scrollIntoViewIfNeeded();await shot('mobile-bottom');await page.locator('.cl-header').scrollIntoViewIfNeeded();}
}
await page.locator('.cl-mobile-nav>button').click();
await page.locator('#cl-mobile-menu').waitFor();
await shot('mobile-navigation');
await page.setViewportSize({width:1440,height:900});
if(process.argv.includes('--functional')){
  const results=[];
  const open=async(kind,type)=>{
    const c=fixture.cases.find(x=>x.kind===kind);assert(c,kind);
    const d=await dashboard(),t=d.tasks.find(t=>t.creativeProcessId===(kind==='cover'?c.reviewId:c.processId)&&t.type===type);
    assert(t,kind+' has action');await page.goto(base+t.href);
    await page.locator('.cl-action-form').waitFor();return c;
  };
  const submit=async(button)=>{
    const response=page.waitForResponse(r=>r.url().includes('/api/')&&['PATCH','POST'].includes(r.request().method()));
    await page.getByRole('button',{name:button,exact:true}).click();const r=await response;
    assert(r.ok(),`${r.status()} ${await r.text()}`);
    await page.getByText('Acción registrada correctamente.',{exact:true}).waitFor();
  };
  const inactive=async(c,id=c.processId)=>{const d=await dashboard();assert(!d.tasks.some(t=>t.creativeProcessId===id),'delivered work leaves attention');};
  const brief=await open('brief','BRIEF');
  await page.locator('input[name=brief]').fill('https://example.test/qa/brief/browser-delivery');
  await submit('Entregar brief al Especialista');await inactive(brief);results.push('Brief entregado: sale de atención y espera al Especialista');await shot('workflow-brief');
  const concepts=await open('concepts','CONCEPTS');
  for(let i=0;i<2;i++){await page.locator(`input[name=descripcion${i}]`).fill(`QA concepto ${i+1} entregado desde navegador`);await page.locator(`input[name=enlace${i}]`).fill(`https://example.test/qa/browser/concept-${i+1}`);}
  await submit('Entregar conceptos a RRPP');await inactive(concepts);results.push('Dos conceptos entregados: espera RRPP fuera de atención');await shot('workflow-concepts');
  for(const kind of ['rrpp_feedback','author_feedback']){
    const c=await open(kind,'CONCEPT_ADJUSTMENT');
    await page.locator('input[name=descripcion]').fill('QA concepto ajustado desde navegador: '+kind);
    await page.locator('input[name=enlace]').fill('https://example.test/qa/browser/adjusted-'+kind);
    await submit(kind==='rrpp_feedback'?'Entregar ajuste a RRPP':'Entregar ajuste al Especialista');await inactive(c);results.push(kind+' ajustado y entregado al responsable');await shot('workflow-'+kind);
  }
  const resources=await open('resources','RESOURCES');
  await page.locator('input[name=imagen]').fill('https://example.test/qa/browser/image');await page.locator('input[name=pdf]').fill('https://example.test/qa/browser/concept.pdf');
  await submit('Entregar recursos');await inactive(resources);results.push('Recursos completos: intervención completada');await shot('workflow-resources');
  const cover=await open('cover','COVER_REVIEW');
  assert.equal(await page.getByRole('link',{name:'Abrir cubierta V1'}).count(),1);
  await submit('Aprobar verificación');await inactive(cover,cover.reviewId);results.push('Cubierta verificada por Líder mediante revisión creativa existente');await shot('workflow-cover');
  await writeFile(`${out}/workflow-browser.json`,JSON.stringify({at:new Date().toISOString(),results,errors},null,2));
}
const current=await dashboard();
if(current.tasks.length){
  const task=current.tasks[0];await page.goto(base+task.href);await page.locator('.cl-action-form').waitFor();
  assert.equal(await page.locator('.cl-action-form h3').textContent(),task.label);
  await page.keyboard.press('Tab');assert(await page.locator('dialog').evaluate(el=>el.contains(document.activeElement)));
  await shot('detail-context');await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});
  assert(!new URL(page.url()).searchParams.has('trabajo'));
}
// Isolated UI failure/empty/loading probes, with no database mutations.
await page.route('**/api/direccion-creativa/inicio/actividad',r=>r.fulfill({status:500,json:{error:'QA local'}}));
await page.goto(base);await ready();await page.getByText('No se pudo consultar la actividad.',{exact:true}).waitFor({timeout:20000});
assert.equal(await page.locator('.cl-kpi').count(),4);await shot('activity-local-error');
await page.unroute('**/api/direccion-creativa/inicio/actividad');
const empty={...before,kpis:{briefs:0,concepts:0,covers:0,nextDueAt:null},attention:[],tasks:[],totalActions:0,deadlines:[],processes:[],requests:[]};
await page.route('**/api/direccion-creativa/inicio?*',r=>r.fulfill({json:empty}));
await page.route('**/api/direccion-creativa/inicio/actividad',r=>r.fulfill({json:{items:[]}}));
await page.goto(base);await page.getByText('No tienes tareas creativas pendientes.',{exact:true}).waitFor();await shot('empty');
await page.unroute('**/api/direccion-creativa/inicio?*');
let release;const hold=new Promise(resolve=>release=resolve);
await page.route('**/api/direccion-creativa/inicio?*',async r=>{await hold;await r.fulfill({json:before});});
await page.goto(base);await page.locator('.cl-loading').waitFor();await shot('loading');release();await ready();
assert.deepEqual(errors,[]);
await writeFile(`${out}/visual-browser.json`,JSON.stringify({at:new Date().toISOString(),viewports:['1440x900','768x1024','375x812'],fourKpis:true,noHorizontalOverflow:true,waitingExcluded:true,contextualCta:true,keyboardFocusAndEscape:true,localActivityFailure:true,empty:true,loading:true,errors},null,2));
await browser.close();
console.log('Creative browser QA passed');

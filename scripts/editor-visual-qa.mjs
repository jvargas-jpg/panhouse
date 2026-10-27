const {chromium}=await import(process.env.PANHOUSE_PLAYWRIGHT_MODULE??'playwright');
import {mkdir,writeFile} from 'node:fs/promises';
const origin='http://127.0.0.1:5176';
const dir=new URL('../docs/evidencias/editor/',import.meta.url);await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},locale:'es-VE',timezoneId:'America/Caracas'});
const page=await context.newPage();page.setDefaultTimeout(90000);page.setDefaultNavigationTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
const login=await context.request.post(origin+'/api/auth/login',{data:{email:'editor@edicion.qa.test',password:'PanhousePreview2026!'}});if(!login.ok())throw Error('QA login failed: '+login.status());
const report={screens:[],errors,checks:[]};
for(const [width,height,label] of [[1440,900,'desktop'],[768,1024,'tablet'],[375,812,'mobile']]){
 await page.setViewportSize({width,height});
 for(const [view,title] of [['inicio','Inicio'],['mi-trabajo','Mi trabajo'],['mis-proyectos','Mis proyectos'],['mis-solicitudes','Mis solicitudes']]){
  await page.goto(origin+'/?vista='+view,{waitUntil:'domcontentloaded'});await page.getByRole('heading',{level:1,name:title,exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('[role="status"][aria-label^="Cargando"]'));
  await page.waitForTimeout(1000);
  const metrics=await page.evaluate(()=>({documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,overflow:[...document.querySelectorAll('.eo-table-wrap,.eo-project-grid,.eo-toolbar,.ec-body')].filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>el.className),panelCount:document.querySelectorAll('.ec-panel').length}));
  if(metrics.documentWidth>width)throw Error(view+' viewport overflow');
  const file=view+'-'+label+'.png';await page.screenshot({path:new URL(file,dir).pathname.replace(/^\/(?:([A-Z]):)/,'$1:'),fullPage:false});
  report.screens.push({view,width,height,file,...metrics});
 }
}
await page.setViewportSize({width:375,height:812});await page.goto(origin+'/?vista=mi-trabajo');await page.locator('.eo-row-action').first().click();await page.locator('.eo-detail.is-open .eo-detail-project').waitFor();await page.screenshot({path:new URL('mi-trabajo-mobile-detail.png',dir).pathname.replace(/^\/(?:([A-Z]):)/,'$1:')});await page.keyboard.press('Escape');await page.locator('.eo-detail.is-open').waitFor({state:'detached'});report.checks.push('mobile detail opens and closes with Escape');
await page.setViewportSize({width:1440,height:900});await page.goto(origin+'/?vista=mis-proyectos');await page.getByRole('button',{name:'Tabla',exact:true}).click();await page.locator('.eo-table tbody tr').first().waitFor();report.checks.push('projects cards/table toggle works');
await page.getByRole('button',{name:'Tarjetas',exact:true}).click();await page.getByRole('button',{name:'Ver proyecto',exact:true}).first().click();await page.locator('.eo-detail.is-open').waitFor();report.checks.push('project detail opens');
await page.goto(origin+'/?vista=mis-solicitudes');await page.getByRole('button',{name:'+ Nueva solicitud',exact:true}).click();await page.getByLabel('Nueva solicitud',{exact:true}).waitFor();report.checks.push('new request opens contextual picker');
await page.goto(origin+'/?vista=mi-trabajo',{waitUntil:'domcontentloaded'});await page.locator('.eo-row-action').first().click();await page.locator('.eo-detail .eo-detail-project').waitFor();await page.locator('.eo-detail-title button').click();await page.locator('.eo-detail-placeholder').waitFor();report.checks.push('desktop close action leaves a real empty selection');
await page.locator('.eo-account-menu summary').click();await page.locator('.eo-account-menu button').waitFor({state:'visible'});await page.locator('.eo-account-menu summary').click();report.checks.push('global account menu works');
const failedList=/\/api\/editores\/mi-trabajo\?/;await page.route(failedList,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Fallo temporal de QA'})}));await page.goto(origin+'/?vista=mi-trabajo',{waitUntil:'domcontentloaded'});await page.getByText('No se pudieron cargar tus intervenciones.',{exact:true}).waitFor();await page.unroute(failedList);await page.getByRole('button',{name:'Reintentar',exact:true}).click();await page.locator('.eo-row-action').first().waitFor();report.checks.push('contextual error and retry recover the work list');
await writeFile(new URL('visual-qa.json',dir),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();

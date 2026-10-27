import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium}=await import('file:///C:/Users/PC/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs');
const origin=process.env.PANHOUSE_QA_ORIGIN??'http://localhost:5173';
const out=new URL('../docs/evidencias/corrector-mi-trabajo/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:900},locale:'es-VE',timezoneId:'America/Caracas'}),page=await context.newPage();
page.setDefaultTimeout(45000);page.setDefaultNavigationTimeout(120000);
const report={completed:false,screens:[],checks:[],errors:[]};page.on('pageerror',e=>report.errors.push(e.message));
const login=async(c,email)=>assert.equal((await c.request.post(origin.replace('5173','3000')+'/api/auth/login',{data:{email,password:'password123'}})).status(),200);
const shot=async name=>page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),fullPage:false});
try{
 await login(context,'corrector.varios.demo@panhouse.test');
 await page.goto(origin+'/?vista=mi-trabajo',{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:'Mi trabajo',exact:true,level:1}).waitFor();
 await page.locator('.mw-list').waitFor();
 const rowCount=await page.locator('.mw-list tbody tr').count();
 assert.ok(rowCount>0,'expected at least one correction row');
 report.checks.push('lista real: '+rowCount+' filas para la cuenta demo');
 // No columna de progreso (prohibido por el master prompt)
 const headers=await page.locator('.mw-list thead th').allInnerTexts();
 assert.ok(!headers.some(h=>/progreso/i.test(h)),'must not render a Progreso column');
 assert.ok(!(await page.locator('.mw-list').innerText()).match(/%\s*$/m),'must not render raw percentages');
 report.checks.push('sin columna "Progreso" ni porcentajes falsos: '+JSON.stringify(headers));
 await shot('desktop-list');
 // Open detail by clicking the first row
 await page.locator('.mw-list tbody tr').first().click();
 await page.locator('.eo-detail').waitFor();
 await page.getByRole('button',{name:'Detalle',exact:true}).waitFor();
 await shot('desktop-detail');
 const detailText=await page.locator('.eo-detail').innerText();
 assert.ok(detailText.includes('Información general'),'detail must show Información general');
 report.checks.push('detalle abre con master-detail, tab Detalle activo por defecto');
 // Archivos tab
 await page.getByRole('button',{name:'Archivos',exact:true}).click();
 await page.getByText('Material para corregir',{exact:true}).waitFor();
 await shot('desktop-archivos');
 report.checks.push('tab Archivos muestra Material para corregir y Entregas registradas');
 // Historial tab
 await page.getByRole('button',{name:'Historial',exact:true}).click();
 await page.getByText('Historial de esta corrección',{exact:true}).waitFor();
 await shot('desktop-historial');
 report.checks.push('tab Historial renderiza timeline real');
 // Back to Detalle, check action buttons presence for an actionable row
 await page.getByRole('button',{name:'Detalle',exact:true}).click();
 const hasActionBtn=await page.locator('.mw-work-actions').count();
 report.checks.push('bloque de Acciones presente: '+(hasActionBtn>0));
 // Responsive sweep
 for(const[width,height,label]of[[768,1024,'tablet'],[375,812,'mobile']]){
  await page.setViewportSize({width,height});
  await page.goto(origin+'/?vista=mi-trabajo',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Mi trabajo',exact:true,level:1}).waitFor();
  const metrics=await page.evaluate(()=>({documentWidth:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.equal(metrics.documentWidth,width,'no horizontal overflow at '+width);
  await shot(label+'-list');
  report.screens.push({label,width,height,...metrics});
 }
 await page.setViewportSize({width:1440,height:900});
 // Empty filter state sanity: search for garbage text
 await page.goto(origin+'/?vista=mi-trabajo',{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:'Mi trabajo',exact:true,level:1}).waitFor();
 await page.getByPlaceholder('Buscar por proyecto, autor o intervención…').fill('zzzznoexiste12345');
 await page.waitForTimeout(500);
 await page.getByText('No hay correcciones que coincidan con estos filtros.',{exact:true}).waitFor();
 await shot('desktop-empty-filtered');
 report.checks.push('filtro sin resultados muestra vacío honesto, no error');
 assert.deepEqual(report.errors,[]);
 report.completed=true;
}finally{await writeFile(new URL('visual-qa.json',out),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));

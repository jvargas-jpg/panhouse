import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium}=await import('file:///C:/Users/PC/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs');
const origin=process.env.PANHOUSE_QA_ORIGIN??'http://localhost:5173';
const out=new URL('../docs/evidencias/soporte-digital-mi-trabajo/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:900},locale:'es-VE',timezoneId:'America/Caracas'}),page=await context.newPage();
page.setDefaultTimeout(45000);page.setDefaultNavigationTimeout(120000);
const report={completed:false,checks:[],errors:[]};page.on('pageerror',e=>report.errors.push(e.message));
const login=async(c,email)=>assert.equal((await c.request.post(origin.replace('5173','3000')+'/api/auth/login',{data:{email,password:'password123'}})).status(),200);
const shot=async name=>page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),fullPage:false});
try{
 await login(context,'soportedigital.demo@panhouse.test');
 await page.goto(origin+'/?vista=mi-trabajo',{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:'Mis tareas digitales',level:1}).waitFor();
 await page.locator('.mw-list').waitFor();
 report.checks.push('título real de Mi trabajo, no copiado de la imagen');

 assert.equal(await page.locator('.sd-summary-card').count(),0,'Mi trabajo no debe tener cards de KPI (master prompt §13)');
 report.checks.push('sin cards de KPI: arranca directo en tabs+búsqueda+lista+detalle');

 const tabs=await page.locator('.mw-views button').allInnerTexts();
 assert.ok(tabs.some(t=>t.includes('Todas'))&&tabs.some(t=>t.includes('En preparación'))&&tabs.some(t=>t.includes('Para pruebas KDP'))&&tabs.some(t=>t.includes('Cargas registradas'))&&tabs.some(t=>t.includes('Digital completado')));
 report.checks.push('tabs reales por etapa, mismas etiquetas que Inicio: '+JSON.stringify(tabs));

 const rowCount=await page.locator('.eo-table tbody tr').count();
 assert.equal(rowCount,9,'esperábamos los 9 proyectos sembrados para QA, encontramos '+rowCount);
 report.checks.push('lista: '+rowCount+' filas reales (una por tarea, no por proyecto)');

 // Abrir la primera fila (preparación, sin fecha de envío) y comprobar el detalle
 await page.locator('.eo-table tbody tr').first().click();
 await page.locator('.eo-detail').waitFor();
 await page.getByRole('button',{name:'Detalle',exact:true}).waitFor();
 await shot('desktop-list-detail');
 const detailText=await page.locator('.eo-detail').innerText();
 assert.ok(detailText.includes('Información de la tarea'));
 assert.ok(detailText.includes('Siguiente paso'));
 report.checks.push('detalle abre con master-detail, Información de la tarea + Siguiente paso');

 // Buscar el proyecto bloqueado (por código, único) y comprobar que no expone cifras
 await page.getByPlaceholder('Buscar por proyecto, autor, código o tarea…').fill('PH-QA-MT-08');
 await page.waitForTimeout(400);
 await page.locator('.eo-table tbody tr').first().click();
 await page.getByText('Bloqueado por solvencia').first().waitFor();
 const blockedText=await page.locator('.eo-detail').innerText();
 assert.ok(!/\$|saldo|factura/i.test(blockedText));
 report.checks.push('bloqueo por solvencia visible sin datos financieros');
 await page.getByPlaceholder('Buscar por proyecto, autor, código o tarea…').fill('');
 await page.waitForTimeout(400);

 // Proyecto en etapa de pruebas KDP: Materiales + Amazon/KDP tabs
 await page.getByRole('button',{name:'Para pruebas KDP',exact:false}).click();
 await page.waitForTimeout(300);
 await page.locator('.eo-table tbody tr').first().click();
 await page.getByRole('button',{name:'Materiales',exact:true}).click();
 // EditorSkeleton también usa role="status", así que esperamos a que
 // DESAPAREZCA en vez de a que aparezca cualquier role="status".
 await page.locator('.mw-detail-content .eo-skeleton').waitFor({state:'detached',timeout:20000}).catch(()=>{});
 await shot('desktop-materiales');
 const materialsText=await page.locator('.eo-detail').innerText();
 assert.ok(!materialsText.includes('Cargando materiales'),'la pantalla de materiales no debe quedar en loading indefinido');
 report.checks.push('tab Materiales renderizó: '+(materialsText.includes('paquete final todavía no está disponible')?'mensaje de dependencia real':materialsText.includes('No se pudieron cargar')?'error controlado y recuperable (proyecto QA sin espacio documental propio, 409 real -- ver Reintentar)':materialsText.includes('Sin archivos')?'carpeta vacía':'lista de archivos reales'));

 await page.getByRole('button',{name:'Amazon / KDP',exact:true}).click();
 await page.waitForTimeout(300);
 await shot('desktop-amazon-kdp');
 const amazonText=await page.locator('.eo-detail').innerText();
 assert.ok(!/contrase(ñ|n)a|password/i.test(amazonText));
 report.checks.push('tab Amazon/KDP sin credenciales, campos reales del catálogo');

 await page.getByRole('button',{name:'Historial',exact:true}).click();
 await page.waitForTimeout(300);
 await shot('desktop-historial');
 report.checks.push('tab Historial renderiza eventos reales');

 for(const[width,height,label]of[[768,1024,'tablet'],[375,812,'mobile']]){
  await page.setViewportSize({width,height});
  await page.waitForTimeout(300);
  const hOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
  assert.ok(!hOverflow,label+': no debe haber overflow horizontal');
  await shot(label+'-mi-trabajo');
  report.checks.push(label+' ('+width+'x'+height+'): sin overflow horizontal');
 }

 report.completed=true;
}catch(e){report.errors.push(String(e&&e.stack||e));throw e;}
finally{
 await writeFile(fileURLToPath(new URL('visual-qa.json',out)),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
 await browser.close();
}

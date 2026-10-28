import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium}=await import('file:///C:/Users/PC/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs');
const origin=process.env.PANHOUSE_QA_ORIGIN??'http://localhost:5173';
const out=new URL('../docs/evidencias/soporte-digital-inicio/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:900},locale:'es-VE',timezoneId:'America/Caracas'}),page=await context.newPage();
page.setDefaultTimeout(45000);page.setDefaultNavigationTimeout(120000);
const report={completed:false,checks:[],errors:[]};page.on('pageerror',e=>report.errors.push(e.message));
const login=async(c,email)=>assert.equal((await c.request.post(origin.replace('5173','3000')+'/api/auth/login',{data:{email,password:'password123'}})).status(),200);
const shot=async name=>page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),fullPage:false});
try{
 await login(context,'soportedigital.demo@panhouse.test');
 await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:'Tu trabajo digital de hoy',level:1}).waitFor();
 await page.locator('.sd-tasks').waitFor();
 report.checks.push('título real renderizado, no copiado de la imagen');

 const nav=page.locator('nav[aria-label="Navegación de Soporte Digital"]').first();
 const navText=await nav.innerText();
 assert.ok(/Inicio/.test(navText)&&/Mi trabajo/.test(navText)&&/Mis solicitudes/.test(navText));
 assert.equal(await nav.locator('a').count(),1,'solo Inicio debe ser un link navegable');
 report.checks.push('sidebar: Mi trabajo/Mis solicitudes presentes pero no navegables (fuera de alcance de esta iteración)');

 const cardCount=await page.locator('.sd-summary-card').count();
 assert.equal(cardCount,4,'deben existir exactamente 4 cards de resumen');
 const cardLabels=await page.locator('.sd-summary-card h2').allInnerTexts();
 assert.deepEqual(cardLabels,['En preparación','Para pruebas KDP','Cargas registradas','Digital completado']);
 report.checks.push('4 cards de resumen con etiquetas reales: '+JSON.stringify(cardLabels));

 const rowCount=await page.locator('.sd-tasks tbody tr').count();
 assert.equal(rowCount,6,'esperábamos los 6 proyectos sembrados para QA, encontramos '+rowCount);
 report.checks.push('tabla de tareas prioritarias: '+rowCount+' filas reales (una por tarea, no por proyecto)');

 const bodyText=await page.locator('.soporte-digital-home').innerText();
 assert.ok(!/\bventas?\b/i.test(bodyText)&&!/royalt/i.test(bodyText)&&!/ranking/i.test(bodyText)&&!/ASIN/.test(bodyText),'no debe haber métricas de Amazon inventadas');
 assert.ok(!/sincronizado con amazon/i.test(bodyText)&&!/contraseña/i.test(bodyText),'no debe insinuar integración/credenciales de Amazon');
 assert.equal(await page.locator('svg[class*="chart"]').count(),0,'no debe haber gráficos');
 assert.ok(!bodyText.includes('Publicar ahora')&&!bodyText.includes('Reintentar Amazon'),'no debe haber botones globales de publicación/reintento');
 report.checks.push('sin KPIs de Amazon inventados, sin charts, sin botones globales de publicar/reintentar');

 assert.ok(bodyText.includes('Esperando la entrega del paquete final'),'debe distinguir espera de paquete final de un atraso real');
 assert.ok(bodyText.includes('Bloqueado por solvencia'),'gate real de solvencia debe reflejarse sin cifras');
 assert.ok(!/\$|saldo|factura/i.test(bodyText),'no debe exponer datos financieros');
 assert.ok(bodyText.includes('Proyecto en pausa'),'proyecto en pausa debe distinguirse de un bloqueo');
 report.checks.push('estados especiales (espera de paquete, gate de solvencia, pausa) correctamente distinguidos, sin datos financieros expuestos');

 assert.ok(bodyText.includes('Estado del flujo digital'),'debe existir el panel de flujo agregado');
 const flowCounts=await page.locator('.sd-flow li b').allInnerTexts();
 const cardCounts=await page.locator('.sd-summary-card strong').allInnerTexts();
 assert.deepEqual(flowCounts,cardCounts,'los counts del flow deben coincidir exactamente con las cards (una sola fuente de verdad)');
 report.checks.push('counts de flow y cards superiores coinciden: '+JSON.stringify(cardCounts));

 const firstHref=await page.locator('.sd-tasks tbody tr a.sd-open').first().getAttribute('href');
 assert.match(firstHref,/^\/proyectos\/[^/]+(\?workItem=[^#]+)?#digital$/,'deep link debe ir al workspace del proyecto real, no a una pantalla inventada');
 report.checks.push('deep link de "Abrir tarea" apunta al proyecto real: '+firstHref);

 await shot('desktop-inicio');

 for(const[width,height,label]of[[768,1024,'tablet'],[375,812,'mobile']]){
  await page.setViewportSize({width,height});
  await page.waitForTimeout(200);
  const hOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
  assert.ok(!hOverflow,label+': no debe haber overflow horizontal');
  await shot(label+'-inicio');
  report.checks.push(label+' ('+width+'x'+height+'): sin overflow horizontal, captura guardada');
 }

 report.completed=true;
}catch(e){report.errors.push(String(e&&e.stack||e));throw e;}
finally{
 const {writeFile}=await import('node:fs/promises');
 await writeFile(fileURLToPath(new URL('visual-qa.json',out)),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
 await browser.close();
}

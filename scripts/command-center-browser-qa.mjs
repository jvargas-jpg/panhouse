import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(join(tmpdir(),'panhouse-browser-qa/node_modules/playwright/index.mjs')));
const fixture=JSON.parse(await readFile(join(tmpdir(),'panhouse-browser-qa/command-center-private.json'),'utf8'));
const folder='docs/evidencias/project-command-center';await mkdir(folder,{recursive:true});
const base='http://127.0.0.1:5178', browser=await chromium.launch({headless:true});
const checks=[],errors=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push({name,passed:true});};
const initial=process.argv.includes('--initial');
for(const actor of fixture.identities){
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
  page.setDefaultNavigationTimeout(120000);page.setDefaultTimeout(60000);
  page.on('pageerror',e=>errors.push({rol:actor.rol,error:e.message}));
  await page.goto(base+'/login',{waitUntil:'domcontentloaded'});await page.getByLabel('Correo',{exact:true}).fill(actor.email);await page.locator('#password').fill(actor.password);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(base+'/');
  const origin='/?vista=seguimiento&q=DEMO&estado=en_progreso';
  const path='/proyectos/'+fixture.id,originQuery='?volver='+encodeURIComponent(origin);
  await page.goto(base+path+originQuery);await page.locator('.cc-header h1').waitFor();await page.waitForTimeout(400);
  await page.screenshot({path:`${folder}/${actor.rol}-desktop-${initial?'inicial':'final'}.png`});
  check(actor.rol+': login nativo y shell',await page.locator('.cc-tabs a').count()===5);
  const response=await context.request.get(base+'/api/proyectos/'+fixture.id+'/command-center');check(actor.rol+': resumen API autorizado',response.status()===200);
  const data=await response.json();
  check(actor.rol+': paralelo real',data.procesos.some(p=>p.tipo==='edicion'&&p.estado==='En curso')&&data.procesos.some(p=>p.tipo==='direccion_creativa'&&p.estado==='En curso')&&data.procesos.some(p=>p.tipo==='correccion'&&p.estado==='Pendiente')&&data.ficha.summary.launchEnabled);
  if(initial){await context.close();continue;}
  check(actor.rol+': sin fase/porcentaje ficticio',!await page.locator('.cc-body').getByText(/Fase \d+ de 10|Progreso.*%/).count());
  check(actor.rol+': una barra de cuenta',await page.getByRole('button',{name:'Cerrar sesión',exact:true}).count()===1);
  check(actor.rol+': retorno conservado',await page.locator('.cc-breadcrumb a').getAttribute('href')===origin);
  check(actor.rol+': sidebar global mantiene origen',actor.rol!=='jefe_area'||await page.locator('aside a[aria-current="page"]').textContent()==='Seguimiento');
  await page.locator('.cc-tabs a').filter({hasText:'Operación'}).click();await page.locator('.cc-process').first().waitFor();
  await page.screenshot({path:`${folder}/${actor.rol}-operacion-desktop.png`});
  const correction=page.locator('.cc-process').filter({has:page.getByRole('heading',{name:'Corrección',exact:true})});
  await correction.getByRole('button',{name:'Consultar proceso'}).click();await page.getByRole('dialog').waitFor();await page.waitForTimeout(500);
  check(actor.rol+': detalle conserva proceso y estado',await page.getByRole('dialog').getByRole('heading',{name:'Corrección',exact:true}).count()===1);
  await page.screenshot({path:`${folder}/${actor.rol}-correccion-desktop.png`});
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  check(actor.rol+': Escape y foco retornado',await correction.getByRole('button',{name:'Consultar proceso'}).evaluate(e=>e===document.activeElement));
  await page.locator('.cc-tabs a').filter({hasText:'Equipo'}).click();await page.locator('.fv-team').waitFor();
  check(actor.rol+': no asignación genérica',await page.getByRole('button',{name:/Asignar persona|Cambiar/}).count()===0);
  await page.screenshot({path:`${folder}/${actor.rol}-equipo-desktop.png`});
  await page.locator('.cc-tabs a').filter({hasText:'Ficha',exact:true}).click();await page.locator('.fv-document-area').first().waitFor();
  check(actor.rol+': nueve áreas integradas',await page.locator('.fv-document-area').count()===9&&await page.locator('.cc-header h1').count()===1);
  await page.screenshot({path:`${folder}/${actor.rol}-ficha-desktop.png`});
  await page.locator('.cc-tabs a').filter({hasText:'Actividad'}).click();await page.locator('.fv-activity').waitFor();
  check(actor.rol+': permisos de avance',await page.getByRole('button',{name:'Registrar avance',exact:true}).count()===(actor.rol==='especialista'?1:0));
  if(actor.rol==='especialista'){
    const text='QA aislado: se revisaron las entregas paralelas con el autor';await page.locator('#avance').fill(text);await page.getByRole('button',{name:'Registrar avance',exact:true}).click();await page.getByText('Avance registrado.',{exact:true}).waitFor();await page.getByText(text,{exact:true}).first().waitFor();check('Especialista: avance persiste en historial',true);
  } else {
    const rejected=await context.request.post(base+'/api/proyectos/'+fixture.id+'/avances',{data:{texto:'Jefatura intenta un avance ajeno'}});check('Jefatura: API impide suplantar Especialista',rejected.status()===403);
  }
  await page.screenshot({path:`${folder}/${actor.rol}-actividad-desktop.png`});
  // Legacy URLs and hash links remain in the same shell.
  if(actor.rol==='jefe_area'){
    await page.goto(base+'/?vista=seguimiento&q='+fixture.codigo);await page.locator('.js-project-button').first().waitFor();
    await page.locator('.js-project-button').first().click();await page.getByRole('link',{name:'Ver proyecto 360°',exact:true}).waitFor();
    const href=await page.getByRole('link',{name:'Ver proyecto 360°',exact:true}).getAttribute('href');
    const returnPath=new URL(href,base).searchParams.get('volver');
    await page.getByRole('link',{name:'Ver proyecto 360°',exact:true}).click();await page.locator('.cc-header h1').waitFor();
    check('Seguimiento → Command Center conserva el filtro',returnPath.includes('q='+fixture.codigo)&&await page.locator('.cc-breadcrumb a').getAttribute('href')===returnPath);
    await page.screenshot({path:folder+'/seguimiento-proyecto.png'});await page.locator('.cc-breadcrumb a').click();await page.locator('.js-project-button').first().waitFor();check('Regreso a Seguimiento conserva filtro',new URL(page.url()).searchParams.get('q')===fixture.codigo);
    await page.goto(base+'/?vista=proyectos&q='+fixture.codigo);await page.locator('.jp-project-title').first().waitFor();await page.locator('.jp-project-title').first().click();
    await page.getByRole('link',{name:'Abrir proyecto 360°',exact:true}).waitFor();await page.getByRole('link',{name:'Abrir proyecto 360°',exact:true}).click();await page.locator('.cc-header h1').waitFor();check('Quick View → mismo Command Center',new URL(page.url()).pathname===path);
    await page.locator('.cc-breadcrumb a').click();await page.locator('.jp-project-title').first().waitFor();check('Regreso a Proyectos conserva filtro',new URL(page.url()).searchParams.get('q')===fixture.codigo);
  }
  await page.goto(base+path+'/ficha-trazabilidad'+originQuery+'#calidad');await page.locator('.fv-document-area').first().waitFor();check(actor.rol+': ruta Ficha legacy integrada',new URL(page.url()).pathname===path+'/ficha');
  await page.goto(base+path+originQuery+'#correccion');await page.getByRole('dialog').waitFor();check(actor.rol+': hash legacy abre Corrección',new URL(page.url()).searchParams.get('proceso')==='correccion');await page.keyboard.press('Escape');
  for(const [name,width,height] of [['tablet',768,1024],['mobile',375,812]]){
    await page.setViewportSize({width,height});await page.goto(base+path+originQuery);await page.locator('.cc-header h1').waitFor();await page.waitForTimeout(300);
    check(actor.rol+': '+name+' sin desborde',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`${folder}/${actor.rol}-${name}-resumen.png`});
    await page.locator('.cc-tabs a').filter({hasText:'Ficha',exact:true}).click();await page.locator('.fv-document-area').first().waitFor();check(actor.rol+': '+name+' Ficha sin desborde',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${folder}/${actor.rol}-${name}-ficha.png`});
  }
  await context.close();
}
check('Sin errores JavaScript',errors.length===0);
await writeFile(`${folder}/browser-${initial?'inicial':'final'}.json`,JSON.stringify({checks,errors},null,2));await browser.close();console.log(JSON.stringify({checks:checks.length,errors:errors.length,initial}));

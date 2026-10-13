import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(join(tmpdir(),'panhouse-browser-qa/node_modules/playwright/index.mjs')));
const fixture=JSON.parse(await readFile(join(tmpdir(),'panhouse-browser-qa/inicio-private.json'),'utf8'));
const critical=JSON.parse(await readFile(join(tmpdir(),'panhouse-browser-qa/command-center-private.json'),'utf8'));
const base='http://127.0.0.1:5178', folder='docs/evidencias/especialista-inicio';await mkdir(folder,{recursive:true});
const checks=[],errors=[],browser=await chromium.launch({headless:true});
const check=(name,condition)=>{assert.ok(condition,name);checks.push({name,passed:true});};
async function login(actor){const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(120000);page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/login');await page.getByLabel('Correo',{exact:true}).fill(actor.email);await page.locator('#password').fill(actor.password);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.locator('.ei-kpis').waitFor();return {context,page};}
try {
  // Compare the same native account used in the initial visual capture.
  const before=await login(critical.identities.find(a=>a.rol==='especialista'));
  await before.page.screenshot({path:folder+'/desktop-final-comparacion.png'});await before.context.close();
  for(const actor of fixture.identities){const {context,page}=await login(actor);
    const response=await context.request.get(base+'/api/especialistas/inicio');check(actor.cantidad+': API autorizada',response.status()===200);const data=await response.json();check(actor.cantidad+': conteo real de activos',data.kpis.activos===actor.cantidad);
    check(actor.cantidad+': sin desborde de pagina',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    check(actor.cantidad+': una cuenta/campana',await page.getByRole('button',{name:'Cerrar sesi\u00f3n',exact:true}).count()===1);
    check(actor.cantidad+': cinco KPIs',await page.locator('.ei-kpi').count()===5);
    check(actor.cantidad+': cinco destinos globales',await page.locator('aside .jf-nav a').count()===5);
    await page.screenshot({path:folder+'/desktop-'+actor.cantidad+'-proyectos.png'});
    if(actor.cantidad===0){check('0: acciones/solicitudes vacias',data.acciones.length===0&&data.solicitudes.length===0);const denied=await context.request.get(base+'/api/proyectos/'+critical.id+'/command-center');check('0: no acceso al proyecto de otro Especialista',denied.status()===403);}
    if(actor.cantidad===1)check('1: sin falsa fase ni porcentaje',!await page.locator('.ei-container').getByText(/Fase \d+ de 10|\d+% de capacidad/).count());
    if(actor.cantidad===15){
      check('15: Express confirmado y riesgo reales',data.kpis.express>0&&data.proyectos.some(p=>p.riesgo.atencion));
      const account=await page.locator('.ei-header .jp-account').boundingBox(),header=await page.locator('.ei-header').boundingBox();check('Cuenta contenida en el header',account.y>=header.y&&account.y+account.height<=header.y+header.height+1);
      await page.locator('aside').getByRole('link',{name:'Mis proyectos',exact:true}).click();await page.getByRole('heading',{name:'Mis proyectos',exact:true}).waitFor();check('Cartera pagina y filtro nativos',await page.locator('.ei-table tbody tr').count()===15);
      await page.getByLabel('Filtrar proyectos').fill('DEMO');await page.locator('.ei-table tbody tr').first().getByRole('link',{name:/Gestionar/}).click();await page.locator('.cc-header h1').waitFor();const origen=new URL(page.url()).searchParams.get('volver');check('Proyecto abre Command Center con origen y filtro',origen.includes('vista=mis-proyectos')&&origen.includes('q=DEMO'));
      await page.locator('.cc-breadcrumb a').click();await page.getByLabel('Filtrar proyectos').waitFor();check('Regreso mantiene busqueda',await page.getByLabel('Filtrar proyectos').inputValue()==='DEMO');
      await page.goto(base+'/?vista=mi-trabajo&tipo=vencimientos');await page.locator('.ei-work-tabs').waitFor();check('Mi trabajo muestra lista completa de vencimientos',await page.locator('.ei-date').count()===data.vencimientos.length);
      await page.goto(base+'/?vista=solicitudes');await page.getByRole('heading',{name:'Solicitudes de mis proyectos',exact:true}).waitFor();check('Solicitudes operativas reales',await page.locator('.ei-row').count()===data.solicitudes.length);
      if(data.solicitudes.length){await page.locator('.ei-row[href*="/proyectos/"]').first().click();await page.locator('.cc-header h1').waitFor();check('Solicitud abre proceso y conserva origen',new URL(page.url()).searchParams.get('volver').includes('vista=solicitudes'));await page.keyboard.press('Escape');}
      await page.goto(base+'/?vista=objetivos');await page.getByText('Objetivos mensuales por definir',{exact:true}).waitFor();check('Objetivos sin metas o edicion inventada',await page.locator('.ei-goals input,.ei-goals button').count()===0);
      await page.goto(base);await page.locator('.ei-kpis').waitFor();await page.getByLabel('Buscar proyecto, autor o c\u00f3digo').fill('DEMO');await page.getByLabel('Buscar proyecto, autor o c\u00f3digo').press('Enter');await page.getByLabel('Filtrar proyectos').waitFor();check('Busqueda global funcional',new URL(page.url()).searchParams.get('q')==='DEMO');
      await page.goto(base);await page.locator('.ei-kpis').waitFor();await page.screenshot({path:folder+'/desktop-final.png'});
      for(const [name,width,height] of [['tablet',768,1024],['mobile',375,812]]){await page.setViewportSize({width,height});await page.waitForTimeout(300);check(name+': sin desborde',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));check(name+': navegacion global accesible',await page.locator('.ei-container>.jf-mobile-nav').isVisible());await page.screenshot({path:folder+'/'+name+'-final.png'});if(name==='mobile'){const order=await page.locator('.ei-dashboard-grid').evaluate(e=>[...e.children].sort((a,b)=>Number(getComputedStyle(a).order)-Number(getComputedStyle(b).order)).map(e=>e.className));check('mobile: prioridad accion-vencimiento-solicitud-actividad-proyectos',order.slice(0,5).map(s=>s.match(/ei-(attention|deadlines|requests|activity|projects)/)?.[1]).join(',')==='attention,deadlines,requests,activity,projects');}}
    }
    await context.close();
  }
  const actor=fixture.identities.find(a=>a.cantidad===15),{context,page}=await login(actor);
  await context.route('**/api/especialistas/inicio/actividad',r=>r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'QA: actividad temporalmente no disponible'})}));
  await page.reload();await page.locator('.ei-activity [role=alert]').waitFor();check('Fallo de actividad conserva KPIs y cartera',await page.locator('.ei-kpi').count()===5&&await page.locator('.ei-table tbody tr').count()>0);await page.screenshot({path:folder+'/actividad-error-aislado.png'});
  await context.unroute('**/api/especialistas/inicio/actividad');await page.locator('.ei-activity').getByRole('button',{name:'Reintentar',exact:true}).click();await page.locator('.ei-activity-row').first().waitFor();check('Reintento de actividad recupera el bloque',true);await context.close();
  check('Sin errores JavaScript',errors.length===0);
  await writeFile(folder+'/browser-final.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks:checks.length,errors:errors.length}));
} finally {await browser.close();}

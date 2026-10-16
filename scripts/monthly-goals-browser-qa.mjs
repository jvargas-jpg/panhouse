/** Navegador real contra la base QA aislada; evidencia sin credenciales. */
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const modulePath=process.env.PANHOUSE_PLAYWRIGHT_MODULE || join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const {chromium}=await import(pathToFileURL(modulePath));
const folder=join(tmpdir(),'panhouse-monthly-goals-qa'),fixture=JSON.parse(await readFile(join(folder,'private.json'),'utf8'));
assert.equal(fixture.databaseName,'panhouse_goals_qa_20261016');
const output='docs/evidencias/objetivos-mensuales';await mkdir(output,{recursive:true});
const final=process.argv.includes('--final'),stage=final?'final':'inicial',browser=await chromium.launch({headless:true}),errors=[],checks=[];
const check=(label,value)=>{assert.ok(value,label);checks.push({label,passed:true});};
const contexts={},pages={},urls={specialist:'http://localhost:5184/?vista=objetivos',manager:'http://localhost:5184/?vista=seguimiento&subvista=objetivos'};
const ready=async(p)=>{await p.locator('.mg-kpi strong').first().waitFor();await p.locator('.mg-skeleton').waitFor({state:'detached'}).catch(()=>{});};
const screenshot=async(p,name)=>p.screenshot({path:`${output}/${name}-${stage}.png`});
try {
  for(const role of ['specialist','manager']) {
    const context=await browser.newContext({storageState:join(folder,role+'-state.json'),viewport:{width:1440,height:900}}),page=await context.newPage();contexts[role]=context;pages[role]=page;
    page.on('pageerror',e=>errors.push({role,error:e.message}));
    await page.goto(urls[role]);await ready(page);
    if(role==='manager'){await screenshot(page,'jefatura-equipo-1440');await page.getByRole('button',{name:'Ver objetivos de Adriana Salcedo',exact:true}).click();await page.locator('article.mg-goal').first().waitFor();}
    await screenshot(page,role==='manager'?'jefatura-1440':'especialista-1440');
    check(role+': desktop sin overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    check(role+': seis KPIs reales',await page.locator('.mg-kpi').count()===6);
    check(role+': ambos orígenes distinguibles',await page.locator('.mg-source.blue').count()>0&&await page.locator('.mg-source.teal').count()>0);
    for(const[name,width,height]of [['tablet',768,1024],['mobile',375,812]]) {
      await page.setViewportSize({width,height});await screenshot(page,(role==='manager'?'jefatura':'especialista')+'-'+name);
      check(role+': '+name+' sin overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      check(role+': '+name+' ningún control sale del ancho',await page.locator('.mg-primary:visible,.mg-secondary:visible,.mg-month:visible').evaluateAll(nodes=>nodes.every(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;})));
      if(role==='manager')check('Jefatura '+name+': cards de equipo',await page.locator('.mg-team-mobile').isVisible()&&!await page.locator('.mg-team-desktop').isVisible());
      if(role==='manager'&&name==='mobile') {
        const box=await page.getByRole('dialog',{name:'Objetivos del Especialista',exact:true}).boundingBox();check('Detalle Jefatura móvil ocupa toda la pantalla',box&&box.x===0&&box.y===0&&box.width===width&&box.height===height);
        await page.getByRole('button',{name:'Cerrar detalle del Especialista',exact:true}).click();await screenshot(page,'jefatura-equipo-mobile');
        await page.getByRole('button',{name:'Ver objetivos de Adriana Salcedo',exact:true}).click();
      }
      await page.getByRole('button',{name:role==='manager'?'Asignar objetivo':'Nuevo objetivo',exact:false}).click();
      await page.getByPlaceholder('¿Qué resultado quieres conseguir este mes?').waitFor();
      check(role+': formulario '+name+' sin overflow',await page.getByRole('dialog').filter({has:page.getByPlaceholder('¿Qué resultado quieres conseguir este mes?')}).evaluate(el=>el.scrollWidth<=el.clientWidth));
      await screenshot(page,(role==='manager'?'jefatura':'especialista')+'-formulario-'+name);
      await page.getByRole('button',{name:'Cerrar ventana',exact:true}).click();
    }
    await page.setViewportSize({width:1440,height:900});
  }
  const s=pages.specialist,m=pages.manager;
  if(!final) {
    const title='Organizar criterios editoriales QA '+Date.now();
    await s.getByRole('button',{name:'Nuevo objetivo',exact:false}).click();
    await s.getByPlaceholder('¿Qué resultado quieres conseguir este mes?').fill(title);
    await s.getByRole('button',{name:'Crear mi objetivo',exact:true}).click();
    await s.getByRole('dialog').waitFor({state:'detached'});
    await s.getByRole('article',{name:title,exact:true}).waitFor();check('Crear propio persiste y aparece',true);
    await m.reload();await ready(m);await m.getByRole('article',{name:title,exact:true}).waitFor();
    await m.getByRole('article',{name:title,exact:true}).getByRole('button',{name:'Opciones de '+title}).click();
    check('Jefatura observa el objetivo propio sin edición',await m.locator('.mg-menu').isVisible()&&await m.locator('.mg-menu').getByRole('button',{name:'Editar objetivo'}).count()===0);
    await m.keyboard.press('Escape');
    const assigned='Preparar resultados mensuales QA '+Date.now();
    await m.getByRole('button',{name:'Asignar objetivo',exact:false}).click();
    await m.getByPlaceholder('¿Qué resultado quieres conseguir este mes?').fill(assigned);
    await screenshot(m,'jefatura-formulario');
    await m.getByRole('dialog').getByRole('button',{name:'Asignar objetivo',exact:true}).click();
    await m.getByRole('dialog').waitFor({state:'detached'});
    await s.reload();await ready(s);await s.getByRole('article',{name:assigned,exact:true}).waitFor();
    await s.getByRole('article',{name:assigned,exact:true}).getByRole('button',{name:'Opciones de '+assigned}).click();
    check('Especialista recibe asignado y no puede editarlo',await s.locator('.mg-menu').getByRole('button',{name:'Editar objetivo'}).count()===0);
    await s.locator('.mg-menu').getByRole('button',{name:'Ver detalles e historial'}).click();
    await s.getByText('Objetivo registrado',{exact:true}).waitFor();await screenshot(s,'especialista-historial');
    await s.getByRole('button',{name:'Cerrar ventana',exact:true}).click();
    await s.getByRole('article',{name:title,exact:true}).getByRole('button',{name:'Opciones de '+title}).click();
    await s.locator('.mg-menu').getByRole('button',{name:'Editar objetivo'}).click();
    const changed=title+' revisado';await s.getByPlaceholder('¿Qué resultado quieres conseguir este mes?').fill(changed);await s.getByPlaceholder('Explica por qué cambia este compromiso').fill('Precisar alcance del resultado mensual');
    await s.getByRole('button',{name:'Guardar ajuste',exact:true}).click();await s.getByRole('dialog').waitFor({state:'detached'});await s.getByRole('article',{name:changed,exact:true}).waitFor();check('Edición propia con motivo',true);
    await s.getByRole('article',{name:changed,exact:true}).getByRole('button',{name:'Opciones de '+changed}).click();await s.locator('.mg-menu').getByRole('button',{name:'Cancelar objetivo',exact:true}).click();
    await s.getByLabel('Motivo de cancelación').fill('Objetivo de QA cancelado tras verificar el flujo');await s.getByRole('button',{name:'Confirmar cancelación',exact:true}).click();await s.getByRole('dialog').waitFor({state:'detached'});check('Cancelación conserva objetivo e historial',await s.getByRole('article',{name:changed,exact:true}).getByText('Cancelado',{exact:true}).isVisible());
    await s.getByRole('button',{name:/Asignados por Jefatura/}).click();check('Tab origen actualiza URL',s.url().includes('goalTab=assigned'));
    await s.getByRole('button',{name:'Mes siguiente',exact:true}).click();await ready(s);await s.getByText('No tienes objetivos registrados',{exact:true}).waitFor();check('Mes futuro conserva vacío y permite creación',await s.getByRole('button',{name:'Crear mi objetivo',exact:true}).isVisible());
    await s.getByRole('button',{name:'Mes anterior',exact:true}).click();await s.getByRole('button',{name:'Mes anterior',exact:true}).click();await ready(s);check('Histórico de consulta',await s.getByText(/Periodo histórico/).isVisible()&&await s.getByRole('button',{name:'Nuevo objetivo',exact:false}).count()===0);
    await s.goto(urls.specialist);await ready(s);
    await s.route('**/api/monthly-goals/summary?*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Resumen no disponible para QA'})}));
    await s.reload();await s.getByRole('alert').filter({hasText:'Resumen no disponible para QA'}).waitFor();check('Fallo de resumen no oculta la lista',await s.locator('article.mg-goal').count()>0);
    await s.unroute('**/api/monthly-goals/summary?*');await s.getByRole('button',{name:'Reintentar',exact:true}).click();await ready(s);check('Reintento contextual recupera resumen',await s.locator('.mg-kpi').count()===6);
    await s.route('**/api/monthly-goals?*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Lista no disponible para QA'})}));
    await s.reload();await s.getByRole('alert').filter({hasText:'Lista no disponible para QA'}).waitFor();check('Fallo de lista conserva KPIs válidos',await s.locator('.mg-kpi').count()===6);
    await s.unroute('**/api/monthly-goals?*');await s.getByRole('button',{name:'Reintentar',exact:true}).click();await s.locator('article.mg-goal').first().waitFor();
    // Apertura de proyecto con retorno hacia Objetivos.
    const link=s.getByRole('link',{name:'Ver proyecto',exact:false}).first(),href=await link.getAttribute('href');check('CTA proyecto conserva retorno',href.includes('volver=')&&decodeURIComponent(href).includes('vista=objetivos'));
    await link.click();await s.getByRole('heading',{name:'El jardín de los días',exact:true}).waitFor();check('CTA abre Command Center real',s.url().includes('/proyectos/'));
    await s.goto(urls.specialist);await ready(s);
    await s.getByRole('button',{name:/Completados/}).click();await s.locator('.mg-result').first().waitFor();check('Resultado automático visible con fecha y sin porcentaje',await s.locator('.mg-result').first().isVisible()&&await s.getByRole('progressbar').count()===0);await screenshot(s,'especialista-cumplidos');
    await m.getByRole('button',{name:'Ver objetivos de Lucía Montero',exact:true}).click();await m.getByText('Lucía Montero no tiene objetivos registrados',{exact:true}).waitFor();check('Especialista sin objetivos sigue accesible para asignación',await m.getByRole('button',{name:'Asignar objetivo',exact:false}).first().isVisible());
  }
  check('Sin errores JavaScript',errors.length===0);
  await writeFile(`${output}/browser-${stage}.json`,JSON.stringify({stage,checks,errors},null,2));
  console.log(JSON.stringify({stage,checks:checks.length,errors}));
} catch(error) {
  for(const[role,p]of Object.entries(pages))await p.screenshot({path:`${output}/${role}-fallo.png`}).catch(()=>{});
  await writeFile(`${output}/browser-${stage}.json`,JSON.stringify({stage,checks,errors,failure:error.message},null,2));
  throw error;
} finally {await browser.close();}

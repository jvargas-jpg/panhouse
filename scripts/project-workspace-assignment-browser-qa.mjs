import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')));
const fixture=JSON.parse(await readFile('secrets/project-workspace-assignment-qa.local.json','utf8'));
const base='http://localhost:5173',output='docs/evidencias/project-workspace-assignment';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
const check=(label,condition)=>{assert.ok(condition,label);checks.push({label,passed:true});};
async function login(role){
  const actor=fixture.identities.find(i=>i.rol===role),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/login');await page.getByLabel('Correo',{exact:true}).fill(actor.email);await page.locator('#password').fill(actor.password);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(base+'/');return {context,page};
}
try{
  const {context,page}=await login('jefe_area');
  const before=await context.request.get(base+'/api/proyectos/'+fixture.projectId+'/workspace');
  if((await before.json()).status==='NOT_CONFIGURED'){
    check('QA empieza sin workspace',true);
    await page.goto(base+'/?vista=asignaciones&proyecto='+fixture.projectId+'&decision=candidatos');
    const specialist=fixture.identities.find(i=>i.rol==='especialista');
    await page.locator(`input[type=radio][value="${specialist.id}"]`).check();
    await page.screenshot({path:output+'/jefatura-antes-asignacion.png'});
    const response=page.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().includes('/especialista'));
    const started=Date.now();await page.getByRole('button',{name:'Asignar a QA Auto Drive · especialista',exact:true}).click();
    const assigned=await response;check('Asignación UI confirmada',assigned.ok());
    const result={status:assigned.status(),elapsedMs:Date.now()-started,source:'Jefatura UI → Asignar especialista',manualWorkspaceCreatedFirst:false};
    await writeFile(output+'/assignment-response.json',JSON.stringify(result,null,2));
  }
  await context.close();
  const spec=await login('especialista');
  await spec.page.goto(base+'/proyectos/'+fixture.projectId);await spec.page.locator('.cc-header h1').waitFor();
  const observed=[];
  const deadline=Date.now()+180000;
  while(Date.now()<deadline){
    const response=await spec.context.request.get(base+'/api/proyectos/'+fixture.projectId+'/workspace');const state=await response.json();
    if(observed.at(-1)!==state.status)observed.push(state.status);
    if(state.status==='READY')break;
    if(state.status==='ERROR')throw Error('QA provisioning failed: '+state.message);
    await spec.page.screenshot({path:output+'/especialista-preparando.png'});
    await new Promise(r=>setTimeout(r,2000));
  }
  const ready=await (await spec.context.request.get(base+'/api/proyectos/'+fixture.projectId+'/workspace')).json();
  check('READY real',ready.status==='READY');check('Expected vs persisted: missing=0',ready.folderCount===ready.expectedFolderCount);
  await spec.page.getByText('✓ Configurado',{exact:true}).first().waitFor();
  check('Resumen usa URL persistida',await spec.page.getByRole('link',{name:'Abrir carpeta',exact:false}).getAttribute('href')===ready.rootFolderUrl);
  check('No creación manual normal',await spec.page.getByRole('button',{name:/Crear espacio|Configurar espacio|Reintentar configuración/}).count()===0);
  await spec.page.screenshot({path:output+'/especialista-resumen-desktop.png'});
  await spec.page.locator('.cc-tabs a').filter({hasText:'Ficha',exact:true}).click();
  check('Ficha misma URL',await spec.page.getByRole('link',{name:'Abrir carpeta',exact:false}).getAttribute('href')===ready.rootFolderUrl);
  await spec.page.screenshot({path:output+'/especialista-ficha-desktop.png'});
  await spec.page.goto(base+'/proyectos/'+fixture.projectId+'/operacion?proceso=preparacion_inicial');
  await spec.page.getByRole('button',{name:'Ver estructura',exact:true}).click();
  await spec.page.getByRole('dialog',{name:'Estructura documental',exact:true}).waitFor();
  await spec.page.getByRole('dialog',{name:'Estructura documental'}).getByText('Ilustraciones',{exact:true}).waitFor();
  check('Árbol real incluye ramas condicionales',await spec.page.getByRole('dialog',{name:'Estructura documental'}).getByText('Ilustraciones',{exact:true}).count()===1);
  await spec.page.screenshot({path:output+'/especialista-estructura-desktop.png'});
  await spec.page.keyboard.press('Escape');
  for(const [label,width,height] of [['tablet',768,1024],['mobile',375,812]]){
    await spec.page.setViewportSize({width,height});await spec.page.goto(base+'/proyectos/'+fixture.projectId);await spec.page.locator('.cc-header h1').waitFor();
    check(label+' sin overflow',await spec.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    check(label+' acceso Drive visible',await spec.page.getByRole('link',{name:'Abrir carpeta',exact:false}).isVisible());
    await spec.page.screenshot({path:output+'/especialista-resumen-'+label+'.png'});
  }
  const popupPromise=spec.page.waitForEvent('popup');await spec.page.getByRole('link',{name:'Abrir carpeta',exact:false}).click();
  const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');
  // Google can redirect unauthenticated headless sessions; opener must remain isolated.
  check('Drive abre pestaña aislada',await popup.evaluate(()=>window.opener===null));
  await popup.screenshot({path:output+'/drive-abierto.png'});await popup.close();
  await spec.page.goto(base+'/proyectos/'+fixture.projectId+'/operacion?proceso=preparacion_inicial');
  const operation=spec.page.getByRole('region',{name:'Espacio documental'});
  await operation.getByRole('button',{name:'Ver estructura',exact:true}).waitFor();
  const linkBox=await operation.getByRole('link',{name:'Abrir Drive',exact:false}).boundingBox(),buttonBox=await operation.getByRole('button',{name:'Ver estructura'}).boundingBox();
  check('Operación mobile acciones apiladas',!!linkBox&&!!buttonBox&&buttonBox.y>=linkBox.y+linkBox.height);
  await spec.page.screenshot({path:output+'/especialista-operacion-mobile.png'});
  await operation.getByRole('button',{name:'Ver estructura'}).click();await spec.page.getByRole('dialog',{name:'Estructura documental'}).getByText('Ilustraciones',{exact:true}).waitFor();
  check('Árbol mobile sin overflow',await spec.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await spec.page.screenshot({path:output+'/especialista-estructura-mobile.png'});
  const manager=await login('jefe_area');await manager.page.goto(base+'/proyectos/'+fixture.projectId);await manager.page.locator('.cc-header h1').waitFor();
  await manager.page.getByText('✓ Configurado',{exact:true}).waitFor();
  check('Jefatura READY real misma carpeta',await manager.page.getByRole('link',{name:'Abrir carpeta',exact:false}).getAttribute('href')===ready.rootFolderUrl);
  check('Jefatura solo consulta',await manager.page.getByRole('button',{name:/Configurar espacio|Reintentar configuración|Ver estructura/}).count()===0);
  await manager.page.screenshot({path:output+'/jefatura-ready-desktop.png'});await manager.context.close();
  await writeFile(output+'/browser-real.json',JSON.stringify({projectId:fixture.projectId,checks,errors,observed,workspace:ready,retained:true},null,2));
  console.log(JSON.stringify({checks:checks.length,errors:errors.length,observed,workspaceId:ready.id,webViewLink:ready.rootFolderUrl}));
  await spec.context.close();
}finally{await browser.close();}

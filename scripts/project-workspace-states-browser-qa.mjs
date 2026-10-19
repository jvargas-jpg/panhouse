/** UI acceptance: workspace API fixtures only. Never mutates PostgreSQL or Drive. */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')));
const fixture=JSON.parse(await readFile('secrets/project-workspace-assignment-qa.local.json','utf8'));
const evidence=JSON.parse(await readFile('docs/evidencias/project-workspace-assignment/browser-real.json','utf8'));
const base='http://localhost:5173',output='docs/evidencias/project-workspace-assignment';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
const check=(label,condition)=>{assert.ok(condition,label);checks.push({label,passed:true});};
let state={...evidence.workspace},gets=0,posts=0;
try{
 for(const rol of ['especialista','jefe_area']){
  const identity=fixture.identities.find(i=>i.rol===rol),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
  await page.goto(base+'/login');await page.getByLabel('Correo',{exact:true}).fill(identity.email);await page.locator('#password').fill(identity.password);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(base+'/');
  await page.route('**/api/proyectos/'+fixture.projectId+'/workspace{,/retry}',async route=>{
    if(route.request().method()==='POST'){posts++;state={...state,status:'PENDING',legacy:false,canRetry:false};}else gets++;
    await route.fulfill({status:route.request().method()==='POST'?202:200,contentType:'application/json',body:JSON.stringify(state)});
  });
  const open=async()=>{await page.goto(base+'/proyectos/'+fixture.projectId);await page.locator('.cc-header h1').waitFor();};
  state={...evidence.workspace,status:'PROVISIONING',rootFolderUrl:null};await open();
  const card=page.getByRole('region',{name:'Espacio documental',exact:true});
  await card.getByText('Preparando automáticamente…',{exact:true}).first().waitFor();
  check(rol+': provisioning sin botón manual',await card.getByRole('button',{name:/Configurar|Reintentar/}).count()===0);
  check(rol+': Command Center sigue disponible',await page.locator('.cc-tabs a').count()===5);
  await page.screenshot({path:output+'/'+rol+'-provisioning.png'});
  state={...evidence.workspace};await card.getByText('✓ Configurado',{exact:true}).waitFor();
  check(rol+': READY sin recargar',await card.getByRole('link',{name:/Abrir carpeta/}).getAttribute('href')===evidence.workspace.rootFolderUrl);
  await page.waitForTimeout(2000);const settled=gets;await page.waitForTimeout(2500);
  check(rol+': polling detenido en READY',gets===settled);
  state={...evidence.workspace,status:'ERROR',lastErrorCode:'GOOGLE_UNAVAILABLE',message:'No se pudo preparar automáticamente el espacio documental.',canRetry:true};await open();
  await card.getByText('Configuración incompleta',{exact:true}).waitFor();
  check(rol+': retry según rol',await card.getByRole('button',{name:'Reintentar configuración',exact:true}).count()===(rol==='especialista'?1:0));
  if(rol==='especialista'){
    await card.getByRole('button',{name:'Reintentar configuración',exact:true}).click();await card.getByText('Preparando automáticamente…',{exact:true}).first().waitFor();check('Retry hace command POST',posts===1);
    state={...evidence.workspace};await card.getByText('✓ Configurado',{exact:true}).waitFor();
    state={...evidence.workspace,status:'ERROR',lastErrorCode:'CRUDO_SUBTYPE_REQUIRED',message:'No se pudo preparar el espacio documental: falta definir el subtipo de Crudo.',canRetry:false};await open();
    await card.getByText(/falta definir el subtipo/).waitFor();check('Error de negocio sin retry del Especialista',await card.getByRole('button',{name:'Reintentar configuración',exact:true}).count()===0);
    await page.setViewportSize({width:375,height:812});await page.screenshot({path:output+'/especialista-error-mobile.png'});
    check('Error mobile sin overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    state={...evidence.workspace,id:null,status:'NOT_CONFIGURED',legacy:true,rootFolderUrl:null,canRetry:false};await open();
    await card.getByRole('button',{name:'Configurar espacio',exact:true}).waitFor();check('Legacy única excepción manual',true);
    await page.screenshot({path:output+'/especialista-legacy-mobile.png'});
    await card.getByRole('button',{name:'Configurar espacio',exact:true}).click();await card.getByText('Preparando automáticamente…',{exact:true}).first().waitFor();check('Legacy encola command',posts===2);
  }
  await context.close();
 }
 check('Sin errores JS',errors.length===0);await writeFile(output+'/browser-states.json',JSON.stringify({checks,errors,gets,posts,googleCalls:0,databaseWrites:0},null,2));console.log(JSON.stringify({checks:checks.length,errors:errors.length}));
}finally{await browser.close();}

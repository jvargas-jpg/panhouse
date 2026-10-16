/** Frontend acceptance checks. HTTP fixtures only; never authorizes Google or calls Drive. */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
const modulePath=process.env.PANHOUSE_PLAYWRIGHT_MODULE || join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const {chromium}=await import(pathToFileURL(modulePath));
const base=process.env.PANHOUSE_QA_FRONTEND_URL || 'http://localhost:5173',path='/configuracion/integraciones/google-drive';
const output='docs/evidencias/google-drive',checks=[],errors=[];
const check=(label,condition)=>{assert.ok(condition,label);checks.push({label,passed:true});};
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}});
let role='direccion',statusCalls=0,disconnects=0,failed=false;
let status={provider:'google_drive',configured:true,connected:false,status:'disconnected',health:'unverified',accountEmail:null,scope:[],connectedAt:null,lastValidatedAt:null,lastTestResult:null};
const connected=()=>Object.assign(status,{connected:true,status:'connected',health:'healthy',accountEmail:'corporate@example.test',scope:['https://www.googleapis.com/auth/drive.file'],connectedAt:new Date().toISOString(),lastValidatedAt:new Date().toISOString()});
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url()),action=url.pathname.split('/').at(-1);
  let body={};
  if(url.pathname==='/api/auth/me')body={user:{id:'qa-direction',nombre:'Dirección QA',rol:role,email:'qa@example.test'}};
  else if(url.pathname==='/api/notificaciones')body={notificaciones:[]};
  else if(url.pathname.startsWith('/api/integrations/google-drive/')){
    if(action==='status'){statusCalls++;body=status;}
    if(action==='connect')body={authorizationUrl:base+'/qa-google-oauth'};
    if(action==='test'){
      status.lastTestResult={success:!failed,checkedAt:new Date().toISOString(),cleanedUp:!failed,rootId:'qa-root',rootName:'PANHOUSE_API_TEST_QA_FIXTURE',childId:'qa-child',errorCode:failed?'REAUTH_REQUIRED':null,cleanupErrorCode:failed?'GOOGLE_UNAVAILABLE':null};body=status.lastTestResult;
    }
    if(action==='disconnect'){disconnects++;Object.assign(status,{connected:false,status:'disconnected',health:'unverified',accountEmail:null});body={connected:false,warningCode:null};}
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
});
await page.route('**/qa-google-oauth',route=>route.fulfill({status:200,contentType:'text/html',body:'<h1>OAuth navigation fixture</h1>'}));
try {
  await page.goto(base+path);await page.getByText('No conectado',{exact:true}).waitFor();
  check('Estado desconectado',await page.getByRole('button',{name:'Conectar Google Drive',exact:true}).isEnabled());
  check('Prueba deshabilitada sin conexión',await page.getByRole('button',{name:'Probar conexión'}).isDisabled());
  await page.screenshot({path:output+'/ui-desconectado.png',fullPage:true});
  await page.getByRole('button',{name:'Conectar Google Drive',exact:true}).click();await page.getByRole('heading',{name:'OAuth navigation fixture'}).waitFor();check('Connect navega a URL del backend',true);
  connected();await page.goto(base+path+'?googleDrive=connected');await page.getByText('Google Drive conectado correctamente.',{exact:true}).waitFor();
  check('Callback muestra confirmación y elimina query',!page.url().includes('?'));
  check('Cuenta/estado reales desde status',await page.getByText('corporate@example.test',{exact:true}).isVisible());
  await page.getByRole('button',{name:'Probar conexión'}).click();await page.getByText('Conexión verificada: carpeta y subcarpeta creadas, listadas y eliminadas correctamente.',{exact:true}).waitFor();
  check('Test muestra creación y limpieza',await page.getByText(/Correcta · Limpieza confirmada/).isVisible());
  await page.screenshot({path:output+'/ui-conectado-fixture.png',fullPage:true});
  for(const [name,width,height]of [['tablet',768,1024],['mobile',375,812]]){
    await page.setViewportSize({width,height});check(name+' sin overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    check(name+' controles accesibles',await page.locator('section button:visible').evaluateAll(nodes=>nodes.every(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;})));
    await page.screenshot({path:`${output}/ui-${name}.png`,fullPage:true});
  }
  failed=true;await page.getByRole('button',{name:'Probar conexión'}).click();await page.getByRole('alert').filter({hasText:'La credencial fue revocada'}).waitFor();check('Error y limpieza pendiente visibles',await page.getByText(/Fallida · Limpieza pendiente/).isVisible());
  page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Desconectar',exact:true}).click();check('Cancelar desconexión conserva conexión',disconnects===0);
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Desconectar',exact:true}).click();await page.getByText('Google Drive desconectado correctamente.',{exact:true}).waitFor();check('Confirmar desconexión actualiza status',disconnects===1);
  status.configured=false;await page.reload();await page.getByRole('alert').filter({hasText:'Google Drive integration is not configured.'}).waitFor();check('Sin env bloquea conectar',await page.getByRole('button',{name:'Conectar Google Drive',exact:true}).isDisabled());
  role='especialista';statusCalls=0;await page.reload();await page.getByRole('heading',{name:'Acceso restringido'}).waitFor();
  check('Especialista sin controles de integración',await page.getByRole('button',{name:'Conectar Google Drive',exact:true}).count()===0&&await page.getByRole('link',{name:'Integraciones',exact:true}).count()===0);
  check('Especialista no consulta status',statusCalls===0);
  check('Sin errores JavaScript',errors.length===0);
  check('Google tokens no se guardan en browser storage',await page.evaluate(()=>!Object.keys(localStorage).concat(Object.keys(sessionStorage)).some(key=>/google|token|drive/i.test(key))));
  await writeFile(output+'/frontend-qa.json',JSON.stringify({source:'HTTP fixtures, no Google calls',checks,errors},null,2));
  console.log(JSON.stringify({checks:checks.length,passed:checks.filter(c=>c.passed).length,errors}));
}finally{await browser.close();}

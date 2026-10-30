import { mkdir,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { homedir } from 'node:os';
import assert from 'node:assert/strict';
import { and,eq } from 'drizzle-orm';
import { db,pool } from '../server/db/client.js';
import { users } from '../server/db/schema/index.js';
import { createSession,destroySession } from '../server/helpers/session.js';
import { env } from '../server/config/env.js';

// Lee usuarios/catálogos/proyectos reales. Intercepta el POST de prueba en
// el navegador para verificar el payload sin crear un proyecto de prueba real.
const {chromium}=await import(pathToFileURL(process.env.PANHOUSE_PLAYWRIGHT_MODULE ?? join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const origin=process.env.PANHOUSE_QA_ORIGIN ?? 'http://localhost:5173',output='docs/evidencias/pagos';
await mkdir(output,{recursive:true});
const [user]=await db.select().from(users).where(and(eq(users.rol,'comercial'),eq(users.activo,true))).limit(1);assert.ok(user);
const session=await createSession(user.id),browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},locale:'es-VE',timezoneId:'America/Caracas'});
await context.addCookies([{name:env.SESSION_COOKIE_NAME,value:session,url:origin,httpOnly:true}]);
const page=await context.newPage();page.setDefaultTimeout(25000);
const checks:string[]=[],errors:string[]=[];let intercepted=0,body:Record<string,unknown>={};
page.on('pageerror',(e:Error)=>errors.push(e.message));
await page.route('**/api/proyectos',async(route:any)=>{
  if(route.request().method()!=='POST')return route.continue();
  intercepted++;body=route.request().postDataJSON();
  return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Prueba de interfaz: solicitud interceptada sin crear datos'})});
});
try{
  const catalogos=await(await context.request.get(origin+'/api/catalogos')).json();
  const list=await(await context.request.get(origin+'/api/pagos/proyectos')).json();
  const service=catalogos.servicios.find((s:{codigo:string})=>['EF','CR','SE'].includes(s.codigo));assert.ok(service);
  for(const [width,height,label] of [[1440,900,'desktop'],[768,1024,'tablet'],[375,812,'mobile']] as const){
    await page.setViewportSize({width,height});await page.goto(origin+'/');
    await page.getByRole('button',{name:/Nuevo proyecto/}).first().click();
    const dialog=page.getByRole('dialog',{name:'Crear nuevo proyecto',exact:true});await dialog.waitFor();
    await dialog.getByRole('combobox',{name:'Autoría',exact:true}).click();await dialog.getByRole('option').first().click();
    await dialog.locator('#proyecto-servicio').selectOption(service.codigo);
    await dialog.locator('#proyecto-unidad').selectOption(catalogos.unidades[0].id);
    await dialog.locator('#proyecto-presupuesto').selectOption(catalogos.presupuestos[0].id);
    const amount=dialog.getByLabel('Monto total',{exact:true});
    if(width===1440){await dialog.getByRole('button',{name:'Crear y completar ficha',exact:true}).click();assert.equal(intercepted,0);assert.equal(await amount.evaluate((el:HTMLInputElement)=>el.validity.valueMissing),true);checks.push('El alta requiere monto total en la interfaz');}
    await amount.fill('15.25');await dialog.getByLabel('Moneda del proyecto',{exact:true}).fill('USD');
    await amount.scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/project-total-${label}.png`});
    if(width===1440){await dialog.getByRole('button',{name:'Crear y completar ficha',exact:true}).click();await dialog.getByRole('alert').waitFor();assert.equal(intercepted,1);assert.equal(body.montoContractual,'15.25');assert.equal(body.monedaContractual,'USD');checks.push('El formulario envía el monto total y la moneda al crear');}
    await page.keyboard.press('Escape');
    await page.goto(origin+`/comercial/pagos?project=${list.items[0].id}&contrato=1`);
    const financial=page.getByRole('dialog',{name:'Monto total del proyecto',exact:true});await financial.getByLabel('Monto total',{exact:true}).waitFor();
    assert.equal(await financial.getByLabel('Moneda del proyecto',{exact:true}).inputValue().then((v:string)=>v.length),3);
    await page.screenshot({path:`${output}/project-total-edit-${label}.png`});await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
    checks.push(`${label}: alta y edición del monto accesibles, sin desbordamiento`);
  }
  assert.deepEqual(errors,[]);checks.push('Sin errores JavaScript ni proyectos de prueba guardados en la base real');
  await writeFile(output+'/project-total-report.json',JSON.stringify({checks,errors,interceptedCreateRequests:intercepted,realProjectWrites:0},null,2));
  console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();await destroySession(session);await pool.end();}

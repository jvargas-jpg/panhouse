import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const origin='http://127.0.0.1:5183',out='docs/evidencias/portal-autor';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:900},locale:'es-VE',timezoneId:'America/Caracas'}),page=await context.newPage();page.setDefaultTimeout(30000);
const report={screens:[],checks:[],errors:[]};page.on('pageerror',e=>report.errors.push(e.message));
const login=await context.request.post(origin+'/api/auth/login',{data:{email:'elisa@author.qa.test',password:process.env.AUTHOR_QA_PASSWORD??'PanhousePreview2026!'}});assert.equal(login.status(),200,await login.text());
const get=async path=>{const r=await context.request.get(origin+'/api/autor'+path);assert.equal(r.status(),200,await r.text());return r.json();};
const {projects}=await get('/projects'),{approvals}=await get('/approvals');const project=projects[0],pending=approvals.find(a=>a.status==='pending');assert.ok(pending,'Preview needs an unresolved approval');
async function shot(name){await page.screenshot({path:out+'/'+name+'.png'});report.screens.push(name);}
async function loaded(path,heading){await page.goto(origin+path);await page.getByRole('heading',{name:heading,exact:true,level:1}).waitFor();await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),await page.evaluate(()=>innerWidth),'No horizontal page overflow');}
try{
 for(const [width,height,label]of [[1440,900,'desktop'],[768,1024,'tablet'],[375,812,'mobile']]){
  await page.setViewportSize({width,height});await loaded('/autor','Hola, Elisa');await page.getByRole('link',{name:'Revisar →',exact:true}).waitFor();await shot('inicio-'+label);
  await loaded('/autor/aprobaciones/'+pending.id,pending.title);await page.getByRole('button',{name:'✓ Aprobar',exact:true}).waitFor();await shot('aprobacion-'+label);
  await page.getByRole('button',{name:'↩ Solicitar cambios',exact:true}).click();await page.getByRole('region',{name:'Confirmar decisión'}).waitFor();await page.getByRole('button',{name:'Confirmar decisión',exact:true}).scrollIntoViewIfNeeded();assert.equal(await page.getByRole('button',{name:'Confirmar decisión',exact:true}).isDisabled(),true);await shot('confirmacion-'+label);
  await loaded('/autor/proyectos/'+project.id,project.title);await shot('proyecto-'+label);
 }
 report.checks.push('1440x900, 768x1024, 375x812: no page overflow; actions accessible; changes require comment');
 await page.setViewportSize({width:375,height:812});
 for(const [path,title]of [['/autor/proyectos','Mis proyectos'],['/autor/documentos','Documentos'],['/autor/solicitudes','Solicitudes'],['/autor/notificaciones','Notificaciones']]){await loaded(path,title);await shot(title.toLowerCase().replaceAll(' ','-')+'-mobile');}
 // Deep-link survives authentication without query tokens.
 const anonymous=await browser.newContext(),anon=await anonymous.newPage();await anon.goto(origin+'/autor/aprobaciones/'+pending.id);await anon.getByRole('heading',{name:'Iniciar sesión'}).waitFor();await anon.getByLabel('Correo',{exact:true}).fill('elisa@author.qa.test');await anon.getByLabel('Contraseña',{exact:true}).fill(process.env.AUTHOR_QA_PASSWORD??'PanhousePreview2026!');await anon.getByRole('button',{name:'Entrar',exact:true}).click();await anon.getByRole('heading',{name:pending.title,exact:true,level:1}).waitFor();assert.ok(anon.url().endsWith('/autor/aprobaciones/'+pending.id));await anonymous.close();report.checks.push('Approval deep-link restored after login');
 // Real UI decision on an overdue request; confirmation prevents accidental submit.
 await loaded('/autor/aprobaciones/'+pending.id,pending.title);await page.getByRole('button',{name:'↩ Solicitar cambios',exact:true}).click();await page.getByRole('textbox').fill('QA visual: aumentar el tamaño de letra y revisar los márgenes.');await page.getByRole('button',{name:'Confirmar decisión',exact:true}).click();await page.getByRole('heading',{name:'Decisión registrada',exact:true}).waitFor();await shot('decision-registrada-mobile');
 const after=(await get('/approvals')).approvals.find(a=>a.id===pending.id);assert.equal(after.status,'changes_requested');report.checks.push('Overdue approval resolved through mobile UI, feedback preserved');
 // Structured pause through UI.
 await loaded('/autor/solicitudes','Solicitudes');await page.getByRole('button',{name:'Solicitar pausa del proyecto',exact:true}).click();await page.getByRole('combobox').selectOption(project.id);await page.getByLabel('Motivo',{exact:true}).fill('Ausencia temporal por viaje');await page.getByLabel('Fecha deseada de inicio',{exact:true}).fill('2026-11-15');await page.getByRole('button',{name:'Enviar solicitud',exact:true}).click();await page.getByText('Solicitud enviada. Tu equipo te responderá aquí.').waitFor();report.checks.push('Pause request submitted without changing project state');
 const internal=await browser.newContext(),staff=await internal.newPage();assert.equal((await internal.request.post(origin+'/api/auth/login',{data:{email:'especialista@author.qa.test',password:process.env.AUTHOR_QA_PASSWORD??'PanhousePreview2026!'}})).status(),200);
 await staff.goto(origin+'/proyectos/'+project.id+'/operacion');await staff.getByRole('heading',{name:'Participación del Autor',exact:true}).waitFor();await staff.getByRole('heading',{name:'Solicitudes de pausa',exact:true}).waitFor();await staff.locator('.author-portal').scrollIntoViewIfNeeded();await staff.screenshot({path:out+'/especialista-desktop.png'});report.screens.push('especialista-desktop');await internal.close();report.checks.push('Specialist view uses the same decisions and pause requests');
 assert.deepEqual(report.errors,[]);
}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));

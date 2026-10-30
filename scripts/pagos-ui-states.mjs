// Pruebas de aceptación de frontend con respuestas controladas. No escriben
// en la API real y no se utilizan como evidencia visual de datos productivos.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(pathToFileURL(process.env.PANHOUSE_PLAYWRIGHT_MODULE ?? join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{ width:1440,height:900 },locale:'es-VE',timezoneId:'America/Caracas' });
page.setDefaultTimeout(12000);
const origin = process.env.PANHOUSE_QA_ORIGIN ?? 'http://localhost:5173';
const checks = [], errors = [];
page.on('pageerror',e => errors.push(e.message));
const check = (label,condition) => { assert.ok(condition,label); checks.push(label); };
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let role = 'comercial', listError = false, detailError = false, delayed = false, registerCalls = 0, actions = [];
const projects = [
  { id:id(1),codigo:'QA-A',proyecto:'Proyecto de prueba A',autor:'Autor de prueba A',servicioId:id(10),servicio:'Servicio de prueba',estado:'en_proceso',contractAmount:'10.00',currency:'USD',confirmedPaid:'4.00',pendingAmount:'6.00',paidPercentage:'40.00',paymentStatus:'Parcial',solvencyStatus:'Pendiente',financialGateStatus:'Bloqueado',gateRequired:true,gateSatisfied:false,gateAffectingWorkflow:true,lastPayment:'2026-01-10',pendingPayments:1,currencyMismatch:false },
  { id:id(2),codigo:'QA-B',proyecto:'Proyecto de prueba B',autor:'Autor de prueba B',servicioId:id(10),servicio:'Servicio de prueba',estado:'en_proceso',contractAmount:null,currency:null,confirmedPaid:'0.00',pendingAmount:null,paidPercentage:null,paymentStatus:'Sin monto contractual',solvencyStatus:'Pendiente',financialGateStatus:'No aplicable',gateRequired:false,gateSatisfied:true,gateAffectingWorkflow:false,lastPayment:null,pendingPayments:0,currencyMismatch:false },
  { id:id(3),codigo:'QA-C',proyecto:'Proyecto de prueba C',autor:'Autor de prueba C',servicioId:id(10),servicio:'Servicio de prueba',estado:'en_proceso',contractAmount:'10.00',currency:'USD',confirmedPaid:'12.00',pendingAmount:'0.00',paidPercentage:'120.00',paymentStatus:'Sobrepago',solvencyStatus:'Solvente',financialGateStatus:'Liberado',gateRequired:true,gateSatisfied:true,gateAffectingWorkflow:false,lastPayment:'2026-01-10',pendingPayments:0,currencyMismatch:false },
];
const history = [
  { id:id(20),proyectoId:id(1),monto:'4.00',moneda:'USD',fechaPago:'2026-01-10',metodoPago:'Transferencia',referencia:'REF-QA',notas:'Evidencia de prueba',estatus:'Verificado',motivoRechazo:null,registradoPor:'Comercial de prueba',confirmadoPor:'Comercial de prueba',confirmadoEn:'2026-01-10',anuladoPor:null,anuladoEn:null,motivoAnulacion:null,origen:'INTERNAL_TEMPORARY',tieneComprobante:false },
  { id:id(21),proyectoId:id(1),monto:'1.00',moneda:'USD',fechaPago:'2026-01-11',metodoPago:'Otro',referencia:null,notas:null,estatus:'Pendiente de verificación',motivoRechazo:null,registradoPor:'Comercial de prueba',confirmadoPor:null,confirmadoEn:null,anuladoPor:null,anuladoEn:null,motivoAnulacion:null,origen:'INTERNAL_TEMPORARY',tieneComprobante:false },
  { id:id(22),proyectoId:id(1),monto:'2.00',moneda:'USD',fechaPago:'2026-01-09',metodoPago:'Otro',referencia:null,notas:null,estatus:'Anulado',motivoRechazo:null,registradoPor:null,confirmadoPor:null,confirmadoEn:null,anuladoPor:'Comercial de prueba',anuladoEn:'2026-01-10',motivoAnulacion:'Registro duplicado',origen:'MIGRATED',tieneComprobante:false },
];
await page.route('**/api/**',async route => {
  const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method();
  const send = (body,status=200) => route.fulfill({ status,contentType:'application/json',body:JSON.stringify(body) });
  if (path === '/api/auth/me') return send({ user:{ id:id(99),nombre:'Usuario de prueba',email:'qa@example.test',rol:role,autorId:null } });
  if (path === '/api/notificaciones') return send({ notificaciones:[] });
  if (!path.startsWith('/api/pagos')) return method === 'GET' ? route.continue() : route.abort();
  if (path === '/api/pagos/proyectos' && method === 'GET') {
    if (delayed) await new Promise(r => setTimeout(r,650));
    if (listError) return send({ error:'Error de consulta de prueba' },503);
    const tab = url.searchParams.get('tab');
    const items = tab==='solventes' ? projects.filter(p => p.solvencyStatus==='Solvente') : projects;
    return send({ items,total:items.length,page:1,pageSize:8,kpis:{ conSaldo:13,porConfirmar:1,solventes:1,bloqueados:1 },servicios:[{ id:id(10),nombre:'Servicio de prueba' }] });
  }
  const match = /^\/api\/pagos\/proyectos\/([^/]+)$/.exec(path);
  if (match) {
    if (detailError) return send({ error:'Detalle no disponible' },503);
    const p = projects.find(p => p.id===match[1]);
    return send({ ...p,revision:'2026-01-10T00:00:00.000Z',payments:p.id===id(1) ? history : [],historyPage:1,historyTotal:p.id===id(1) ? history.length : 0,financialNotes:null,solvencyBy:null,solvencyAt:null,auditSummary:[] });
  }
  if (method === 'POST' && path === '/api/pagos') { registerCalls++; const body = req.postDataJSON(); actions.push({ path,body }); await new Promise(r => setTimeout(r,150)); return send({ pago:{ id:id(30) } },201); }
  if (method === 'PATCH' && path === `/api/pagos/proyectos/${id(1)}/contrato`) {
    actions.push({path,body:req.postDataJSON()});
    Object.assign(projects[0],{contractAmount:'20.00',pendingAmount:'16.00',paidPercentage:'20.00'});
    return send(projects[0]);
  }
  if (method !== 'GET') { actions.push({ path,body:req.postDataJSON() }); return send({ ok:true }); }
  return send({ error:'Ruta no esperada' },404);
});
try {
  delayed=true;
  await page.goto(origin+'/comercial/pagos');
  await page.getByText('Consultando proyectos…',{ exact:true }).waitFor();
  await page.locator('.pay-projects tbody tr').first().waitFor(); delayed=false;
  check('Estado de carga visible y datos del backend',await page.locator('.pay-kpis article').first().locator('strong').innerText()==='13');
  await page.locator('.pay-history details').first().waitFor();
  check('Historial: pendiente, confirmado y anulado',await page.locator('.pay-history details').count()===3);
  await page.locator('.pay-history details').first().locator('summary').click();
  check('Referencia y responsables del historial',await page.getByText('REF-QA',{ exact:true }).isVisible());
  await page.locator('.pay-history details').nth(1).locator('summary').click();
  check('Comercial puede confirmar pendientes anteriores',await page.getByRole('button',{ name:'Confirmar',exact:true }).isVisible());
  await page.getByRole('button',{ name:'Ver detalle de Proyecto de prueba B',exact:true }).click();
  await page.getByText('Falta registrar el monto total del proyecto',{ exact:false }).waitFor();
  check('Detalle seleccionado sin monto ni porcentaje',await page.locator('.pay-detail .pay-progress').innerText()==='Sin porcentaje');
  await page.getByRole('button',{ name:'Ver detalle de Proyecto de prueba C',exact:true }).click();
  await page.getByText('Revisar sobrepago:',{ exact:false }).waitFor();
  const progress = page.locator('.pay-detail [role=progressbar]');
  check('Sobrepago: porcentaje real y barra limitada',await progress.getAttribute('aria-valuenow')==='100');
  await page.getByRole('button',{ name:'＋ Registrar pago',exact:true }).first().click();
  const dialog = page.getByRole('dialog',{ name:'Registrar pago',exact:true });
  await dialog.locator('.pay-options>button').first().click();
  await dialog.getByLabel('Monto',{ exact:true }).fill('1.25');
  await dialog.getByLabel('Referencia (opcional)',{ exact:true }).fill('REF-REGISTRO');
  const submit = dialog.getByRole('button',{ name:'Registrar pago',exact:true });
  await submit.click();
  await page.waitForFunction(() => !document.querySelector('dialog'));
  check('Registro envía proyecto, importe decimal e idempotencia',registerCalls===1 && actions[0].body.monto==='1.25' && !!actions[0].body.idempotencyKey);
  role='comercial'; await page.goto(origin+'/comercial/pagos'); await page.locator('.pay-history details').first().waitFor();
  await page.locator('.pay-history details').nth(1).locator('summary').click();
  await page.getByRole('button',{ name:'Confirmar',exact:true }).click();
  await page.getByRole('dialog',{ name:'Confirmar pago',exact:true }).getByRole('button',{ name:'Confirmar pago',exact:true }).click();
  await page.waitForFunction(() => !document.querySelector('dialog'));
  check('Comercial confirma mediante el endpoint canónico',actions.some(a => a.path.endsWith('/verificar') && a.body.estatus==='Verificado'));
  await page.locator('.pay-history details').first().locator('summary').click();
  await page.getByRole('button',{ name:'Anular pago',exact:true }).first().click();
  const voidDialog = page.getByRole('dialog',{ name:'Anular pago',exact:true });
  await voidDialog.getByLabel('Motivo',{ exact:true }).fill('Corrección de registro');
  await voidDialog.getByRole('button',{ name:'Anular pago',exact:true }).click();
  await page.waitForFunction(() => !document.querySelector('dialog'));
  check('Anulación conserva motivo en la solicitud',actions.some(a => a.path.endsWith('/anular') && a.body.motivo==='Corrección de registro'));
  await page.getByRole('button',{ name:'Revisar solvencia',exact:true }).click();
  const solvency = page.getByRole('dialog',{ name:'Revisar solvencia',exact:true });
  await solvency.getByLabel('Solvencia',{ exact:true }).selectOption('Solvente');
  await solvency.getByLabel('Motivo',{ exact:true }).fill('Aprobación administrativa de prueba');
  await solvency.getByRole('button',{ name:'Revisar solvencia',exact:true }).click();
  await page.waitForFunction(() => !document.querySelector('dialog'));
  check('Solvencia envía revisión vigente y aprobación explícita',actions.some(a => a.path.endsWith('/solvencia') && a.body.expectedUpdatedAt && a.body.estado==='Solvente'));
  await page.getByRole('button',{name:'Editar monto total',exact:true}).click();
  const totalDialog=page.getByRole('dialog',{name:'Monto total del proyecto',exact:true});
  await totalDialog.getByLabel('Monto total',{exact:true}).fill('20');
  await totalDialog.getByLabel('Motivo / referencia contractual',{exact:true}).fill('Ampliación acordada');
  await totalDialog.getByRole('button',{name:'Guardar monto total',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('dialog'));
  await page.waitForFunction(()=>document.querySelector('.pay-detail .pay-progress>span')?.textContent==='20%');
  check('Cambiar el monto total actualiza el porcentaje sin recargar',actions.some(a=>a.path.endsWith('/contrato') && a.body.monto==='20' && a.body.expectedUpdatedAt));
  listError=true; await page.reload(); await page.getByText('Error de consulta de prueba',{ exact:true }).waitFor();
  listError=false; await page.locator('.pay-projects').getByRole('button',{ name:'Reintentar',exact:true }).click();
  await page.locator('.pay-projects tbody tr').first().waitFor(); check('Error de lista y recuperación',true);
  detailError=true; await page.getByRole('button',{ name:'Ver detalle de Proyecto de prueba B',exact:true }).click();
  await page.getByText('Detalle no disponible',{ exact:true }).waitFor(); detailError=false;
  await page.locator('.pay-detail').getByRole('button',{ name:'Reintentar',exact:true }).click();
  await page.getByText('Falta registrar el monto total del proyecto',{ exact:false }).waitFor(); check('Error del detalle y recuperación',true);
  await page.getByRole('tab',{ name:'Solventes',exact:true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.pay-projects tbody tr').length===1);
  check('Tabs consumen los resultados filtrados del servidor',true);
  assert.deepEqual(errors,[]); check('Sin errores JavaScript',true);
  await mkdir('docs/evidencias/pagos',{ recursive:true });
  await writeFile('docs/evidencias/pagos/frontend-states-report.json',JSON.stringify({ checks,errors },null,2));
  console.log(JSON.stringify({ passed:checks.length,checks,errors },null,2));
} catch (error) { await page.screenshot({path:'docs/evidencias/pagos/frontend-failure.png'}); throw error; } finally { await browser.close(); }

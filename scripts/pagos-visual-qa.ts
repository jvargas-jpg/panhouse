// App real, sesión válida de Comercial existente y solo lecturas sobre datos
// de desarrollo. Las mutaciones financieras se prueban en la BD de tests.
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { homedir } from 'node:os';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';
import { db, pool } from '../server/db/client.js';
import { users } from '../server/db/schema/index.js';
import { createSession, destroySession } from '../server/helpers/session.js';
import { env } from '../server/config/env.js';

const modulePath = process.env.PANHOUSE_PLAYWRIGHT_MODULE ?? join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const { chromium } = await import(pathToFileURL(modulePath).href);
const origin = process.env.PANHOUSE_QA_ORIGIN ?? 'http://localhost:5173';
const output = 'docs/evidencias/pagos';
await mkdir(output,{ recursive:true });
const [user] = await db.select().from(users).where(and(eq(users.rol,'comercial'),eq(users.activo,true))).limit(1);
assert.ok(user,'Existe un usuario Comercial válido');
const session = await createSession(user.id);
const browser = await chromium.launch({ headless: process.env.PANHOUSE_QA_HEADLESS === 'true' });
const context = await browser.newContext({ viewport:{ width:1440,height:900 },locale:'es-VE',timezoneId:'America/Caracas' });
await context.addCookies([{ name:env.SESSION_COOKIE_NAME,value:session,url:origin,httpOnly:true }]);
const page = await context.newPage();
const report: { checks: string[]; screens: unknown[]; errors: string[] } = { checks:[],screens:[],errors:[] };
page.on('pageerror',(e: Error) => report.errors.push(e.message));
page.setDefaultTimeout(30000);
try {
  const list = await context.request.get(origin + '/api/pagos/proyectos');
  assert.equal(list.status(),200,'Endpoint real disponible');
  const payload = await list.json();
  assert.ok(payload.total>0,'Proyectos reales disponibles');
  for (const [width,height,label] of [[1440,900,'desktop'],[768,1024,'tablet'],[375,812,'mobile']] as const) {
    await page.setViewportSize({ width,height });
    await page.goto(origin + '/comercial/pagos');
    await page.getByRole('heading',{ name:'Pagos',exact:true }).waitFor();
    await page.locator(width<1024 ? '.pay-project-card' : '.pay-projects tbody tr').first().waitFor();
    if (width===1440) await page.locator('.pay-detail-title').waitFor();
    const dimensions = await page.evaluate(() => ({ width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
      tableOverflow:document.querySelector('.pay-table-wrap')!.scrollWidth-document.querySelector('.pay-table-wrap')!.clientWidth }));
    assert.equal(dimensions.scrollWidth,width,label+': sin desbordamiento horizontal');
    await page.screenshot({ path:`${output}/${label}.png` });
    report.screens.push({ label,width,height,...dimensions });
    if (width<1350) {
      await page.locator(width<1024 ? '.pay-project-card' : '.pay-projects tbody tr button').first().click();
      await page.getByRole('dialog',{ name:'Detalle del proyecto',exact:true }).waitFor();
      await page.locator('.pay-mobile-detail .pay-detail-title').waitFor();
      await page.screenshot({ path:`${output}/${label}-detail.png` });
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog').count(),0);
    }
    await page.getByRole('button',{ name:'＋ Registrar pago',exact:true }).first().click();
    const dialog = page.getByRole('dialog',{ name:'Registrar pago',exact:true });
    await dialog.waitFor(); await dialog.locator('.pay-options>button').first().waitFor();
    await dialog.locator('.pay-options>button').first().click();
    await page.screenshot({ path:`${output}/${label}-register.png` });
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(),0);
    report.checks.push(`${label}: selección, detalle, registro, Escape y ancho correcto`);
  }
  await page.setViewportSize({ width:1440,height:900 });
  await page.goto(origin + '/');
  await page.getByRole('link',{ name:'Registrar pago',exact:true }).click();
  await page.getByRole('dialog',{ name:'Registrar pago',exact:true }).waitFor();
  report.checks.push('Quick Action de Inicio abre el registro');
  await page.keyboard.press('Escape');
  await page.getByRole('tab',{ name:'Por confirmar',exact:true }).click();
  await page.getByPlaceholder('Buscar autor, proyecto o código…').fill('sin-resultados-qa-' + crypto.randomUUID());
  await page.getByText('No hay proyectos para estos filtros.',{ exact:true }).waitFor();
  await page.screenshot({ path:`${output}/empty.png` });
  await page.getByRole('tab',{ name:'Todos',exact:true }).click();
  await page.getByPlaceholder('Buscar autor, proyecto o código…').fill('');
  await page.locator('.pay-projects tbody tr').first().waitFor();
  const search = page.getByPlaceholder('Buscar autor, proyecto o código…');
  await search.fill(payload.items[0].codigo);
  await page.waitForResponse((r: { url:()=>string;status:()=>number }) => r.url().includes('search=') && r.status()===200);
  await page.locator('.pay-projects tbody tr').first().waitFor();
  assert.equal(await page.locator('.pay-projects tbody tr').count(),1);
  report.checks.push('Búsqueda por código y filtro de pagos pendientes reales');
  await search.fill('');
  await page.waitForResponse((r: { url:()=>string;status:()=>number }) => r.url().includes('/pagos/proyectos?') && r.status()===200);
  await page.getByRole('button',{ name:'Página siguiente',exact:true }).click();
  await page.waitForResponse((r: { url:()=>string;status:()=>number }) => r.url().includes('page=2') && r.status()===200);
  report.checks.push('Paginación server-side');
  await page.goto(origin + '/comercial/pagos?project=' + payload.items[0].id);
  await page.locator('.pay-detail-title').waitFor();
  const projectResponse = page.waitForResponse((r: { url:()=>string;status:()=>number }) => new URL(r.url()).pathname === '/api/proyectos/' + payload.items[0].id + '/riesgo' && r.status()===200);
  await page.locator('.pay-detail').getByRole('link',{ name:'Ver proyecto',exact:true }).click();
  await projectResponse;
  assert.ok(page.url().includes('/proyectos/' + payload.items[0].id));
  report.checks.push('Ver proyecto abre el proyecto real seleccionado');
  await page.goto(origin + `/proyectos/${payload.items[0].id}/ingreso-comercial?contrato=1`);
  await page.getByRole('heading',{ name:'Monto total del proyecto',exact:true }).waitFor();
  await page.getByRole('button',{ name:/^(Definir|Editar) monto total$/ }).click();
  await page.getByLabel('Monto total',{ exact:true }).fill('1.25');
  await page.getByRole('button',{ name:'Cancelar',exact:true }).click();
  report.checks.push('Ficha contractual accesible; edición y cancelación sin guardar dinero de prueba');
  assert.deepEqual(report.errors,[],'Sin errores JavaScript');
  await writeFile(output + '/real-ui-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally { await browser.close(); await destroySession(session); await pool.end(); }

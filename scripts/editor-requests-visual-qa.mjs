import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PANHOUSE_PLAYWRIGHT_MODULE ?? 'file:///C:/Users/PC/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs');
const origin = process.env.PANHOUSE_QA_ORIGIN ?? 'http://127.0.0.1:5177';
const out = new URL('../docs/evidencias/editor-mis-solicitudes/', import.meta.url); await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-VE', timezoneId: 'America/Caracas' });
const page = await context.newPage(); page.setDefaultTimeout(45000); page.setDefaultNavigationTimeout(120000);
const report = { completed: false, screens: [], checks: [], errors: [] }; page.on('pageerror', e => report.errors.push(e.message));
const login = async (c, email) => assert.equal((await c.request.post(origin + '/api/auth/login', { data: { email, password: 'PanhousePreview2026!' } })).status(), 200);
await login(context, 'editor@edicion.qa.test');
const get = async (c, path) => { const r = await c.request.get(origin + path); assert.equal(r.status(), 200, await r.text()); return r.json(); };
const ready = async () => { await page.getByRole('heading', { name: 'Mis solicitudes', exact: true, level: 1 }).waitFor(); await page.locator('.ms-list[aria-busy=false]').waitFor(); };
const shot = async name => page.screenshot({ path: fileURLToPath(new URL(name + '.png', out)), fullPage: false });
try {
  const portfolio = await get(context, '/api/editores/mis-solicitudes?pageSize=50'); assert.ok(portfolio.total > 10);
  const returned = portfolio.items.find(r => r.status === 'devuelta'); assert.ok(returned);
  for (const [width, height, label] of [[1440, 900, 'desktop'], [768, 1024, 'tablet'], [375, 812, 'mobile']]) {
    await page.setViewportSize({ width, height });
    await page.goto(origin + '/?vista=mis-solicitudes' + (width === 1440 ? '&request=' + returned.id : ''), { waitUntil: 'domcontentloaded' }); await ready();
    if (width === 1440) await page.locator('.ms-detail-header').waitFor();
    const metrics = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewport: innerWidth,
      rowHeights: [...document.querySelectorAll('.ms-table tbody tr')].slice(0, 5).map(e => Math.round(e.getBoundingClientRect().height)),
      overflow: [...document.querySelectorAll('.ms-searchbar,.ms-list,.ms-pagination,.ms-detail-content')].filter(e => e.scrollWidth > e.clientWidth + 2).map(e => e.className) }));
    assert.equal(metrics.documentWidth, width); assert.deepEqual(metrics.overflow, []); if (width === 1440) assert.ok(metrics.rowHeights.every(h => h <= 80));
    await shot(label); report.screens.push({ label, width, height, ...metrics });
    if (width < 1200) {
      await page.locator('.ms-open').first().click(); await page.getByRole('dialog', { name: 'Detalle de solicitud', exact: true }).waitFor(); await page.locator('.ms-detail-header').waitFor();
      const cta = await page.getByRole('button', { name: 'Completar información', exact: true }).boundingBox(); assert.ok(cta && cta.y + cta.height <= height, label + ' CTA visible');
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden'); await shot(label + '-detail');
      await page.locator('.ms-detail-tabs').getByRole('button', { name: 'Historial', exact: true }).click(); await page.getByRole('heading', { name: 'Historial de la solicitud' }).waitFor(); await shot(label + '-history');
      await page.keyboard.press('Escape'); await page.getByRole('dialog', { name: 'Detalle de solicitud', exact: true }).waitFor({ state: 'detached' });
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden'); assert.equal(await page.locator('.ms-open').first().evaluate(e => e === document.activeElement), true);
      report.checks.push(label + ': accessible detail, visible CTA, history, Escape, focus and scroll restoration');
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(origin + '/?vista=mis-solicitudes&request=' + returned.id); await ready(); await page.locator('.ms-detail-header').waitFor();
  assert.equal(await page.locator('.eo-kpis').count(), 0); assert.equal(await page.locator('.ms-detail-tabs').getByText('Conversación', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Completar información', exact: true }).click(); await page.getByLabel('Completar información', { exact: true }).fill('El apartado específico es el capítulo seleccionado y debe conservar su orden narrativo.');
  await page.getByRole('button', { name: 'Responder y reenviar', exact: true }).click(); await page.getByText('Información enviada. La solicitud vuelve a estar pendiente.', { exact: true }).waitFor(); await shot('desktop-resent');
  const refreshed = await get(context, '/api/editores/mis-solicitudes/' + returned.id); assert.equal(refreshed.summary.status, 'pendiente'); assert.ok(refreshed.observations.at(-1).answer);
  await page.locator('.ms-detail-tabs').getByRole('button', { name: 'Respuestas', exact: true }).click(); await page.getByText('El apartado específico es el capítulo seleccionado y debe conservar su orden narrativo.', { exact: true }).last().waitFor(); await shot('desktop-responses');
  report.checks.push('returned request completed through UI, same request ID, persisted response and actor/date');
  const all = await get(context, '/api/editores/mis-solicitudes?pageSize=50');
  const work = await get(context, '/api/editores/mi-trabajo?pageSize=50');
  const candidate = work.items.find(w => w.actionable && w.workItemId && !all.items.some(r => r.workItemId === w.workItemId && r.type === 'editor_apoyo' && ['pendiente', 'en_revision', 'devuelta'].includes(r.status))); assert.ok(candidate);
  await page.getByRole('button', { name: '+ Nueva solicitud', exact: true }).click(); const form = page.locator('.ms-create-content');
  await form.getByLabel('Proyecto', { exact: true }).selectOption(candidate.projectId); await form.getByLabel('Intervención', { exact: true }).selectOption(candidate.workItemId);
  const motivo = 'Validación operativa de solicitud desde la interfaz ' + Date.now(); await form.getByLabel('Motivo', { exact: true }).fill(motivo); await shot('desktop-create');
  await form.getByRole('button', { name: 'Enviar solicitud', exact: true }).click(); await page.waitForURL(u => !!u.searchParams.get('request') && !u.searchParams.get('create')); await page.locator('.ms-detail-header').waitFor(); await ready();
  const createdId = new URL(page.url()).searchParams.get('request'); const created = await get(context, '/api/editores/mis-solicitudes/' + createdId); assert.equal(created.description, motivo);
  const duplicate = await context.request.post(origin + '/api/editores/mis-solicitudes', { data: { workItemId: candidate.workItemId, type: 'editor_apoyo', motivo } }); assert.equal(duplicate.status(), 409);
  await page.getByRole('button', { name: 'Cancelar solicitud', exact: true }).click(); await page.getByRole('dialog', { name: '¿Cancelar esta solicitud?', exact: true }).waitFor(); await shot('desktop-cancel-confirm');
  await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog', { name: '¿Cancelar esta solicitud?', exact: true }).count(), 0); await page.locator('.ms-detail-header').waitFor();
  await page.getByRole('button', { name: 'Cancelar solicitud', exact: true }).click(); await page.getByRole('button', { name: 'Confirmar cancelación', exact: true }).click(); await page.getByText('Solicitud cancelada. Su historial se conserva.', { exact: true }).waitFor();
  assert.equal((await get(context, '/api/editores/mis-solicitudes/' + createdId)).summary.status, 'cancelada'); await shot('desktop-cancelled');
  report.checks.push('UI creation requires project/work, duplicate rejected; confirmation Escape retains detail; cancellation keeps history');
  const chief = await browser.newContext(); await login(chief, 'jefe@edicion.qa.test');
  const pending = (await get(context, '/api/editores/mis-solicitudes?pageSize=50')).items.find(r => r.type === 'editor_apoyo' && r.status === 'pendiente'); assert.ok(pending);
  await page.goto(origin + '/?vista=mis-solicitudes&request=' + pending.id); await ready(); await page.locator('.ms-detail-header').waitFor(); await page.getByRole('button', { name: 'Cancelar solicitud', exact: true }).click();
  const resolve = await chief.request.post(origin + '/api/editores/solicitudes-editor/' + pending.id + '/decidir', { data: { expectedVersion: pending.version, action: 'resolve', text: 'Criterio confirmado: conservar la estructura de la intervención.' } }); assert.equal(resolve.status(), 200, await resolve.text());
  await page.getByRole('button', { name: 'Confirmar cancelación', exact: true }).click(); await page.getByRole('alert').filter({ hasText: /Solo se puede cancelar|cambió/ }).waitFor(); await page.getByRole('heading', { name: 'Resultado', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Cancelar solicitud', exact: true }).count(), 0); await shot('desktop-stale-resolved');
  report.checks.push('chief resolves while Editor has cancellation open; stale write rejected and UI refreshes to read-only result');
  await page.getByLabel('Solicitudes por página').selectOption('10'); await ready(); await page.getByRole('button', { name: 'Página siguiente', exact: true }).click(); await ready(); assert.equal(new URL(page.url()).searchParams.get('page'), '2');
  await page.getByLabel('Ordenar solicitudes').selectOption('newest'); await ready(); assert.equal(new URL(page.url()).searchParams.get('page'), null);
  await page.getByPlaceholder('Buscar solicitud, proyecto o motivo…').fill('ninguna-solicitud-de-qa'); await page.getByText('No hay solicitudes que coincidan con estos filtros.', { exact: true }).waitFor(); await shot('desktop-empty');
  await page.locator('.ms-searchbar').getByRole('button', { name: 'Limpiar filtros', exact: true }).click(); await ready();
  await page.locator('.ms-filters summary').click(); await page.getByLabel('Tipo de solicitud', { exact: true }).selectOption('editor_aclaracion'); await ready();
  assert.ok((await page.locator('.ms-table tbody tr').allTextContents()).every(t => t.includes('Solicitud de aclaración'))); await shot('desktop-filters');
  report.checks.push('pagination, ordering, debounced search, filtered empty state, clear recovery and request type filter');
  await page.goto(origin + '/?vista=mis-solicitudes&request=' + returned.id); await ready(); await page.locator('.ms-detail-header').waitFor();
  const pattern = /\/api\/editores\/mis-solicitudes\/[\da-f-]+$/;
  await page.route(pattern, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary detail failure in QA' }) }));
  await page.reload(); await ready(); await page.getByText('No se pudo cargar la solicitud.', { exact: true }).waitFor(); assert.ok(await page.locator('.ms-table tbody tr').count());
  await page.unroute(pattern); await page.getByRole('button', { name: 'Reintentar solicitud', exact: true }).click(); await page.locator('.ms-detail-header').waitFor();
  report.checks.push('independent detail error and retry retain the list');
  const other = await browser.newContext(); await login(other, 'editor-b@edicion.qa.test');
  assert.equal((await other.request.get(origin + '/api/editores/mis-solicitudes/' + returned.id)).status(), 404);
  assert.equal((await context.request.post(origin + '/api/editores/solicitudes-editor/' + returned.id + '/decidir', { data: { expectedVersion: 1, action: 'resolve', text: 'Editor cannot decide his own request' } })).status(), 403);
  assert.equal((await context.request.post(origin + '/api/editores/mis-solicitudes', { data: { workItemId: candidate.workItemId, type: 'editor_apoyo', motivo, attachment: { fileId: 'outside-request' } } })).status(), 400);
  report.checks.push('Editor B IDOR blocked; own decisions forbidden; arbitrary attachment rejected');
  assert.deepEqual(report.errors, []); report.completed = true;
} finally { await writeFile(new URL('visual-qa.json', out), JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify(report));

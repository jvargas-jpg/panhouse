// Real app + isolated Editor QA API. Screenshots never use mocked work items.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PANHOUSE_PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.PANHOUSE_QA_ORIGIN ?? 'http://127.0.0.1:5176';
const output = new URL('../docs/evidencias/editor-mi-trabajo/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-VE', timezoneId: 'America/Caracas' });
const page = await context.newPage();
page.setDefaultTimeout(45000);
page.setDefaultNavigationTimeout(120000);
const report = { screens: [], checks: [], errors: [] };
page.on('pageerror', error => report.errors.push(error.message));
const login = await context.request.post(origin + '/api/auth/login', { data: { email: 'editor@edicion.qa.test', password: 'PanhousePreview2026!' } });
assert.equal(login.status(), 200, 'Existing isolated Editor QA login');
const ready = async () => {
  await page.getByRole('heading', { name: 'Mi trabajo', exact: true, level: 1 }).waitFor();
  await page.locator('.mw-list[aria-busy=false]').waitFor();
};
const screenshot = async name => {
  await page.screenshot({ path: fileURLToPath(new URL(name + '.png', output)), fullPage: false });
};
try {
  for (const [width, height, label] of [[1440, 900, 'desktop'], [768, 1024, 'tablet'], [375, 812, 'mobile']]) {
    await page.setViewportSize({ width, height });
    await page.goto(origin + '/?vista=mi-trabajo', { waitUntil: 'domcontentloaded' });
    await ready();
    if (width === 1440) {
      await page.locator('.mw-detail-header').waitFor();
      const primary = await page.locator('.mw-work-actions>.ec-primary').boundingBox();
      assert.ok(primary && primary.y + primary.height <= height, 'primary action visible without scrolling detail');
    }
    const metrics = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewport: innerWidth, listWidth: document.querySelector('.mw-list').getBoundingClientRect().width, overflow: [...document.querySelectorAll('.mw-controls,.mw-list,.mw-pagination,.mw-detail-tabs')].filter(el => el.scrollWidth > el.clientWidth + 2).map(el => el.className) }));
    assert.equal(metrics.documentWidth, width, label + ' has no horizontal document overflow');
    assert.deepEqual(metrics.overflow, [], label + ' has no clipped controls');
    await screenshot(label);
    report.screens.push({ width, height, label, ...metrics });
    await page.locator('.mw-filters summary').click();
    await screenshot(label + '-filters');
    assert.ok(await page.getByLabel('Servicio', { exact: true }).isVisible());
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.mw-filters').getAttribute('open'), null);
    report.checks.push(label + ': filters open and close with Escape');
    if (width < 1200) {
      await page.locator('.eo-row-action').first().click();
      const detail = page.getByRole('dialog', { name: 'Detalle de la intervención', exact: true });
      await detail.waitFor();
      await page.locator('.mw-detail-header').waitFor();
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      await screenshot(label + '-detail');
      await detail.locator('.mw-extra-context summary').click();
      await detail.getByText('Editor asignado', { exact: true }).waitFor();
      await detail.locator('.mw-extra-context summary').click();
      await detail.getByRole('button', { name: 'Historial', exact: true }).click();
      await detail.getByRole('heading', { name: 'Historial de esta intervención' }).waitFor();
      await page.keyboard.press('Escape');
      await detail.waitFor({ state: 'detached' });
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
      report.checks.push(label + ': accessible detail opens, changes content and closes with focus restored');
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(origin + '/?vista=mi-trabajo'); await ready();
  const selected = page.locator('tr[aria-selected=true]');
  assert.equal(await selected.count(), 1);
  await page.locator('.eo-detail-title button').click();
  await page.locator('.eo-detail-placeholder').waitFor();
  await page.locator('.eo-work-table tbody tr').first().focus();
  await page.keyboard.press('Enter'); await page.locator('.mw-detail-header').waitFor();
  report.checks.push('desktop selection, close and keyboard selection');
  for (const label of ['Material', 'Entregas', 'Feedback', 'Historial', 'Resumen']) {
    await page.locator('.mw-detail-tabs').getByRole('button', { name: label, exact: true }).click();
  }
  report.checks.push('all five detail sections change without navigation');
  await page.getByRole('button', { name: /^Bloqueadas/ }).click(); await ready();
  const states = await page.locator('.eo-work-table tbody .ec-status').allTextContents();
  assert.ok(states.every(state => state === 'Bloqueada'));
  await screenshot('desktop-blocked');
  report.checks.push('blocked tab is server filtered');
  await page.getByRole('button', { name: /^Todos/ }).click(); await ready();
  await page.getByLabel('Ordenar intervenciones').selectOption('project'); await ready();
  assert.ok(page.url().includes('sort=project'));
  await page.getByLabel('Intervenciones por página').selectOption('25'); await ready();
  assert.ok(page.url().includes('pageSize=25'));
  report.checks.push('sorting and page size are preserved in URL');
  await page.getByPlaceholder('Buscar por proyecto, autor o trabajo…').fill('ninguna-intervencion-qa-coincide');
  await page.getByText('No tienes intervenciones asignadas con estos filtros.', { exact: true }).waitFor();
  await screenshot('desktop-empty');
  await page.locator('.mw-active-filters').getByRole('button', { name: 'Limpiar filtros' }).click(); await ready();
  assert.ok(await page.locator('.eo-work-table tbody tr').count());
  report.checks.push('debounced server search, empty state and clear filters');
  const detailPattern = /\/api\/editores\/mi-trabajo\/[\da-f-]+$/;
  await page.route(detailPattern, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'QA detail unavailable' }) }));
  await page.reload(); await ready();
  await page.getByText('No se pudo cargar la intervención.', { exact: true }).waitFor();
  assert.ok(await page.locator('.eo-work-table tbody tr').count());
  await page.unroute(detailPattern);
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await page.locator('.mw-detail-header').waitFor();
  report.checks.push('detail error is isolated from list and contextual retry recovers');
  const work = await (await context.request.get(origin + '/api/editores/mi-trabajo?pageSize=50')).json();
  const actionable = work.items.find(i => i.actionable && i.state !== 'Bloqueadas');
  if (actionable) {
    await page.goto(origin + '/?vista=mi-trabajo&workItem=' + actionable.id); await ready();
    await page.getByRole('button', { name: 'Reportar bloqueo', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Reportar bloqueo', exact: true });
    await dialog.waitFor();
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('Tab');
      assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
    }
    await screenshot('desktop-blocker-dialog');
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    assert.ok(await page.locator('.mw-detail-header').isVisible());
    await page.getByRole('button', { name: 'Solicitar apoyo', exact: true }).click();
    await page.getByRole('button', { name: 'Solicitar reasignación', exact: true }).click();
    await screenshot('desktop-support-dialog');
    await page.keyboard.press('Escape');
    report.checks.push('blocker and support/reassignment dialogs trap focus and Escape preserves detail');
  }
  // Execute the work actions through UI; the seed/API is an isolated local DB.
  const candidate = work.items.find(i => i.actionable && !i.startedAt && i.state !== 'Bloqueadas') ?? actionable;
  if (candidate) {
    await page.goto(origin + '/?vista=mi-trabajo&workItem=' + candidate.id); await ready();
    if (!candidate.startedAt) {
      await page.getByRole('button', { name: 'Iniciar trabajo', exact: true }).click();
      await page.getByText('Trabajo iniciado.', { exact: true }).waitFor();
      report.checks.push('UI start persists startedAt and derives SLA in API');
    }
    const note = 'QA Mi trabajo: verificación operativa ' + Date.now();
    await page.getByRole('button', { name: 'Registrar avance', exact: true }).click();
    await page.getByLabel('Observación del avance', { exact: true }).fill(note);
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByText('Avance registrado.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reportar bloqueo', exact: true }).click();
    await page.getByLabel('Motivo del bloqueo', { exact: true }).fill(note);
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByText('Bloqueo reportado.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Registrar resolución', exact: true }).click();
    await page.getByLabel('Resolución del bloqueo', { exact: true }).fill('Material disponible; se puede continuar la edición.');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByText('Bloqueo resuelto.', { exact: true }).waitFor();
    const persisted = await (await context.request.get(origin + '/api/editores/mi-trabajo/' + candidate.id)).json();
    assert.equal(persisted.blocker, null);
    assert.ok(persisted.item.startedAt);
    assert.ok(persisted.history.some(h => h.label.includes(note)));
    report.checks.push('UI advance, report blocker and resolve persist in real API and history');
    const requests = await (await context.request.get(origin + '/api/editores/mis-solicitudes?pageSize=50')).json();
    const requestTypes = [['editor_apoyo', 'Solicitar apoyo'], ['editor_reasignacion', 'Solicitar reasignación'], ['editor_aclaracion', 'Solicitar aclaración']];
    const available = requestTypes.find(([type]) => !requests.items.some(r => r.workItemId === candidate.id && r.type === type && ['pendiente', 'en_revision', 'devuelta'].includes(r.status)));
    if (available) {
      await page.getByRole('button', { name: 'Solicitar apoyo', exact: true }).click();
      const requestDialog = page.getByRole('dialog', { name: 'Solicitar apoyo o reasignación', exact: true });
      await requestDialog.getByRole('button', { name: available[1], exact: true }).click();
      await requestDialog.getByLabel('Motivo', { exact: true }).fill(note);
      await requestDialog.getByRole('button', { name: 'Enviar solicitud', exact: true }).click();
      await page.getByText('Solicitud enviada.', { exact: true }).waitFor();
      const sent = (await (await context.request.get(origin + '/api/editores/mis-solicitudes?pageSize=50')).json()).items.find(r => r.motivo === note);
      assert.ok(sent);
      assert.equal(sent.workItemId, candidate.id);
      const cancel = await context.request.post(origin + '/api/editores/mis-solicitudes/' + sent.id + '/cancelar', { data: { expectedVersion: sent.version } });
      assert.equal(cancel.status(), 200);
      report.checks.push('UI contextual request persists work item and destination; QA request cleaned up');
    }
  }
  const waiting = work.items.find(i => i.waitingOn);
  if (waiting) {
    await page.goto(origin + '/?vista=mi-trabajo&workItem=' + waiting.id); await ready();
    await page.getByText('Esta espera no se cuenta como atraso tuyo.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Registrar entrega', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Reportar bloqueo', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Solicitar apoyo', exact: true }).count(), 0);
    await screenshot('desktop-waiting');
    report.checks.push('waiting detail shows paused SLA and no invalid execution/request actions');
  }
  await page.setViewportSize({ width: 375, height: 812 });
  if (actionable) {
    await page.goto(origin + '/?vista=mi-trabajo&workItem=' + actionable.id); await ready();
    await page.locator('.mw-detail-header').waitFor();
    await page.getByRole('button', { name: 'Reportar bloqueo', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Reportar bloqueo', exact: true });
    await modal.waitFor();
    await screenshot('mobile-blocker-dialog');
    await page.keyboard.press('Escape'); await modal.waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('dialog', { name: 'Detalle de la intervención', exact: true }).count(), 1);
    report.checks.push('mobile nested modal Escape preserves detail');
  }
  assert.deepEqual(report.errors, []);
  await writeFile(new URL('qa.json', output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }

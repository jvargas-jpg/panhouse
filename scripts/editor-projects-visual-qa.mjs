import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PANHOUSE_PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.PANHOUSE_QA_ORIGIN ?? 'http://127.0.0.1:5176';
const output = new URL('../docs/evidencias/editor-mis-proyectos/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-VE', timezoneId: 'America/Caracas' });
const page = await context.newPage(); page.setDefaultTimeout(45000); page.setDefaultNavigationTimeout(120000);
const report = { screens: [], checks: [], errors: [] };
page.on('pageerror', e => report.errors.push(e.message));
const login = await context.request.post(origin + '/api/auth/login', { data: { email: 'editor@edicion.qa.test', password: 'PanhousePreview2026!' } });
assert.equal(login.status(), 200);
const get = async path => { const r = await context.request.get(origin + path); assert.equal(r.status(), 200, await r.text()); return r.json(); };
const portfolio = await get('/api/editores/mis-proyectos?pageSize=50');
const selected = portfolio.items.find(p => p.code === 'PORT-ALL') ?? portfolio.items[0]; assert.ok(selected);
const ready = async () => { await page.getByRole('heading', { name: 'Mis proyectos', exact: true, level: 1 }).waitFor(); await page.locator('.mp-list[aria-busy=false]').waitFor(); };
const shot = async name => page.screenshot({ path: fileURLToPath(new URL(name + '.png', output)), fullPage: false });
try {
  for (const [width, height, label] of [[1440, 900, 'desktop'], [768, 1024, 'tablet'], [375, 812, 'mobile']]) {
    await page.setViewportSize({ width, height });
    await page.goto(origin + '/?vista=mis-proyectos' + (width === 1440 ? '&project=' + selected.projectId : ''), { waitUntil: 'domcontentloaded' }); await ready();
    if (width === 1440) {
      await page.locator('.mp-detail-header').waitFor();
      const action = await page.locator('.mp-detail-actions>.ec-primary').boundingBox();
      assert.ok(action && action.y + action.height <= height, 'desktop action remains visible in detail');
    }
    const metrics = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewport: innerWidth, rows: document.querySelectorAll('.mp-project-table tbody tr').length,
      rowHeights: [...document.querySelectorAll('.mp-project-table tbody tr')].slice(0, 5).map(el => Math.round(el.getBoundingClientRect().height)),
      overflow: [...document.querySelectorAll('.mp-toolbar,.mp-list,.mp-pagination,.mp-detail-content')].filter(el => el.scrollWidth > el.clientWidth + 2).map(el => el.className) }));
    assert.equal(metrics.documentWidth, width); assert.deepEqual(metrics.overflow, []);
    if (width === 1440) assert.ok(metrics.rowHeights.every(h => h <= 90));
    await shot(label); report.screens.push({ width, height, label, ...metrics });
    if (width < 1200) {
      await page.locator('.mp-open-project').first().click();
      const detail = page.getByRole('dialog', { name: 'Mi participación en el proyecto', exact: true });
      await detail.waitFor(); await page.locator('.mp-detail-header').waitFor();
      const action = await detail.locator('.mp-detail-actions>.ec-primary').boundingBox();
      assert.ok(action && action.y + action.height <= height, label + ' action remains visible');
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      await shot(label + '-detail');
      await detail.getByRole('button', { name: 'Intervenciones', exact: true }).click();
      await detail.getByRole('heading', { name: 'Mis intervenciones en este proyecto', exact: true }).waitFor();
      await page.keyboard.press('Escape'); await detail.waitFor({ state: 'detached' });
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
      assert.equal(await page.locator('.mp-open-project').first().evaluate(el => el === document.activeElement), true);
      report.checks.push(label + ': detail opens, switches sections, closes with Escape and restores focus/scroll');
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(origin + '/?vista=mis-proyectos&project=' + selected.projectId); await ready(); await page.locator('.mp-detail-header').waitFor();
  assert.equal(await page.locator('.eo-kpis,.eo-project-grid,.eo-view-toggle').count(), 0);
  await page.getByRole('button', { name: 'Intervenciones', exact: true }).click();
  const links = page.locator('.mp-work-list a'); assert.ok(await links.count() >= 12);
  const href = await links.last().getAttribute('href'); const target = new URL(href, origin); assert.equal(target.searchParams.get('vista'), 'mi-trabajo');
  assert.equal(target.searchParams.get('project'), selected.projectId); assert.ok(target.searchParams.get('workItem'));
  await shot('desktop-interventions');
  await links.last().scrollIntoViewIfNeeded(); await shot('desktop-interventions-end');
  await links.last().click(); await page.getByRole('heading', { name: 'Mi trabajo', exact: true, level: 1 }).waitFor();
  await page.locator('.mw-detail-header').waitFor(); assert.equal(new URL(page.url()).searchParams.get('workItem'), target.searchParams.get('workItem'));
  report.checks.push('all twelve interventions are visible in detail and exact work-item deep link opens Mi trabajo');
  await page.goto(origin + '/?vista=mis-proyectos&project=' + selected.projectId); await ready(); await page.locator('.mp-detail-header').waitFor();
  for (const [tab, message] of [['Material', 'Este proyecto aún no tiene espacio documental de Edición disponible.'], ['Entregas', 'Aún no has registrado entregas en este proyecto.'], ['Feedback', 'No hay feedback registrado en este proyecto.']]) {
    await page.locator('.mp-detail-tabs').getByRole('button', { name: tab, exact: true }).click(); await page.getByText(message, { exact: true }).waitFor(); await shot('desktop-' + tab.toLowerCase());
  }
  report.checks.push('material, deliveries and feedback render honest empty states without broken Drive buttons');
  await page.getByLabel('Proyectos por página').selectOption('10'); await ready();
  assert.ok(portfolio.total > 10);
  await page.getByRole('button', { name: 'Página siguiente', exact: true }).click(); await ready(); assert.equal(new URL(page.url()).searchParams.get('page'), '2');
  await page.getByLabel('Ordenar proyectos').selectOption('title'); await ready(); assert.equal(new URL(page.url()).searchParams.get('page'), null);
  report.checks.push('server pagination and sorting preserve URL state and reset page correctly');
  await page.getByPlaceholder('Buscar proyecto, autor o código…').fill('PORT-ALL');
  await page.waitForURL(url => url.searchParams.get('search') === 'PORT-ALL'); await ready();
  assert.equal(await page.locator('.mp-project-table tbody tr').count(), 1);
  await page.getByPlaceholder('Buscar proyecto, autor o código…').fill('ningun-proyecto-portafolio-qa');
  await page.getByText('No hay proyectos que coincidan con estos filtros.', { exact: true }).waitFor(); await shot('desktop-empty-filtered');
  await page.locator('.mp-toolbar').getByRole('button', { name: 'Limpiar filtros' }).click(); await ready();
  assert.ok(await page.locator('.mp-project-table tbody tr').count());
  report.checks.push('debounced search includes code, filtered empty state and clear recovery');
  await page.getByLabel('Estado editorial').selectOption('Esperando autor'); await ready();
  assert.ok((await page.locator('.mp-project-table tbody tr').allTextContents()).every(text => text.includes('Esperando autor')));
  await shot('desktop-waiting');
  await page.locator('.mp-toolbar').getByRole('button', { name: 'Limpiar filtros' }).click(); await ready();
  await page.getByLabel('Mi participación', { exact: true }).selectOption('history'); await ready();
  const historicalRows = await page.locator('.mp-project-table tbody tr').count(); assert.ok(historicalRows > 0);
  await page.locator('.mp-open-project').first().click(); await page.locator('.mp-detail-header').waitFor();
  assert.equal(await page.locator('.mp-detail-actions a').count(), 0); await shot('desktop-history');
  report.checks.push('historical participation is explicit and has no live Drive or execution actions');
  await page.goto(origin + '/?vista=mis-proyectos&project=' + selected.projectId); await ready(); await page.locator('.mp-detail-header').waitFor();
  await page.locator('.eo-detail-title button').click(); await page.locator('.mp-placeholder').waitFor();
  await page.locator('.mp-project-table tbody tr').first().focus(); await page.keyboard.press('Enter'); await page.locator('.mp-detail-header').waitFor();
  report.checks.push('row keyboard selection and close retain the portfolio');
  const pattern = /\/api\/editores\/mis-proyectos\/[\da-f-]+$/;
  await page.route(pattern, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'QA temporary detail error' }) }));
  await page.reload(); await ready(); await page.getByText('No se pudo cargar el proyecto.', { exact: true }).waitFor();
  assert.ok(await page.locator('.mp-project-table tbody tr').count());
  await page.unroute(pattern); await page.getByRole('button', { name: 'Reintentar proyecto', exact: true }).click(); await page.locator('.mp-detail-header').waitFor();
  report.checks.push('detail failure is independent; contextual retry restores it');
  const outsider = await browser.newContext();
  assert.equal((await outsider.request.post(origin + '/api/auth/login', { data: { email: 'editor-b@edicion.qa.test', password: 'PanhousePreview2026!' } })).status(), 200);
  assert.equal((await outsider.request.get(origin + '/api/editores/mis-proyectos/' + selected.projectId)).status(), 404); await outsider.close();
  report.checks.push('real API rejects another editor reading the selected project');
  assert.deepEqual(report.errors, []);
  await writeFile(new URL('visual-qa.json', output), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await browser.close(); }

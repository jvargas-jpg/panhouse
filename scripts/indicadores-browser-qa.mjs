import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(
  pathToFileURL(
    join(tmpdir(), 'panhouse-browser-qa/node_modules/playwright/index.mjs'),
  )
);
const folder = 'docs/evidencias/indicadores-jefatura';
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  storageState: join(tmpdir(), 'panhouse-browser-qa/state-indicadores.json'),
  acceptDownloads: true,
});
const page = await context.newPage(),
  checks = [],
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const url = 'http://localhost:5177/?vista=indicadores';
const ready = async () => {
  await page.locator('.ji-kpi strong').first().waitFor();
  await page.waitForTimeout(500);
};
const check = (name, condition) => {
  assert.ok(condition, name);
  checks.push({ name, passed: true });
};
for (const [name, width, height] of [
  ['desktop', 1536, 1024],
  ['laptop', 1366, 768],
  ['tablet', 768, 1024],
  ['mobile', 375, 812],
]) {
  await page.setViewportSize({ width, height });
  await page.goto(url);
  await ready();
  check(
    `${name}: no horizontal document overflow`,
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.evaluate(() =>
    document.querySelectorAll('div').forEach((e) => {
      if (e.scrollTop) e.scrollTop = 0;
    }),
  );
  await page.screenshot({ path: `${folder}/${name}-despues.png` });
  await page.locator('.ji-team-card').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${folder}/${name}-equipo.png` });
  for (const label of ['Equipo y capacidad', 'Tiempos y SLA']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await ready();
    check(
      `${name}: ${label} without overflow`,
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    if (name === 'desktop')
      await page.screenshot({
        path: `${folder}/${label.startsWith('Equipo') ? 'capacidad' : 'tiempos'}-desktop.png`,
      });
  }
}
await page.setViewportSize({ width: 1536, height: 1024 });
await page.goto(url);
await ready();
const api = await context.request.get(
  'http://localhost:5177/api/jefatura/indicadores',
);
const data = await api.json();
check(
  'Native snapshot matches KPI',
  (await page.locator('.ji-kpi strong').first().textContent()) ===
    String(data.resumen.activos),
);
const firstProjectPage = await page
  .locator('.ji-detail-table tbody')
  .innerText();
await page.getByLabel('Página siguiente de proyectos').click();
check('Detail pagination changes URL', page.url().includes('paginaDetalle=2'));
check(
  'Detail pagination changes project rows',
  (await page.locator('.ji-detail-table tbody').innerText()) !==
    firstProjectPage,
);
await page.reload();
await ready();
check('Detail page survives reload', page.url().includes('paginaDetalle=2'));
await page.getByRole('button', { name: '6 meses', exact: true }).click();
check('Horizon persists in URL', page.url().includes('meses=6'));
await page.reload();
await ready();
check(
  'Horizon survives reload',
  (await page
    .getByRole('button', { name: '6 meses', exact: true })
    .getAttribute('aria-pressed')) === 'true',
);
await page
  .getByLabel('Servicio', { exact: true })
  .selectOption(data.catalogos.servicios[0].id);
await ready();
await page.waitForFunction(
  () => document.querySelector('.ji-kpi strong')?.textContent !== '26',
);
check('Service filter applied', page.url().includes('servicio='));
await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
await ready();
await page.getByLabel('Prioridad', { exact: true }).selectOption('confirmado');
await page.waitForFunction(
  () => document.querySelector('.ji-kpi strong')?.textContent === '1',
);
check('Confirmed Express filter applied', true);
await page
  .getByLabel('Especialista', { exact: true })
  .selectOption('sin_asignar');
await page
  .getByText('No hay proyectos con estos filtros.', { exact: false })
  .waitFor();
check('Empty selection displayed', true);
await page.screenshot({ path: `${folder}/vacio.png` });
await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
await ready();
await page.getByLabel('Buscar especialista en la tabla').fill('Beatriz');
check(
  'Local team search',
  (await page.locator('.ji-team-table tbody tr').count()) === 1,
);
await page.getByLabel('Buscar especialista en la tabla').fill('');
await page.locator('.ji-person').filter({ hasText: 'Beatriz Campos' }).click();
check('Specialist detail preserved in URL', page.url().includes('detalle='));
await page.getByRole('tab', { name: /Cierres del/ }).click();
check('Closing detail tab', page.url().includes('detalleGrupo=cierres'));
const projectLink = page.locator('.ji-detail-table a').first();
check(
  'Closing detail contains an audited project',
  (await projectLink.count()) === 1,
);
if (await projectLink.count()) {
  check(
    'Project link uses native detail route',
    (await projectLink.getAttribute('href')).startsWith('/proyectos/'),
  );
  const href = await projectLink.getAttribute('href');
  const id = href.split('/proyectos/')[1].split('?')[0];
  check(
    'Native project detail is accessible to Jefatura',
    (
      await context.request.get(
        `http://localhost:5177/api/proyectos/${id}/riesgo`,
      )
    ).status() === 200,
  );
  await projectLink.click();
  await page.waitForURL('**/proyectos/**');
  check('Project navigation works', page.url().includes(`/proyectos/${id}`));
  await page.goBack();
  await ready();
}
const downloadPromise = page.waitForEvent('download');
await page.getByRole('button', { name: 'Exportar CSV', exact: true }).click();
const download = await downloadPromise,
  output = join(tmpdir(), 'panhouse-browser-qa/indicadores-export.csv');
await download.saveAs(output);
const csv = await readFile(output, 'utf8');
check(
  'CSV real route includes all specialists',
  data.equipo.every((e) => csv.includes(e.nombre)),
);
check('CSV has UTF-8 BOM', csv.charCodeAt(0) === 0xfeff);
await page.evaluate(() => {
  window.__printed = false;
  window.print = () => {
    window.__printed = true;
  };
});
await page
  .getByRole('button', { name: 'Imprimir reporte', exact: true })
  .click();
check('Print action works', await page.evaluate(() => window.__printed));
await page.emulateMedia({ media: 'print' });
await page.locator('.ji-print-period').waitFor();
check(
  'Print is not clipped by application viewport',
  await page.evaluate(
    () =>
      getComputedStyle(document.documentElement).overflowY === 'visible' &&
      document.documentElement.scrollHeight > innerHeight,
  ),
);
await page.screenshot({ path: `${folder}/impresion.png`, fullPage: true });
check(
  'Print includes period and hides navigation',
  (await page.locator('.ji-tabs').isHidden()) &&
    (await page.locator('.ji-print-period').isVisible()),
);
await page.emulateMedia({ media: 'screen' });
const errorPage = await context.newPage();
await errorPage.route('**/api/jefatura/indicadores*', async (r) => {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await r.continue();
});
await errorPage.goto(url);
await errorPage.getByRole('status', { name: 'Cargando indicadores' }).waitFor();
check('Loading state appears', true);
await errorPage.screenshot({ path: `${folder}/cargando.png` });
await errorPage.locator('.ji-kpi strong').first().waitFor();
await errorPage.unroute('**/api/jefatura/indicadores*');
await errorPage.route('**/api/jefatura/indicadores*', (r) =>
  r.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Error temporal de QA' }),
  }),
);
await errorPage.goto(url);
await errorPage
  .getByRole('heading', { name: 'No pudimos cargar los indicadores' })
  .waitFor({ timeout: 25000 });
await errorPage.screenshot({ path: `${folder}/error.png` });
check('Error state appears', true);
await errorPage.unroute('**/api/jefatura/indicadores*');
await errorPage
  .getByRole('button', { name: 'Reintentar', exact: true })
  .click();
await errorPage.locator('.ji-kpi strong').first().waitFor();
check('Retry recovers real data', true);
check('No browser runtime errors', errors.length === 0);
await writeFile(
  `${folder}/verificacion-browser.json`,
  JSON.stringify(
    {
      environment:
        'Disposable panhouse_indicadores_qa; synthetic fixtures only',
      checks,
      errors,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ checks: checks.length, errors }));
await browser.close();

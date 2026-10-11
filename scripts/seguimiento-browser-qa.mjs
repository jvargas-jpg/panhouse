import assert from 'node:assert/strict';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    join(tmpdir(), 'panhouse-browser-qa/node_modules/playwright/index.mjs'),
  ).href
);
const out = resolve('docs/evidencias/seguimiento-jefatura');
await mkdir(out, { recursive: true });
const cycle = process.env.QA_CYCLE ?? '1',
  base = 'http://localhost:5176';
const cases = JSON.parse(
  await readFile(
    join(tmpdir(), 'panhouse-browser-qa/cases-seguimiento.json'),
    'utf8',
  ),
);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: join(tmpdir(), 'panhouse-browser-qa/state-seguimiento.json'),
});
const page = await context.newPage();
const errors = [];
const checks = [];
page.on('pageerror', (e) => errors.push(e.message));
async function open(mode = 'general', extra = '') {
  await page.goto(`${base}/?vista=seguimiento&modo=${mode}${extra}`);
  await page.locator('.js-list').waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function capture(name) {
  const path = join(out, `${name}-${cycle}.png`);
  if (
    cycle === '1' &&
    (await access(path).then(
      () => true,
      () => false,
    ))
  )
    return;
  await page.screenshot({ path });
}
async function overflow(name) {
  const m = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    drawer: document.querySelector('.js-drawer')?.getBoundingClientRect().width,
  }));
  assert.ok(m.scroll <= m.width, `${name}: ${JSON.stringify(m)}`);
  checks.push({ name, ...m });
}
try {
  await open();
  await capture('general-desktop');
  const fonts=await page.evaluate(()=>({header:parseFloat(getComputedStyle(document.querySelector('.jf-page-header h1')).fontSize),table:parseFloat(getComputedStyle(document.querySelector('.js-table')).fontSize)}));
  assert.ok(fonts.header>=24 && fonts.header<=28,`Header font ${fonts.header}`);
  assert.ok(fonts.table>=13 && fonts.table<=14,`Table font ${fonts.table}`);
  await overflow('General desktop');
  await open('correccion');
  await capture('intervenciones-desktop');
  await overflow('Intervenciones desktop');
  await page.goto(
    `${base}/?vista=seguimiento&modo=general&detalle=${cases.A.proyectoId}`,
  );
  await page.locator('.js-drawer-context').waitFor();
  await capture('general-drawer');
  await overflow('General drawer');
  for (const key of [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
    'F2',
  ]) {
    const c = cases[key];
    await open('correccion', `&intervencion=${c.origen}:${c.id}`);
    await page.locator('.js-supervision').waitFor();
    await capture(`drawer-${key}`);
    await overflow(`Drawer ${key}`);
    assert.equal(
      await page
        .getByRole('button', {
          name: /^(Iniciar|Entregar|Asignar corrector|Aprobar)/,
        })
        .count(),
      0,
    );
    if (key === 'B')
      assert.equal(
        await page
          .getByRole('heading', { name: 'Seguimiento freelance', exact: true })
          .count(),
        1,
      );
    if (key === 'I')
      assert.equal(
        await page
          .getByText('Revisión previa de tripa >120 páginas:', { exact: false })
          .count(),
        1,
      );
    if (key === 'F')
      assert.equal(
        await page
          .getByLabel('Evaluación de seguimiento', { exact: true })
          .count(),
        1,
      );
    if (key === 'M')
      assert.ok(
        (await page.getByText('Sin SLA definido', { exact: true }).count()) > 0,
      );
    await page.locator('.js-supervision').scrollIntoViewIfNeeded();
    await capture(`drawer-${key}-supervision`);
  }
  await page.setViewportSize({ width: 768, height: 1024 });
  const legacyResponse = await context.request.get(
    `${base}/api/seguimiento/intervenciones?origen=legacy`,
  );
  assert.equal(legacyResponse.status(), 200);
  const legacy = (await legacyResponse.json()).items[0];
  assert.ok(legacy);
  await page.setViewportSize({ width: 1440, height: 900 });
  await open('correccion', `&intervencion=legacy:${legacy.id}`);
  await page
    .getByRole('heading', { name: 'Datos del registro anterior', exact: true })
    .waitFor();
  await page
    .getByRole('heading', { name: 'Datos del registro anterior', exact: true })
    .scrollIntoViewIfNeeded();
  await capture('drawer-legacy');
  await overflow('Legacy values and missing-hour precision');
  await page.setViewportSize({ width: 768, height: 1024 });
  await open();
  await capture('general-tablet');
  await overflow('General tablet');
  await open('correccion');
  await capture('intervenciones-tablet');
  await overflow('Intervenciones tablet');
  await page.setViewportSize({ width: 375, height: 812 });
  await open();
  await capture('general-mobile');
  await overflow('General mobile');
  await open('correccion');
  await capture('intervenciones-mobile');
  await overflow('Intervenciones mobile');
  await open('correccion', `&intervencion=${cases.B.origen}:${cases.B.id}`);
  await page.locator('.js-supervision').waitFor();
  await capture('freelance-mobile');
  await overflow('Mobile drawer');
  await page.keyboard.press('Escape');
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden' });
  assert.deepEqual(errors, []);
  await writeFile(
    join(out, `qa-${cycle}.json`),
    JSON.stringify({ cycle, checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ cycle, checks: checks.length, errors }));
} finally {
  await browser.close();
}

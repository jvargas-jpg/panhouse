import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    join(tmpdir(), 'panhouse-browser-qa/node_modules/playwright/index.mjs'),
  ).href
);
const cases = JSON.parse(
  await readFile(
    join(tmpdir(), 'panhouse-browser-qa/cases-seguimiento.json'),
    'utf8',
  ),
);
const base = 'http://localhost:5176',
  out = resolve('docs/evidencias/seguimiento-jefatura');
const browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: join(tmpdir(), 'panhouse-browser-qa/state-seguimiento.json'),
  });
const page = await context.newPage(),
  checks = [],
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const check = (s) => {
  checks.push(s);
  console.log(s);
};
const note = `Acuerdo QA ${Date.now()}: revisar entrega con el Especialista.`;
async function open(mode = 'correccion', extra = '') {
  await page.goto(`${base}/?vista=seguimiento&modo=${mode}${extra}`);
  await page.locator('.js-list').waitFor();
}
async function detalle(c) {
  await open('correccion', `&intervencion=${c.origen}:${c.id}`);
  await page.locator('.js-supervision').waitFor();
}
async function read(c) {
  const r = await context.request.get(
    `${base}/api/seguimiento/intervenciones/${c.origen}/${c.id}`,
  );
  assert.equal(r.status(), 200);
  return r.json();
}
async function expectText(locator, value) {
  await locator.filter({ hasText: value }).first().waitFor();
}
try {
  await open();
  assert.equal(await page.locator('.js-table thead th').count(), 10);
  assert.equal(
    await page
      .getByRole('button', { name: 'Nuevo Registro', exact: true })
      .count(),
    0,
  );
  check('10 compact columns; no duplicate creation flow');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await page.waitForURL(/page=2/);
  await expectText(page.locator('.js-pagination'), 'Página 2');
  const url = page.url();
  await page.locator('.js-table tbody .js-more').first().click();
  await page.locator('.js-supervision').waitFor();
  await page.keyboard.press('Escape');
  assert.ok(page.url().includes('page=2'));
  await page.reload();
  await page.locator('.js-list').waitFor();
  assert.equal(page.url(), url);
  check('pagination, selection, close and reload preserve page');
  await page
    .getByRole('button', { name: 'Vista general', exact: true })
    .click();
  await page.waitForURL(/modo=general/);
  await page.locator('.js-table').waitFor();
  assert.equal(await page.locator('.js-table thead th').count(), 7);
  await page.goBack();
  await page.locator('.js-interv-table').waitFor();
  check('two modes and browser history');
  await open();
  await page
    .getByLabel('Buscar proyectos o autores')
    .fill('ZZZZ SIN COINCIDENCIA');
  await page
    .getByRole('heading', {
      name: 'No hay resultados con estos filtros',
      exact: true,
    })
    .waitFor();
  await page.reload();
  await page
    .getByRole('heading', {
      name: 'No hay resultados con estos filtros',
      exact: true,
    })
    .waitFor();
  await page
    .getByRole('button', { name: 'Limpiar filtros', exact: true })
    .click();
  await page.locator('.js-table tbody tr').first().waitFor();
  check('debounced search, empty state, reload and clear');
  await page
    .getByLabel('Material', { exact: true })
    .selectOption('preliminares');
  await page.waitForURL(/material=preliminares/);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.js-table tbody tr')].every((r) =>
      r.textContent.includes('Preliminares'),
    ),
  );
  await page.getByLabel('Filas por página', { exact: true }).selectOption('50');
  await page.waitForURL(/size=50/);
  check('server material filter and 50-row page size');
  await detalle(cases.A);
  const notes = page.getByLabel('Notas de seguimiento', { exact: true });
  await notes.fill(note);
  await page
    .getByRole('button', { name: 'Guardar cambios', exact: true })
    .click();
  await page
    .getByRole('status')
    .filter({ hasText: 'Cambios guardados' })
    .first()
    .waitFor();
  let d = await read(cases.A);
  assert.equal(d.observaciones, note);
  await page.getByRole('button', { name: 'Actividad', exact: true }).click();
  await page.getByText(note, { exact: true }).waitFor();
  check('notes persist, audit names and note body are visible');
  await page.getByRole('button', { name: 'Detalle', exact: true }).click();
  await notes.fill('Borrador local que debe conservarse');
  d = await read(cases.A);
  const external = await context.request.patch(
    `${base}/api/seguimiento/intervenciones/correccion/${cases.A.id}`,
    {
      data: {
        observaciones: 'Actualización desde otra sesión',
        expectedUpdatedAt: d.updatedAt,
      },
    },
  );
  assert.equal(external.status(), 200);
  await page
    .getByRole('button', { name: 'Guardar cambios', exact: true })
    .click();
  await page.getByRole('alert').waitFor();
  assert.equal(await notes.inputValue(), 'Borrador local que debe conservarse');
  assert.equal(
    (await read(cases.A)).observaciones,
    'Actualización desde otra sesión',
  );
  await page.screenshot({ path: join(out, 'conflicto-supervision.png') });
  check('optimistic conflict does not overwrite or discard local draft');
  await detalle(cases.F);
  await page
    .getByLabel('Evaluación de seguimiento', { exact: true })
    .selectOption('regular');
  await page
    .getByLabel('Observaciones de Fase de Calidad 1', { exact: true })
    .fill(`Conservar seguimiento de los ajustes acordados. QA ${Date.now()}`);
  await page
    .getByRole('button', { name: 'Guardar cambios', exact: true })
    .click();
  await page
    .getByRole('status')
    .filter({ hasText: 'Cambios guardados' })
    .first()
    .waitFor();
  d = await read(cases.F);
  assert.equal(d.resultadoSeguimiento, 'regular');
  assert.equal(d.resultadoOperativo, 'aprobado');
  assert.equal(d.cantidadComentarios, 12);
  await page.screenshot({ path: join(out, 'evaluacion-f1.png') });
  check(
    'post-review F1 evaluation and observations; operational approval and comments unchanged',
  );
  await detalle(cases.B);
  if ((await read(cases.B)).pago80 === true) {
    await page
      .getByLabel('Estado del 80%', { exact: true })
      .selectOption('false');
    await page
      .getByRole('button', { name: 'Guardar cambios', exact: true })
      .click();
    await page
      .getByRole('status')
      .filter({ hasText: 'Cambios guardados' })
      .first()
      .waitFor();
    assert.equal((await read(cases.B)).pago80, false);
  }
  await page.getByLabel('Estado del 80%', { exact: true }).selectOption('true');
  await page
    .getByLabel('Estado del 20%', { exact: true })
    .selectOption('false');
  await page
    .getByRole('button', { name: 'Guardar cambios', exact: true })
    .click();
  await page
    .getByRole('status')
    .filter({ hasText: 'Cambios guardados' })
    .first()
    .waitFor();
  d = await read(cases.B);
  assert.equal(d.pago80, true);
  assert.equal(d.pago20, false);
  assert.equal(d.contratoConfirmado, true);
  await page.screenshot({ path: join(out, 'seguimiento-80-20.png') });
  check('freelance 80/20 persists without payment action or amounts');
  await detalle(cases.J);
  await page.getByRole('button', { name: 'Actividad', exact: true }).click();
  await page
    .getByText('reasignó la intervención de Carlos Mendoza a Laura Gil', {
      exact: true,
    })
    .waitFor();
  check('reassignment history resolves previous/current names');
  await open('general', `&detalle=${cases.A.proyectoId}`);
  await page.locator('.js-drawer-context').waitFor();
  for (const tab of ['Procesos', 'Equipo', 'Alertas', 'Actividad', 'Resumen']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await page.waitForTimeout(150);
  }
  await page
    .getByRole('button', {
      name: 'Ver Corrección y Calidad del proyecto',
      exact: true,
    })
    .click();
  await page.waitForURL(/modo=correccion.*proyecto=/);
  await page.locator('.js-table tbody tr').first().waitFor();
  const data = await context.request.get(
    `${base}/api/seguimiento/intervenciones?proyectoId=${cases.A.proyectoId}`,
  );
  assert.equal((await data.json()).pagination.total, 2);
  check(
    'general tabs, contextual switch and multiple interventions per project',
  );
  await detalle(cases.C);
  await page.route(
    '**/api/seguimiento/intervenciones/correccion/*/actividad',
    (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Error temporal de actividad QA' }),
      }),
  );
  await page.getByRole('button', { name: 'Actividad', exact: true }).click();
  await page.getByRole('alert').waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'Detalle', exact: true }).click();
  await page.locator('.js-supervision').waitFor();
  await page.unroute(
    '**/api/seguimiento/intervenciones/correccion/*/actividad',
  );
  check('activity failure remains local to tab');
  await page.setViewportSize({ width: 375, height: 812 });
  await detalle(cases.B);
  const dialog = page.getByRole('dialog');
  const b = await dialog.boundingBox();
  assert.equal(b.width, 375);
  await page.keyboard.press('Shift+Tab');
  assert.ok(
    await page.evaluate(() => !!document.activeElement?.closest('.js-drawer')),
  );
  assert.equal(await page.locator('.js-drawer-footer a').count(), 2);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  check(
    'mobile full-width panel, focus trap, Escape and fixed destination links',
  );
  assert.deepEqual(errors, []);
  await writeFile(
    join(out, 'qa-functional.json'),
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ checks: checks.length, errors }));
} finally {
  await browser.close();
}

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

// Temporary Playwright installation keeps the app's dependencies unchanged.
const { chromium } = await import(
  pathToFileURL(
    join(tmpdir(), 'panhouse-browser-qa/node_modules/playwright/index.mjs'),
  ).href
);
const isolated = process.env.QA_ISOLATED === 'true';
const out = resolve(
  'docs/evidencias/proyectos-jefatura',
  isolated ? 'isolated' : '.',
);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: join(
    tmpdir(),
    'panhouse-browser-qa',
    isolated ? 'state-isolated.json' : 'state.json',
  ),
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const checks = [];
const base = process.env.QA_URL ?? 'http://localhost:5173';
if (isolated)
  assert.equal(
    base,
    'http://localhost:5175',
    'Isolated QA must target the separate frontend',
  );
const request = async (path) => {
  const r = await context.request.get(`${base}/api${path}`);
  assert.equal(r.status(), 200, path);
  return r.json();
};
const portfolio = await request('/jefatura/proyectos?pageSize=20');
const pending = portfolio.items.find((p) => p.porAsignar);
const assigned = portfolio.items.find((p) => p.especialista);
const risk = portfolio.items.find((p) => p.riesgo.atencion && p.especialista);
async function open(id, detalle = 'Resumen') {
  await page.goto(
    `${base}/?vista=proyectos${id ? `&proyecto=${id}&detalle=${encodeURIComponent(detalle)}` : ''}`,
  );
  await page.getByRole('heading', { name: 'Proyectos', exact: true }).waitFor();
  await page
    .locator('.jp-skeleton')
    .first()
    .waitFor({ state: 'hidden' })
    .catch(() => {});
  if (id) await page.locator('.jp-quick-header').waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function capture(name) {
  await page.screenshot({ path: join(out, `${name}.png`) });
}
async function overflow(label) {
  const metrics = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    content: document.querySelector('.jp-explorer')?.getBoundingClientRect()
      .width,
    drawer: document
      .querySelector('.jp-drawer-overlay .jp-quick')
      ?.getBoundingClientRect().width,
  }));
  assert.ok(
    metrics.document <= metrics.viewport,
    `${label}: horizontal overflow ${JSON.stringify(metrics)}`,
  );
  checks.push({ label, metrics });
}
try {
  await open(pending?.id ?? assigned?.id);
  await capture('desktop-1');
  await overflow('Desktop 1440×900');
  assert.equal(
    await page.getByText('Nuevo proyecto', { exact: true }).count(),
    0,
  );
  checks.push({ label: 'Counts from real API', counts: portfolio.counts });
  if (pending) {
    const d = await request(`/jefatura/proyectos/${pending.id}/resumen`);
    assert.ok(
      await page
        .getByRole('link', { name: 'Asignar Especialista', exact: true })
        .isVisible(),
    );
    assert.ok(
      (await page.locator('.jp-quick-header').innerText()).includes(
        pending.servicio.nombre,
      ),
    );
    await page
      .getByRole('link', { name: 'Asignar Especialista', exact: true })
      .click();
    await page.locator('.jf-overlay').waitFor();
    assert.ok(page.url().includes('vista=asignaciones'));
    checks.push({
      label: 'Pending opens existing decision flow',
      comercial: d.contexto.comercial,
      rrpp: d.contexto.rrpp,
      subtipo: pending.subtipoCrudo,
    });
  }
  if (assigned) {
    await open();
    await page.locator('.jp-project-title').first().click();
    await page.locator('.jp-quick-header').waitFor();
    assert.ok(page.url().includes('vista=proyectos'));
    assert.ok(page.url().includes('proyecto='));
    assert.equal(
      await page
        .getByRole('link', { name: 'Asignar Especialista', exact: true })
        .count(),
      0,
    );
    for (const tab of ['Equipo', 'Hitos', 'Actividad', 'Información']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await page.waitForTimeout(600);
      await capture(`desktop-${tab.toLocaleLowerCase('es')}`);
    }
    await page.goBack();
    await page.goForward();
    assert.ok(page.url().includes('detalle='));
    checks.push({
      label: 'Selection updates URL; detail tabs, browser back/forward work',
    });
  }
  if (risk) {
    await open(risk.id);
    assert.ok(
      await page
        .getByRole('link', { name: 'Revisar seguimiento', exact: true })
        .isVisible(),
    );
    await capture('desktop-riesgo');
  }
  const express = portfolio.items.find(
    (p) => p.express.estado === 'confirmado',
  );
  const completed = portfolio.items.find((p) => p.estado === 'culminado');
  if (express) {
    await open(express.id);
    assert.ok(
      (await page.locator('.jp-detail-grid').innerText()).includes(
        `${express.express.compresionDias} días`,
      ),
    );
    await capture('desktop-express');
    checks.push({
      label: 'Confirmed Express and central compression shown',
      days: express.express.compresionDias,
    });
  }
  if (completed) {
    await open(completed.id);
    assert.equal(
      await page.locator('.jp-quick-actions .jp-primary').count(),
      0,
    );
    await capture('desktop-completado');
    checks.push({
      label: 'Completed has only project and traceability actions',
    });
  }
  await open();
  await page
    .getByRole('button', { name: /^En riesgo/ })
    .last()
    .click();
  await page.waitForTimeout(800);
  assert.equal(
    await page.locator('.jp-table tbody tr').count(),
    Math.min(10, portfolio.counts.enRiesgo),
  );
  await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Buscar proyectos' })
    .fill('busqueda-sin-resultados-qa');
  await page
    .getByText('No hay proyectos disponibles.', { exact: true })
    .waitFor();
  await capture('desktop-vacio');
  await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
  await open(pending?.id ?? assigned?.id);
  await capture('desktop-2');
  const buttons = await page.locator('.jp-quick-actions').boundingBox();
  assert.ok(
    buttons && buttons.y + buttons.height <= 900,
    'Desktop primary and secondary project actions must fit the first viewport',
  );
  checks.push({
    label: 'Desktop quick-view actions visible without scrolling',
    bounds: buttons,
  });
  if (isolated) {
    await open();
    await page
      .locator('.jp-pagination')
      .getByRole('button', { name: 'Siguiente' })
      .click();
    await page.waitForTimeout(800);
    assert.ok(
      (await page.locator('.jp-pagination').innerText()).includes(
        '11–12 de 12',
      ),
    );
    await page.locator('.jp-project-title').first().click();
    await page.locator('.jp-quick-header').waitFor();
    assert.ok(
      page.url().includes('pagina=2'),
      'Row selection preserves pagination',
    );
    await capture('desktop-pagina-2');
    checks.push({
      label: 'Pagination shows correct range; selection preserves page 2',
    });
  }
  // An activity failure stays local to its tab; the list and project remain usable.
  if (assigned) {
    await page.route('**/api/jefatura/proyectos/*/actividad', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"error":"QA local activity failure"}',
      }),
    );
    await open(assigned.id, 'Actividad');
    await page
      .getByText('No pudimos cargar la actividad.', { exact: true })
      .waitFor({ timeout: 20000 });
    assert.ok(await page.locator('.jp-table').isVisible());
    await capture('desktop-error-local');
    await page.unroute('**/api/jefatura/proyectos/*/actividad');
    checks.push({ label: 'Activity failure remains local; retry provided' });
  }
  await page.setViewportSize({ width: 768, height: 1024 });
  await open();
  await overflow('Tablet list 768×1024');
  await capture('tablet-lista');
  await page.locator('.jp-project-title').first().click();
  await page.getByRole('dialog').waitFor();
  await overflow('Tablet drawer');
  await capture('tablet-drawer');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 375, height: 812 });
  await open();
  await overflow('Mobile list 375×812');
  await capture('mobile-lista');
  assert.equal(await page.locator('.jp-table').isVisible(), false);
  await page.locator('.jp-mobile-project').first().click();
  await page.getByRole('dialog').waitFor();
  await overflow('Mobile full-screen');
  await capture('mobile-quick-view');
  assert.equal(
    await page
      .getByRole('link', { name: 'Abrir proyecto 360°', exact: true })
      .count(),
    1,
  );
  await page.getByRole('tab', { name: 'Equipo', exact: true }).click();
  await capture('mobile-equipo');
  await page.getByRole('button', { name: 'Cerrar vista rápida' }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  if (pending) {
    await open(pending.id);
    await capture('mobile-por-asignar');
  }
  checks.push({
    label:
      'Tablet drawer and mobile full-screen; Escape, close and CTA visible',
  });
  if (isolated) {
    await page.setViewportSize({ width: 1440, height: 900 });
    if (pending) {
      await open(pending.id);
      await page
        .getByRole('link', { name: 'Asignar Especialista', exact: true })
        .click();
      await page.locator('.jf-overlay').waitFor();
      await page.locator('.jf-candidates input[type=radio]').first().check();
      await page
        .locator('.jf-drawer-footer')
        .getByRole('button', { name: /^Asignar a / })
        .click();
      await page.locator('.jf-overlay').waitFor({ state: 'hidden' });
      await page.goBack();
      await page.locator('.jp-coordinator').waitFor();
      assert.equal(
        await page
          .getByRole('link', { name: 'Asignar Especialista', exact: true })
          .count(),
        0,
      );
      assert.equal(await page.locator('.jp-recommendation').count(), 0);
      const updated = await request(
        `/jefatura/proyectos/${pending.id}/resumen`,
      );
      assert.ok(updated.proyecto.especialista);
      assert.equal(updated.proyecto.porAsignar, false);
      await capture('desktop-despues-asignar');
      checks.push({
        label:
          'Assignment via existing decision flow updates quick view and removes recommendation/CTA on return; no reload',
      });
    }
  }
  assert.deepEqual(errors, []);
  checks.push({ label: 'No browser JavaScript errors' });
  await writeFile(
    join(out, 'qa-results.json'),
    JSON.stringify(
      {
        source: isolated
          ? 'isolated database fixtures, real API; never development project writes'
          : 'development API, no mocked project data',
        checks,
        unavailableStates: ['confirmed Express', 'completed'].filter(
          (_, i) =>
            !(i ? portfolio.counts.completados : portfolio.counts.express),
        ),
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      captures: out,
      checks: checks.length,
      counts: portfolio.counts,
      errors,
    }),
  );
} finally {
  await browser.close();
}

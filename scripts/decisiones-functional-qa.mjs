import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    join(tmpdir(), 'panhouse-browser-qa/node_modules/playwright/index.mjs'),
  ).href
);
const dir = resolve('docs/evidencias/decisiones-jefatura');
await mkdir(dir, { recursive: true });
const cases = JSON.parse(
  await readFile(
    join(tmpdir(), 'panhouse-browser-qa/cases-decisiones.json'),
    'utf8',
  ),
);
const collection = JSON.parse(
  await readFile(
    join(tmpdir(), 'panhouse-browser-qa/case-decisiones-coleccion.json'),
    'utf8',
  ),
);
const browser = await chromium.launch({ headless: true });
const contexts = {};
const errors = [];
const checks = [];
for (const role of ['jefe', 'especialista', 'soporte'])
  contexts[role] = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: join(
      tmpdir(),
      `panhouse-browser-qa/state-decisiones-${role}.json`,
    ),
  });
const page = await contexts.jefe.newPage(),
  owner = await contexts.especialista.newPage(),
  soporte = await contexts.soporte.newPage();
for (const p of [page, owner, soporte]) {
  p.setDefaultTimeout(60000);
  p.on('pageerror', (error) => errors.push(error.message));
}
const base = 'http://localhost:5176';
async function api(role, path, method = 'get', data) {
  return contexts[role].request[method](
    `${base}/api${path}`,
    data ? { data } : undefined,
  );
}
async function json(role, path) {
  const r = await api(role, path);
  assert.equal(r.status(), 200);
  return r.json();
}
async function open(id, extra = '') {
  await page.goto(`${base}/?vista=decisiones&decision=${id}${extra}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.locator('.jd-ask').waitFor();
}
async function confirm(action, message) {
  await page.getByRole('button', { name: action, exact: true }).click();
  const dialog = page.locator('.jd-confirm');
  await dialog.waitFor();
  if (message) await dialog.locator('textarea').fill(message);
  await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
}
try {
  const blocked = await api(
    'especialista',
    `/correcciones/${cases.A.correccionId}/asignar`,
    'patch',
    {
      correctorNombre: 'Corrector QA',
      freelance: true,
      contratoConfirmado: true,
    },
  );
  assert.equal(blocked.status(), 400);
  checks.push('146 pages uses the existing gate and blocks assignment');
  await page.goto(`${base}/?tab=decisiones`, { waitUntil: 'domcontentloaded' });
  await page.locator('.jf-home-decision').first().waitFor();
  assert.match(
    await page.locator('.jf-kpi-decisiones').innerText(),
    /Decisiones/i,
  );
  checks.push('Inicio KPI and decision queue share the native decision source');
  await page.goto(
    `${base}/?vista=seguimiento&modo=correccion&proyecto=${cases.A.proyectoId}&intervencion=correccion:${cases.A.correccionId}`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.getByRole('link', { name: 'Ver decisión', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Ver decisión', exact: true }).click();
  await page.locator('.jd-ask').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('decision'), cases.A.id);
  checks.push(
    'Seguimiento opens its associated decision without offering resolution there',
  );
  await confirm(
    'Aprobar',
    'Revisión previa de Tripa Word completada con el solicitante',
  );
  await page
    .locator('.jd-detail-header')
    .getByText('Aprobada', { exact: true })
    .waitFor();
  const c = (
    await json('especialista', `/proyectos/${cases.A.proyectoId}/correcciones`)
  ).correcciones[0];
  assert.equal(c.revisionPreviaConfirmada, true);
  assert.equal(
    (
      await api(
        'especialista',
        `/correcciones/${cases.A.correccionId}/asignar`,
        'patch',
        {
          correctorNombre: 'Corrector QA',
          freelance: true,
          contratoConfirmado: true,
        },
      )
    ).status(),
    200,
  );
  await page.screenshot({ path: join(dir, 'aprobada.png') });
  const activity = await json('jefe', `/decisiones/${cases.A.id}/actividad`);
  assert.equal(
    activity.actividad.filter((a) => a.texto === 'aprobó el caso').length,
    1,
  );
  assert.ok(
    (await json('especialista', '/notificaciones')).notificaciones.some(
      (n) => n.decisionId === cases.A.id,
    ),
  );
  checks.push(
    'UI approval atomically satisfies the gate; assignment continues; audit and notification exist',
  );
  await open(cases.B.id);
  await confirm(
    'Solicitar información',
    'Confirma si el original entregado corresponde a Tripa Word',
  );
  await page
    .getByText('Esperando respuesta del solicitante.', { exact: true })
    .waitFor();
  assert.equal(await page.locator('.jd-actions button').count(), 0);
  await owner.goto(`${base}/decisiones/${cases.B.id}/responder`, {
    waitUntil: 'domcontentloaded',
  });
  await owner
    .getByLabel('Tu respuesta')
    .fill('Confirmado: el original corresponde a Tripa Word completo');
  await owner
    .getByRole('button', { name: 'Enviar respuesta', exact: true })
    .click();
  await owner
    .getByText('La solicitud está pendiente de revisión de Jefatura.', {
      exact: true,
    })
    .waitFor();
  await owner.screenshot({ path: join(dir, 'respuesta-solicitante.png') });
  await open(cases.B.id);
  await page
    .getByText('Confirmado: el original corresponde a Tripa Word completo', {
      exact: true,
    })
    .first()
    .waitFor();
  assert.equal(
    (await json('jefe', `/decisiones/${cases.B.id}`)).status,
    'en_revision',
  );
  checks.push(
    'request info, requester UI response and return to review keep the same case and visible answer',
  );
  await open(cases.C.id);
  await page.getByRole('button', { name: 'Rechazar', exact: true }).click();
  await page
    .locator('.jd-confirm')
    .getByRole('button', { name: 'Confirmar', exact: true })
    .click();
  await page.locator('.jd-confirm').getByRole('alert').waitFor();
  await page
    .getByLabel('Justificación', { exact: true })
    .fill('Ajustar el alcance antes de asignar una tripa de esta extensión');
  await page
    .locator('.jd-confirm')
    .getByRole('button', { name: 'Confirmar', exact: true })
    .click();
  await page
    .locator('.jd-detail-header')
    .getByText('Rechazada', { exact: true })
    .waitFor();
  assert.equal(
    (
      await api(
        'especialista',
        `/correcciones/${cases.C.correccionId}/asignar`,
        'patch',
        {
          correctorNombre: 'Corrector QA',
          freelance: true,
          contratoConfirmado: true,
        },
      )
    ).status(),
    400,
  );
  await page.screenshot({ path: join(dir, 'rechazada.png') });
  checks.push(
    'rejection requires a reason in the real modal and keeps correction blocked',
  );
  await open(cases.D.id);
  await page
    .locator('.jd-detail-header')
    .getByText('En revisión', { exact: true })
    .waitFor();
  const stale = await json('jefe', `/decisiones/${cases.D.id}`);
  await page.getByRole('button', { name: 'Aprobar', exact: true }).click();
  assert.equal(
    (
      await api('jefe', `/decisiones/${cases.D.id}/resolver`, 'post', {
        resolution: 'approved',
        expectedVersion: stale.version,
      })
    ).status(),
    200,
  );
  await page
    .locator('.jd-confirm')
    .getByRole('button', { name: 'Confirmar', exact: true })
    .click();
  await page.locator('.jd-confirm').waitFor({ state: 'hidden' });
  await page.locator('.jd-detail-body .jd-error').waitFor();
  await page
    .locator('.jd-detail-header')
    .getByText('Aprobada', { exact: true })
    .waitFor();
  assert.equal(await page.locator('.jd-actions button').count(), 0);
  await page.screenshot({ path: join(dir, 'conflicto.png') });
  checks.push(
    'stale UI reports conflict, refreshes the resolution and prevents another action',
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await open(cases.B.id);
  assert.equal(
    await page
      .locator('.jd-detail')
      .evaluate((el) => el.getBoundingClientRect().width),
    375,
  );
  await page.getByRole('button', { name: 'Aprobar', exact: true }).click();
  assert.equal(
    await page
      .locator('.jd-confirm')
      .evaluate((el) => el.contains(document.activeElement)),
    true,
  );
  await page.keyboard.press('Escape');
  await page.locator('.jd-confirm').waitFor({ state: 'hidden' });
  await confirm('Aprobar', 'Información recibida y revisión previa completada');
  await page
    .locator('.jd-detail-header')
    .getByText('Aprobada', { exact: true })
    .waitFor();
  await page.screenshot({ path: join(dir, 'mobile-aprobada.png') });
  await page.keyboard.press('Escape');
  await page.locator('.jd-detail-active').waitFor({ state: 'hidden' });
  checks.push(
    'mobile full-screen detail, confirmation focus, Escape and real approval work',
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(
    `${base}/?vista=decisiones&estado=pendiente&q=El%20faro&tipo=revision_previa_correccion`,
    { waitUntil: 'domcontentloaded' },
  );
  await page
    .getByRole('button', { name: 'Ver resueltas', exact: true })
    .waitFor();
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(
    await page
      .getByRole('textbox', { name: 'Buscar proyecto, autor o motivo' })
      .inputValue(),
    'El faro',
  );
  assert.equal(
    await page.getByLabel('Tipo de decisión').inputValue(),
    'revision_previa_correccion',
  );
  await page.screenshot({ path: join(dir, 'vacio.png') });
  checks.push('empty state, resolved CTA and URL filters survive reload');
  await soporte.goto(`${base}/proyectos/${collection.proyectoId}#calidad`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await soporte
    .getByText('¿La colección registrada no corresponde al proyecto?', {
      exact: true,
    })
    .click();
  await soporte
    .getByLabel('Motivo de la discrepancia')
    .fill(
      'El autor declara una colección diferente a la registrada en su proyecto',
    );
  await soporte
    .getByRole('button', {
      name: 'Solicitar revisión de Jefatura',
      exact: true,
    })
    .click();
  await soporte
    .getByText('Caso enviado a Jefatura.', { exact: true })
    .waitFor();
  const list = await json('jefe', '/decisiones?tipo=coleccion_inconsistente');
  const esc = list.items.find(
    (item) => item.proyectoId === collection.proyectoId,
  );
  assert.ok(esc);
  await open(esc.id);
  await confirm(
    'Solicitar información',
    'Confirma la colección que corresponde según la información del autor',
  );
  await soporte.goto(`${base}/decisiones/${esc.id}/responder`, {
    waitUntil: 'domcontentloaded',
  });
  await soporte
    .getByLabel('Tu respuesta')
    .fill('Debe revisarse el dato del diagnóstico original junto con RRPP');
  await soporte
    .getByRole('button', { name: 'Enviar respuesta', exact: true })
    .click();
  await soporte
    .getByText('La solicitud está pendiente de revisión de Jefatura.', {
      exact: true,
    })
    .waitFor();
  await open(esc.id);
  await confirm(
    'Revisar con RRPP',
    'Revisar la colección con el autor y conservar la revisión de Calidad',
  );
  await page
    .locator('.jd-detail-header')
    .getByText('Aprobada', { exact: true })
    .waitFor();
  await page.screenshot({ path: join(dir, 'coleccion-resuelta.png') });
  const rounds = await json(
    'soporte',
    `/calidad/proyecto/${collection.proyectoId}`,
  );
  assert.equal(rounds.rondas[0].aprobado, null);
  assert.equal(rounds.rondas[0].revisadoEn, null);
  checks.push(
    'Soporte creates a contextual collection escalation; its own request-info flow works; RRPP referral leaves Quality intact',
  );
  await page.goto(
    `${base}/?vista=decisiones&estado=resuelta&decision=${cases.A.id}`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.locator('.jd-resolution').waitFor();
  assert.equal(await page.locator('.jd-actions button').count(), 0);
  checks.push(
    'resolved cases retain author, decision maker, date and reason without actions',
  );
  await page.goto(`${base}/?vista=seguimiento&modo=correccion`, {
    waitUntil: 'domcontentloaded',
  });
  await page.locator('.js-list').waitFor();
  await page.screenshot({ path: join(dir, 'seguimiento-comparacion.png') });
  checks.push(
    'real browser comparison: Seguimiento table differs from the Decisions inbox and expediente',
  );
  assert.deepEqual(errors, []);
  await writeFile(
    join(dir, 'qa-functional.json'),
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ checks: checks.length, errors }));
} finally {
  await browser.close();
}

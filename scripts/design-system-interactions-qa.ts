import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { homedir } from 'node:os';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { db, pool } from '../server/db/client.js';
import { users } from '../server/db/schema/index.js';
import { createSession, destroySession } from '../server/helpers/session.js';
import { env } from '../server/config/env.js';

const { chromium } = await import(pathToFileURL(process.env.PANHOUSE_PLAYWRIGHT_MODULE ?? join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const output = 'docs/evidencias/design-system/interactions' + (process.argv.includes('--final') ? '-final' : ''), origin = process.env.PANHOUSE_QA_ORIGIN ?? 'http://localhost:5173';
await mkdir(output, { recursive: true });
const accounts = await db.select({ id: users.id, role: users.rol }).from(users).where(eq(users.activo, true));
const browser = await chromium.launch({ headless: true });
const report: { checks: any[]; errors: any[]; preventedWrites: string[] } = { checks: [], errors: [], preventedWrites: [] };
try {
  for (const role of ['comercial', 'admin', 'editor', 'jefe_area', 'lider_creativo', 'soporte_digital']) {
    const user = accounts.find(u => u.role === role);
    assert.ok(user, role + ': cuenta existente');
    const session = await createSession(user.id), context = await browser.newContext({ locale: 'es-VE', timezoneId: 'America/Caracas' });
    await context.addInitScript('window.__name=(fn)=>fn');
    await context.addCookies([{ name: env.SESSION_COOKIE_NAME, value: session, url: origin, httpOnly: true }]);
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(30000);
    page.on('pageerror', (e: Error) => report.errors.push({ role, error: e.message }));
    // QA never submits operational changes, even if a selector were incorrect.
    await page.route('**/api/**', async (route: any) => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { report.preventedWrites.push(route.request().method() + ' ' + route.request().url()); await route.abort(); }
      else await route.continue();
    });
    try {
      for (const [width, height, size] of [[1440, 900, 'desktop'], [768, 1024, 'tablet'], [375, 812, 'mobile']] as const) {
        await page.setViewportSize({ width, height });
        const capture = async (name: string) => {
          await page.waitForLoadState('networkidle');
          await page.waitForFunction(() => !Array.from(document.querySelectorAll('dialog[open], [role="dialog"], .eo-detail.is-open')).filter(e => e.getBoundingClientRect().width > 0).some(panel => Array.from(panel.querySelectorAll('[role="status"]')).some(e => /cargando|consultando|buscando/i.test((e.getAttribute('aria-label') ?? '') + e.textContent))));
          await page.screenshot({ path: `${output}/${role}-${name}-${size}.png` });
        };
        const check = async (name: string, run: () => Promise<void>) => {
          try { await run(); report.checks.push({ role, name, size, passed: true }); console.log(role, name, size, 'passed'); }
          catch (e) { report.errors.push({ role, name, size, error: e instanceof Error ? e.message : String(e) }); console.log(role, name, size, 'FAILED', e instanceof Error ? e.message : String(e)); }
        };
        await check('panel', async () => {
          if (role === 'comercial') {
            await page.goto(origin + '/', { waitUntil: 'networkidle' });
            await page.getByRole('button', { name: '+ Nuevo proyecto', exact: true }).click();
            const form = page.getByRole('dialog'); await form.waitFor();
            assert.equal(await form.getByLabel('Monto total', { exact: true }).getAttribute('required'), '');
            await capture('nuevo-proyecto'); await page.keyboard.press('Escape');
            await form.waitFor({ state: 'detached' });
          } else if (role === 'admin') {
            await page.goto(origin + '/admin/personas', { waitUntil: 'networkidle' });
            await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
            await page.getByRole('dialog').waitFor(); await capture('crear-cuenta'); await page.keyboard.press('Escape');
            await page.getByRole('dialog').waitFor({ state: 'detached' });
            const response = await context.request.get(origin + '/api/admin/proyectos'); const data = await response.json();
            assert.ok(data.items?.[0]?.id, 'Project 360 con proyecto real');
            await page.goto(origin + '/admin/proyectos/' + data.items[0].id + '?tab=procesos', { waitUntil: 'networkidle' });
            for (const label of ['Resumen', 'Procesos', 'Equipo', 'Ficha', 'Archivos', 'Solicitudes', 'Actividad', 'Auditoría']) assert.ok(await page.getByRole('button', { name: label, exact: true }).count(), 'Tab ' + label);
            await capture('project360');
            await page.goto(origin + '/admin/pipeline', { waitUntil: 'networkidle' });
            const task = page.locator('.ad-pipeline-table tbody button').first(); await task.click();
            await page.getByRole('dialog').waitFor(); await capture('tarea'); await page.keyboard.press('Escape');
            await page.getByRole('dialog').waitFor({ state: 'detached' });
          } else if (role === 'jefe_area') {
            await page.goto(origin + '/?vista=asignaciones', { waitUntil: 'networkidle' });
            await page.getByRole('button', { name: 'Comparar', exact: true }).first().click();
            await page.getByRole('dialog').waitFor(); await capture('asignacion'); await page.keyboard.press('Escape');
            await page.getByRole('dialog').waitFor({ state: 'detached' });
          } else if (role === 'lider_creativo') {
            await page.goto(origin + '/', { waitUntil: 'networkidle' });
            await page.getByText('Preparar brief', { exact: true }).first().click();
            await page.getByRole('dialog').waitFor(); await capture('trabajo'); await page.keyboard.press('Escape');
            await page.getByRole('dialog').waitFor({ state: 'detached' });
          } else {
            await page.goto(origin + '/?vista=mi-trabajo', { waitUntil: 'networkidle' });
            await page.locator('.eo-row-action').first().click();
            await page.locator('.eo-detail.is-open').waitFor(); await capture('detalle');
            if (role === 'editor') {
              const action = page.locator('.eo-detail.is-open').getByRole('button', { name: /^(Registrar avance|Registrar resolución|Reportar bloqueo)$/ }).first();
              if (await action.count()) {
                await action.click(); await page.locator('dialog[open].mw-dialog').waitFor();
                await capture('formulario'); await page.keyboard.press('Escape');
                await page.locator('dialog[open].mw-dialog').waitFor({ state: 'detached' });
                assert.equal(await page.locator('.eo-detail.is-open').count(), 1, 'Cerrar el formulario conserva el detalle');
              }
            }
            const projectLink = page.locator('.eo-detail.is-open a[href^="/proyectos/"]').first();
            const projectHref = await projectLink.count() ? await projectLink.getAttribute('href') : null;
            if (width < 1200) { await page.keyboard.press('Escape'); await page.locator('.eo-detail.is-open').waitFor({ state: 'detached' }); }
            if (projectHref) {
              await page.goto(origin + projectHref, { waitUntil: 'networkidle' });
              await page.locator('h1').waitFor(); await capture('proyecto-relacionado');
              assert.equal(await page.locator('.ph-shell').count(), 1, 'El proyecto conserva el shell');
            }
          }
        });
        if (['comercial', 'editor', 'soporte_digital'].includes(role)) await check('proyecto-relacionado', async () => {
          const endpoint = role === 'comercial' ? '/pagos/proyectos' : role === 'editor' ? '/editores/mi-trabajo' : '/soporte-digital/mi-trabajo';
          const response = await context.request.get(origin + '/api' + endpoint);
          assert.equal(response.status(), 200);
          const data = await response.json(), id = role === 'comercial' ? data.items?.[0]?.id : data.items?.[0]?.projectId;
          assert.ok(id, 'Proyecto real accesible');
          await page.goto(origin + '/proyectos/' + id + (role === 'soporte_digital' ? '#digital' : ''), { waitUntil: 'networkidle' });
          await page.locator('h1').waitFor(); await capture('proyecto-relacionado');
          assert.equal(await page.locator('.ph-shell').count(), 1, 'El proyecto conserva el shell');
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, 'Sin overflow en el proyecto');
        });
        if (width < 1024) await check('navegacion-teclado', async () => {
          await page.goto(origin + (role === 'admin' ? '/admin/inicio' : '/'), { waitUntil: 'networkidle' });
          const toggle = page.getByRole('button', { name: 'Abrir navegación', exact: true }); await toggle.click();
          const nav = page.getByRole('dialog', { name: 'Navegación de PanHouse' }); await nav.waitFor();
          const controls = nav.locator('button:not(:disabled),a[href]');
          await controls.last().focus(); await page.keyboard.press('Tab');
          assert.equal(await controls.first().evaluate((e: Element) => e === document.activeElement), true, 'Tab queda dentro del menú');
          await capture('navegacion'); await page.keyboard.press('Escape'); await nav.waitFor({ state: 'detached' });
          assert.equal(await toggle.evaluate((e: Element) => e === document.activeElement), true, 'Escape devuelve el foco');
        });
      }
    } finally { await context.close(); await destroySession(session); }
  }
} finally { await writeFile(output + '/report.json', JSON.stringify(report, null, 2) + '\n'); await browser.close(); await pool.end(); }
console.log(JSON.stringify(report, null, 2));
if (report.errors.length || report.preventedWrites.length) process.exitCode = 1;

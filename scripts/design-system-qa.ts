// Read-only QA against the running application; sessions are removed in finally.
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
const baseline = process.argv.includes('--baseline');
const output = 'docs/evidencias/design-system/' + (baseline ? 'before' : 'after');
const origin = process.env.PANHOUSE_QA_ORIGIN ?? 'http://localhost:5173';
await mkdir(output, { recursive: true });
const accounts = await db.select({ id: users.id, role: users.rol }).from(users).where(eq(users.activo, true));
const routes: Record<string, string[]> = {
  comercial: ['/', '/proyectos', '/comercial/pagos'], rrpp: ['/', '/rrpp/proyectos', '/rrpp/solicitudes'],
  jefe_area: ['/', '/?vista=asignaciones', '/?vista=proyectos', '/?vista=decisiones'],
  especialista: ['/', '/?vista=mis-proyectos', '/?vista=mi-trabajo', '/?vista=solicitudes'],
  jefe_edicion: ['/', '/?vista=asignaciones', '/?vista=proyectos-edicion', '/?vista=solicitudes-edicion'],
  editor: ['/', '/?vista=mi-trabajo', '/?vista=mis-proyectos', '/?vista=mis-solicitudes'],
  corrector: ['/', '/?vista=mi-trabajo', '/?vista=mis-solicitudes'],
  soporte_editorial: ['/', '/?vista=mi-trabajo', '/?vista=mis-solicitudes'],
  lider_creativo: ['/', '/?vista=mi-trabajo', '/?vista=proyectos-creativos', '/?vista=solicitudes'],
  disenador: ['/'], soporte_digital: ['/', '/?vista=mi-trabajo', '/?vista=mis-solicitudes'],
  direccion: ['/', '/proyectos'], admin: ['/admin/inicio', '/admin/pipeline', '/admin/proyectos', '/admin/personas', '/admin/actividad', '/admin/solicitudes', '/admin/integraciones', '/admin/configuracion', '/admin/salud'],
  talento_humano: ['/'], cobranzas: ['/'], autor: ['/mis-libros'],
};
const browser = await chromium.launch({ headless: true });
const report: { baseline: boolean; missingRoles: string[]; screens: any[]; errors: any[] } = { baseline, missingRoles: [], screens: [], errors: [] };
try {
  if (!baseline) {
    const publicPage = await browser.newPage();
    for (const [width, height, size] of [[1440, 900, 'desktop'], [768, 1024, 'tablet'], [375, 812, 'mobile']] as const) {
      await publicPage.setViewportSize({ width, height });
      await publicPage.goto(origin + '/login', { waitUntil: 'networkidle' });
      await publicPage.getByRole('heading', { name: 'Iniciar sesión' }).waitFor();
      assert.equal(await publicPage.getByLabel('Correo', { exact: true }).count(), 1);
      assert.equal(await publicPage.getByLabel('Contraseña', { exact: true }).count(), 1);
      await publicPage.screenshot({ path: `${output}/login-${size}.png` });
      report.screens.push({ role: 'public', route: '/login', width, height, file: `login-${size}.png`, checks: 'passed' });
    }
    await publicPage.close();
  }
  for (const [role, paths] of Object.entries(routes)) {
    const account = accounts.find(a => a.role === role);
    if (!account) { report.missingRoles.push(role); continue; }
    const session = await createSession(account.id);
    const context = await browser.newContext({ locale: 'es-VE', timezoneId: 'America/Caracas' });
    // tsx keepNames emits this helper for nested functions inside evaluate.
    await context.addInitScript('window.__name = (fn) => fn');
    await context.addCookies([{ name: env.SESSION_COOKIE_NAME, value: session, url: origin, httpOnly: true }]);
    const page = await context.newPage();
    page.on('pageerror', (e: Error) => report.errors.push({ role, error: e.message }));
    try {
      const selectedPaths = baseline ? paths.slice(0, 2) : paths;
      for (let routeIndex = 0; routeIndex < selectedPaths.length; routeIndex++) {
        for (const [width, height, size] of [[1440, 900, 'desktop'], [768, 1024, 'tablet'], [375, 812, 'mobile']] as const) {
          await page.setViewportSize({ width, height });
          await page.goto(origin + selectedPaths[routeIndex], { waitUntil: 'networkidle' });
          await page.locator('h1:visible,h2:visible,[role="alert"]:visible').first().waitFor();
          const metrics = await page.evaluate(() => {
            const h = document.querySelector('main h1') ?? document.querySelector('h1');
            const bar = document.querySelector('.ph-topbar') ?? document.querySelector('header');
            const aside = document.querySelector('.ph-sidebar') ?? document.querySelector('aside');
            const style = (e: Element | null) => e ? { font: getComputedStyle(e).fontFamily, size: getComputedStyle(e).fontSize, background: getComputedStyle(e).backgroundColor, height: Math.round(e.getBoundingClientRect().height) } : null;
            return { title: h?.textContent, heading: style(h), topbar: style(bar), sidebar: style(aside), documentWidth: document.documentElement.scrollWidth,
              overflowing: Array.from(document.querySelectorAll('main *')).filter(e => { const r = e.getBoundingClientRect();return r.width > 0 && (r.right > innerWidth + 2 || r.left < -2) && getComputedStyle(e).position !== 'fixed' && !e.closest('[hidden],dialog:not([open]),.ph-sidebar'); }).slice(0, 8).map(e => ({tag:e.tagName, class:e.className})) };
          });
          const file = `${role}-${routeIndex}-${size}.png`;
          await page.screenshot({ path: `${output}/${file}` });
          const screen: any = { role, route: selectedPaths[routeIndex], width, height, file, ...metrics };
          if (!baseline && role !== 'autor') {
            try {
              assert.equal(await page.locator('.ph-topbar:visible').count(), 1, 'Una sola topbar canónica');
              assert.equal(metrics.topbar?.height, 60, 'Altura de topbar común');
              if (width < 1024) {
                const open = page.getByRole('button', { name: 'Abrir navegación', exact: true });
                await open.click();
                const drawer = page.getByRole('dialog', { name: 'Navegación de PanHouse' });
                await drawer.waitFor();
                await page.keyboard.press('Escape');
                await drawer.waitFor({ state: 'detached' });
                assert.equal(await open.evaluate((e: Element) => e === document.activeElement), true, 'Escape devuelve el foco');
                screen.navigation = 'passed';
              }
              assert.equal(metrics.documentWidth, width, 'Sin overflow del documento');
              assert.ok(!/Georgia|Times/.test(metrics.heading?.font ?? ''), 'Tipografía del canon');
              screen.checks = 'passed';
            } catch (e) { screen.checks = e instanceof Error ? e.message : String(e); report.errors.push({ role, route: selectedPaths[routeIndex], size, error: screen.checks }); }
          }
          report.screens.push(screen);
          console.log(role, routeIndex, size, screen.checks ?? 'baseline');
        }
      }
    } finally { await context.close(); await destroySession(session); }
  }
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n');
  await browser.close(); await pool.end();
}
console.log(JSON.stringify({ screens: report.screens.length, missingRoles: report.missingRoles, errors: report.errors }, null, 2));
if (report.errors.length) process.exitCode = 1;

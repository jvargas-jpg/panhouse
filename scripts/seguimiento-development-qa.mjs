import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    join(tmpdir(), 'panhouse-browser-qa/node_modules/playwright/index.mjs'),
  ).href
);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: join(tmpdir(), 'panhouse-browser-qa/state.json'),
});
const page = await context.newPage(),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  for (const mode of ['general', 'correccion']) {
    await page.goto(`http://localhost:5173/?vista=seguimiento&modo=${mode}`);
    await page.locator('.js-list').waitFor();
    await page.screenshot({
      path: resolve(
        `docs/evidencias/seguimiento-jefatura/desarrollo-${mode}.png`,
      ),
    });
  }
  assert.deepEqual(errors, []);
  console.log('Development views verified without modifying data.');
} finally {
  await browser.close();
}

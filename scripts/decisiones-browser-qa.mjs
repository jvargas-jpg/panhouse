import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
const cycle = process.env.QA_CYCLE ?? '1';
const cases = JSON.parse(
  await readFile(
    join(tmpdir(), 'panhouse-browser-qa/cases-decisiones.json'),
    'utf8',
  ),
);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: join(
    tmpdir(),
    'panhouse-browser-qa/state-decisiones-jefe.json',
  ),
});
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.goto(
  `http://localhost:5176/?vista=decisiones&decision=${cases.A.id}`,
  { waitUntil: 'domcontentloaded', timeout: 60000 },
);
await page.locator('.jd-ask').waitFor();
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(700);
await page.screenshot({ path: join(dir, `desktop-${cycle}.png`) });
const measures = await page.evaluate(() => {
  const inbox = document.querySelector('.jd-inbox').getBoundingClientRect();
  const detail = document.querySelector('.jd-detail').getBoundingClientRect();
  return {
    viewport: innerWidth,
    scroll: document.documentElement.scrollWidth,
    inboxWidth: inbox.width,
    detailWidth: detail.width,
    inboxBottom: inbox.bottom,
    detailBottom: detail.bottom,
    items: [...document.querySelectorAll('.jd-item')].map(
      (item) => item.getBoundingClientRect().height,
    ),
  };
});
await page.setViewportSize({ width: 768, height: 1024 });
await page.screenshot({ path: join(dir, `tablet-${cycle}.png`) });
await page.setViewportSize({ width: 375, height: 812 });
await page.screenshot({ path: join(dir, `mobile-detail-${cycle}.png`) });
await page.getByRole('button', { name: 'Cerrar expediente' }).click();
await page.screenshot({ path: join(dir, `mobile-inbox-${cycle}.png`) });
await writeFile(
  join(dir, `qa-${cycle}.json`),
  JSON.stringify({ measures, errors }, null, 2),
);
assert.deepEqual(errors, []);
console.log(JSON.stringify({ cycle, measures, errors }));
await browser.close();

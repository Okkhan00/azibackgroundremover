// Extra end-to-end checks: offline use, Fast model, PNG/WEBP input, rejected type, large images.
// Usage: npm run build && E2E_EXTRA=/path/to/folder E2E_OUT=/path/to/out node e2e/extra.mjs
// Folder needs: girl-12mp.jpg, girl-33mp.jpg, animal.png, animal.webp, not-supported.gif
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = process.env.E2E_EXTRA;
const OUT = process.env.E2E_OUT ?? './e2e-out';
const CHROME = process.env.CHROME_PATH;
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, extra = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
};
const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ headless: true, ...(CHROME ? { executablePath: CHROME } : {}), args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const go = (h) => page.evaluate((x) => (window.location.hash = x), h);
const info = () => page.textContent('[data-testid="result-info"]');
const upload = async (file) => {
  await go('#/remover');
  await page.waitForSelector('[data-testid="remover-input"]', { state: 'attached' });
  await page.setInputFiles('[data-testid="remover-input"]', file);
};
const done = () => page.waitForSelector('[data-testid="result-info"]', { timeout: 240000 });
const newImage = async () => { await page.click('button:has-text("New image")'); };

try {
  await page.goto('http://localhost:4174/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  check('Service worker controls the page', true);

  // PNG + WEBP inputs (also warms the offline cache with the Quality model)
  await upload(join(DIR, 'animal.png')); await done();
  check('PNG input processed', true, await info());
  await newImage();
  await upload(join(DIR, 'animal.webp')); await done();
  check('WEBP input processed', true, await info());
  await newImage();

  // Unsupported type
  await upload(join(DIR, 'not-supported.gif'));
  await page.waitForTimeout(500);
  const body = await page.textContent('body');
  check('GIF rejected with a clear message', /only JPG, JPEG, PNG and WEBP/i.test(body));

  // 12 MP: original dimensions preserved
  await upload(join(DIR, 'girl-12mp.jpg')); await done();
  const i12 = await info();
  check('12 MP image keeps full 4000x2660 resolution', i12.includes('4000×2660'), i12);
  const [d12] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid="download-png"]')]);
  await d12.saveAs(join(OUT, 'girl-12mp-no-bg.png'));
  await newImage();

  // 33 MP: exceeds the 24 MP default -> scaled down with a visible notice, no crash
  await upload(join(DIR, 'girl-33mp.jpg')); await done();
  const i33 = await info();
  check('33 MP image is scaled to the size limit and says so', /scaled down from 7000×4654/.test(i33), i33);
  await newImage();

  // Fast model via the Remover page selector
  await upload(join(DIR, 'animal.png'));
  await done();
  await page.click('button[aria-pressed]:has-text("Fast")');
  await page.click('button:has-text("Run again")');
  await page.waitForFunction(() => document.querySelector('[data-testid="result-info"]')?.textContent?.includes('Fast'), null, { timeout: 120000 });
  check('Fast model works', true, await info());
  await page.click('button[aria-pressed]:has-text("Quality")');

  // Offline: reload with the network cut, then process an image
  await ctx.setOffline(true);
  await page.goto('http://localhost:4174/');
  await page.waitForSelector('[data-testid="home-upload"]');
  check('App shell loads offline', true);
  await page.setInputFiles('[data-testid="home-single-input"]', join(DIR, 'animal.webp'));
  await done();
  check('AI background removal works fully offline', true, await info());
  await ctx.setOffline(false);

  writeFileSync(join(OUT, 'extra-ok.txt'), 'ok');
} catch (e) {
  check('Unexpected exception: ' + e.message, false);
  await page.screenshot({ path: join(OUT, 'extra-failure.png') }).catch(() => {});
} finally {
  if (errors.length) console.log('Browser errors:\n  ' + errors.join('\n  '));
  check('No uncaught browser errors', errors.length === 0);
  await browser.close();
  server.kill();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

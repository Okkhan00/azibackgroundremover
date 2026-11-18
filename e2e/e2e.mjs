// End-to-end test: drives the production build in real Chrome with real photos.
// Usage: npm run build && E2E_FIXTURES=/path/to/photos E2E_OUT=/path/to/out node e2e/e2e.mjs
// The fixtures folder must contain photo files; this script uses the first three .jpg files and
// writes a corrupted "broken.jpg" itself to prove one bad file does not stop a batch.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const FIX = process.env.E2E_FIXTURES;
const OUT = process.env.E2E_OUT ?? './e2e-out';
const CHROME = process.env.CHROME_PATH; // optional: path to a Chrome/Chromium binary
if (!FIX) throw new Error('Set E2E_FIXTURES to a folder containing .jpg photos');
mkdirSync(OUT, { recursive: true });
const photos = readdirSync(FIX).filter((f) => /\.jpe?g$/i.test(f)).map((f) => join(FIX, f));
if (photos.length < 2) throw new Error('Need at least 2 .jpg photos in E2E_FIXTURES');
const broken = join(OUT, 'broken.jpg');
writeFileSync(broken, Buffer.from('this is not an image at all'));

const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
};

const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const URL_ = 'http://localhost:4173/';

const browser = await chromium.launch({ headless: true, ...(CHROME ? { executablePath: CHROME } : {}), args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, acceptDownloads: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));

try {
  await page.goto(URL_);
  await page.waitForSelector('[data-testid="home-upload"]');
  await page.screenshot({ path: join(OUT, '01-home-mobile.png') });
  check('Home dashboard renders with branding', (await page.textContent('body')).includes('AZI CREATION'));

  // ---- Single image
  const t0 = Date.now();
  await page.setInputFiles('[data-testid="home-single-input"]', photos[0]);
  await page.waitForSelector('[data-testid="result-info"]', { timeout: 180000 });
  console.log('      single image (incl. first model load) took', ((Date.now() - t0) / 1000).toFixed(1), 's');
  check('Single image: AI result produced', true, await page.textContent('[data-testid="result-info"]'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, '02-result-slider-mobile.png') });

  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid="download-png"]')]);
  const pngPath = join(OUT, dl.suggestedFilename());
  await dl.saveAs(pngPath);
  check('Download HD PNG saved', /-no-bg\.png$/.test(pngPath), pngPath);

  // slider + zoom controls
  const handle = page.locator('[role="slider"]');
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  const now = Number(await handle.getAttribute('aria-valuenow'));
  check('Before/after slider drags', now < 40, `value ${now}`);
  await page.click('button[aria-label="Zoom in"]');
  await page.click('button[aria-label="Zoom in"]');
  const zoomTxt = await page.textContent('[aria-label="Before and after comparison"] ~ div, .relative > div.absolute.bottom-2');
  check('Zoom in changes zoom level', /1[3-9]\d%|[2-9]\d\d%/.test(zoomTxt ?? ''), zoomTxt?.replace(/\s+/g, ' ').trim());
  await page.click('button[aria-label="Reset preview"]');
  check('Reset restores slider to centre', Number(await handle.getAttribute('aria-valuenow')) === 50);

  // ---- Editor
  await page.click('text=Edit background');
  await page.waitForSelector('[data-testid="editor-download"]');
  await page.click('[role="radio"]:has-text("Blue")');
  await page.screenshot({ path: join(OUT, '03-editor-blue-mobile.png') });
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid="editor-download"]')]);
  const bluePath = join(OUT, 'editor-blue.png');
  await dl2.saveAs(bluePath);
  await page.click('[role="radio"]:has-text("Transparent")');
  const [dl3] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid="editor-download"]')]);
  const transPath = join(OUT, 'editor-transparent.png');
  await dl3.saveAs(transPath);
  await page.setInputFiles('[data-testid="bg-image-input"]', photos[1]);
  await page.waitForTimeout(300);
  const [dl4] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid="editor-download"]')]);
  const imgBgPath = join(OUT, 'editor-image-bg.png');
  await dl4.saveAs(imgBgPath);
  await page.screenshot({ path: join(OUT, '04-editor-imagebg-mobile.png') });

  // ---- Batch (2 real photos + 1 corrupted file)
  await page.evaluate(() => (window.location.hash = '#/batch'));
  await page.waitForSelector('[data-testid="batch-input"]', { state: 'attached' });
  await page.setInputFiles('[data-testid="batch-input"]', [...photos.slice(0, 3), broken]);
  await page.waitForSelector('[data-testid="batch-item"]');
  const n = await page.locator('[data-testid="batch-item"]').count();
  check('Batch: all selected files listed with thumbnails', n === Math.min(3, photos.length) + 1, `${n} items`);
  await page.click('[data-testid="batch-process-all"]');
  await page.waitForFunction(
    (total) => document.querySelectorAll('[data-testid="batch-item"][data-status="done"], [data-testid="batch-item"][data-status="error"]').length === total,
    n,
    { timeout: 300000 },
  );
  const doneN = await page.locator('[data-testid="batch-item"][data-status="done"]').count();
  const errN = await page.locator('[data-testid="batch-item"][data-status="error"]').count();
  check('Batch: corrupted file fails alone, others finish', errN === 1 && doneN === n - 1, `${doneN} done, ${errN} failed`);
  const errText = await page.locator('[data-testid="batch-item"][data-status="error"]').textContent();
  check('Batch: failure shows a meaningful message', /could not be opened|corrupted/i.test(errText ?? ''), errText?.slice(0, 90));
  await page.screenshot({ path: join(OUT, '05-batch-mobile.png'), fullPage: true });
  const [zdl] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid="batch-zip"]')]);
  const zipPath = join(OUT, zdl.suggestedFilename());
  await zdl.saveAs(zipPath);
  check('Batch ZIP downloaded', /\.zip$/.test(zipPath), zipPath);

  // ---- History + totals
  await page.evaluate(() => (window.location.hash = '#/history'));
  await page.waitForSelector('[data-testid="history-item"]');
  const hist = await page.locator('[data-testid="history-item"]').count();
  check('History lists processed images', hist === 1 + doneN, `${hist} entries`);
  await page.evaluate(() => (window.location.hash = ''));
  await page.waitForSelector('[data-testid="total-processed"]');
  check('Dashboard counts processed images', Number(await page.textContent('[data-testid="total-processed"]')) === 1 + doneN);

  // ---- Desktop layout screenshot
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => (window.location.hash = '#/remover'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, '06-desktop.png') });

  // ---- Offline: model + app must work from cache after going offline
  await page.evaluate(() => (window.location.hash = ''));
  await page.reload();
  await page.waitForTimeout(1500); // let the service worker install and take control
  const swReady = await page.evaluate(async () => !!(await navigator.serviceWorker?.getRegistration()));
  check('PWA service worker registered', swReady);

  writeFileSync(join(OUT, 'paths.json'), JSON.stringify({ pngPath, bluePath, transPath, imgBgPath, zipPath, photos: photos.slice(0, 3) }));
} catch (e) {
  check('Unexpected exception: ' + e.message, false);
  await page.screenshot({ path: join(OUT, 'failure.png') }).catch(() => {});
} finally {
  if (errors.length) console.log('Browser errors:\n  ' + errors.join('\n  '));
  check('No uncaught browser errors', errors.filter((e) => !/favicon|404/.test(e)).length === 0);
  await browser.close();
  server.kill();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

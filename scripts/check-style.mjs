import puppeteer from 'puppeteer';

const style = process.argv[2] || 'warm';
const base = process.argv[3] || 'http://127.0.0.1:4173';
const out = process.argv[4] || `/tmp/3d-${style}.png`;
const scene = process.argv[5] || `your-house-${style}`;
const qs = 'pos=9.7,1.65,6.3&target=4.4,1.0,8.8';

const browser = await puppeteer.launch({
  headless: true,
  protocolTimeout: 180000,
  args: [
    '--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-webgpu',
    '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-sandbox',
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 700, deviceScaleFactor: 1 });
const errors = [];
const failed = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('requestfailed', (r) => failed.push(`${r.url()} :: ${r.failure()?.errorText}`));
await page.goto(`${base}/?scene=${scene}&${qs}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
let ready = false;
try {
  await page.waitForFunction('window.__sceneReady === true', { timeout: 120000 });
  ready = true;
} catch {}
await new Promise((r) => setTimeout(r, 8000));
await page.screenshot({ path: out });
console.log('ready:', ready);
console.log('errors:', errors.length ? errors.slice(0, 4) : 'none');
console.log('failed:', failed.length ? failed.slice(0, 6) : 'none');
await browser.close();

import puppeteer from 'puppeteer';

const base = process.argv[2] || 'http://127.0.0.1:5173';
const out = process.argv[3] || '/tmp/app-view.png';

const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-webgpu', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 160));
});
await page.goto(`${base}/?scene=your-house`, { waitUntil: 'domcontentloaded', timeout: 60000 });
let ready = false;
try {
  await page.waitForFunction('window.__sceneReady === true', { timeout: 120000 });
  ready = true;
} catch {
  ready = false;
}
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: out });
console.log('ready:', ready, 'errors:', errors.length ? errors.slice(0, 3) : 'none');
await browser.close();
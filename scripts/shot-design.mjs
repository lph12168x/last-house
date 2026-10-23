import puppeteer from 'puppeteer';

const url = process.argv[2] || 'http://127.0.0.1:5173/design.html';
const out = process.argv[3] || '/tmp/design-full.png';

const browser = await puppeteer.launch({
  headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
const bad = await page.evaluate(async () => {
  const imgs = [...document.images];
  await Promise.all(
    imgs.map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r)))),
  );
  return imgs
    .filter((i) => !i.naturalWidth)
    .map((i) => i.getAttribute('src'));
});
await page.screenshot({ path: out, fullPage: true });
console.log('errors:', errors.length ? errors : 'none');
console.log('broken images:', bad.length ? bad : 'none');
await browser.close();
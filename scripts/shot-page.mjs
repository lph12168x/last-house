import puppeteer from 'puppeteer';

const url = process.argv[2] || 'http://127.0.0.1:4173/design.html';
const out = process.argv[3] || '/tmp/page.png';
const click = process.argv[4] || '';

const browser = await puppeteer.launch({
  headless: true,
  protocolTimeout: 180000,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
await new Promise((r) => setTimeout(r, 2500));
if (click) {
  await page.click(`[data-style="${click}"]`);
  await new Promise((r) => setTimeout(r, 2000));
}
await page.evaluate(async () => {
  document.querySelectorAll('img[data-shot]').forEach((img) => { img.loading = 'eager'; });
  await Promise.all([...document.images].map((img) => img.complete ? null : new Promise((resolve) => {
    img.onload = img.onerror = resolve;
  })));
});
await new Promise((r) => setTimeout(r, 1200));
const bad = await page.evaluate(() => [...document.images].filter((img) => !img.naturalWidth).map((img) => img.getAttribute('src')));
const state = await page.evaluate(() => ({
  title: document.title,
  style: document.querySelector('.style-card.is-active')?.dataset.style,
  meta: document.getElementById('style-meta-value')?.textContent,
  hero: document.getElementById('hero-image')?.getAttribute('src'),
  gallery: [...document.querySelectorAll('img[data-shot]')].slice(0, 3).map((i) => i.getAttribute('src')),
  scene: document.querySelector('[data-scene-link]')?.getAttribute('href'),
  swatches: document.querySelectorAll('#swatches .swatch').length,
  spec: document.querySelectorAll('#spec li').length,
  cards: document.querySelectorAll('.style-card').length,
}));
await page.screenshot({ path: out, fullPage: true });
console.log(JSON.stringify(state, null, 1));
console.log('bad images:', bad);
console.log('errors:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();

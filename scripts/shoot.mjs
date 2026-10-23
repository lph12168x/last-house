import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import puppeteer from 'puppeteer';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4173';
const SCENE = process.env.SCENE ?? 'your-house';
const OUT = process.env.OUT ?? 'public/renders';
const W = Number(process.env.W ?? 1600);
const H = Number(process.env.H ?? 1000);

const views = [
  { name: 'overview', pos: [26, 24, 30], target: [6.8, 0, 5.5] },
  { name: 'living', pos: [9.6, 1.6, 4.3], target: [5.6, 1.1, 9.6] },
  { name: 'master', pos: [3.3, 1.6, 6.2], target: [1.2, 1.0, 10.2] },
  { name: 'kitchen', pos: [8.6, 1.6, 0.9], target: [7.4, 1.2, 6.5] },
];

await mkdir(OUT, { recursive: true });
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME ?? '/home/latte/.cache/puppeteer/chrome/linux-152.0.7977.75/chrome-linux64/chrome',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--use-angle=vulkan',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
  ],
});

for (const view of views) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });

  const url = `${BASE}/?scene=${SCENE}&pos=${view.pos.join(',')}&target=${view.target.join(',')}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const gpu = await page.evaluate(() => !!navigator.gpu);

  let ready = false;
  try {
    await page.waitForFunction('window.__sceneReady === true', { timeout: 90000 });
    ready = true;
  } catch {
    ready = false;
  }
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: join(OUT, `${view.name}.png`) });
  console.log(`${view.name}: gpu=${gpu} ready=${ready} errors=${errors.length ? errors.slice(0, 2).join(' | ') : 'none'}`);
  await page.close();
}

await browser.close();
console.log('done ->', OUT);

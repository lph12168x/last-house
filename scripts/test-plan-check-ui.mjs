import puppeteer from 'puppeteer';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const browser = await puppeteer.launch({
  headless: 'shell',
  executablePath: process.env.CHROME || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 200));
});
await page.goto(`${base}/plan-check.html`, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForFunction('window.__planTool && window.__planTool.ready === true', { timeout: 30000 });

const wallPoint = await page.evaluate(() => {
  const t = window.__planTool;
  const i = t.data.walls.findIndex((w) => w.len >= 1.2);
  const w = t.data.walls[i];
  const [x, y] = t.toScreen((t.data.calibration.x0 + (w.x0 + w.x1) / 2 * t.data.calibration.sx), (t.data.calibration.y0 + (w.z0 + w.z1) / 2 * t.data.calibration.sy));
  const r = document.querySelector('canvas').getBoundingClientRect();
  return { i, x: x + r.left, y: y + r.top, len: w.len };
});
await page.mouse.click(wallPoint.x, wallPoint.y);
await new Promise((r) => setTimeout(r, 200));
const afterWall = await page.evaluate(() => window.__planTool.state.wallAcc.size);

await page.click('#modeDoor');
const arcPoints = await page.evaluate(() => {
  const r = document.querySelector('canvas').getBoundingClientRect();
  return [[602, 796], [613.4, 768.4], [641, 757]].map(([x, y]) => { const [sx, sy] = window.__planTool.toScreen(x, y); return [sx + r.left, sy + r.top]; });
});
for (const [x, y] of arcPoints) {
  await page.mouse.click(x, y);
  await new Promise((r) => setTimeout(r, 120));
}
const preview = await page.evaluate(() => window.__planTool.state.previewDoor);
await page.keyboard.press('Enter');
await new Promise((r) => setTimeout(r, 200));
const manual = await page.evaluate(() => window.__planTool.state.manualDoors);

await page.click('#exportBtn');
await new Promise((r) => setTimeout(r, 300));
const exported = await page.evaluate(() => ({
  text: document.getElementById('outText').value,
  countText: document.getElementById('nDoors').textContent,
  wallCount: document.getElementById('nWalls').textContent,
}));
await page.screenshot({ path: '/tmp/plan-check-ui.png' });

console.log('wallPoint:', JSON.stringify(wallPoint), 'acceptedWalls:', afterWall);
console.log('preview:', JSON.stringify(preview));
console.log('manualDoors:', JSON.stringify(manual));
const parsed = JSON.parse(exported.text);
console.log('export:', JSON.stringify({ doors: parsed.doors.length, walls: parsed.walls.length, last: parsed.doors[parsed.doors.length - 1] }));
console.log('panel counts:', exported.countText, '/', exported.wallCount);
console.log('errors:', errors.length ? errors : 'none');
await browser.close();

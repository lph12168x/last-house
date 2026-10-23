import { readFile, writeFile } from 'node:fs/promises';
import pngjs from 'pngjs';
const { PNG } = pngjs;

const T = Number(process.env.T ?? 180);
const LONG = Number(process.env.LONG ?? 45);
const GAP = Number(process.env.GAP ?? 10);
const MIN = Number(process.env.MIN ?? 6);
const DILATE = Number(process.env.DILATE ?? 3);
const PX_PER_M = Number(process.env.PX_PER_M ?? 49);

const png = PNG.sync.read(await readFile(process.argv[2] ?? 'input/real-plan.png'));
const W = png.width, H = png.height, N = W * H;
const idx = (x, y) => y * W + x;
const gray = new Uint8Array(N);
for (let i = 0; i < N; i++) gray[i] = png.data[i * 4];
const raw = new Uint8Array(N);
for (let i = 0; i < N; i++) raw[i] = gray[i] < T ? 1 : 0;

function runsOn(mask, horizontal, minLen) {
  const out = new Uint8Array(N);
  const outer = horizontal ? H : W, inner = horizontal ? W : H;
  const at = horizontal ? (o, i) => idx(i, o) : (o, i) => idx(o, i);
  for (let o = 0; o < outer; o++) {
    let i = 0;
    while (i < inner) {
      if (!mask[at(o, i)]) { i++; continue; }
      const s = i;
      while (i < inner && mask[at(o, i)]) i++;
      if (i - s >= minLen) for (let k = s; k < i; k++) out[at(o, k)] = 1;
    }
  }
  return out;
}
const lh = runsOn(raw, true, LONG);
const lv = runsOn(raw, false, LONG);
const m = new Uint8Array(N);
for (let i = 0; i < N; i++) m[i] = lh[i] | lv[i];
function close(horizontal) {
  const outer = horizontal ? H : W, inner = horizontal ? W : H;
  const at = horizontal ? (o, i) => idx(i, o) : (o, i) => idx(o, i);
  for (let o = 0; o < outer; o++) {
    let i = 0;
    while (i < inner) {
      if (!m[at(o, i)]) { i++; continue; }
      let j = i;
      while (j < inner && m[at(o, j)]) j++;
      let k = j, g = 0;
      while (k < inner && !m[at(o, k)] && g <= GAP) { k++; g++; }
      if (g > GAP || k >= inner) { i = j; continue; }
      let e = k;
      while (e < inner && m[at(o, e)]) e++;
      if (e - k < GAP) { i = j; continue; }
      for (let f = j; f < k; f++) m[at(o, f)] = 1;
      i = e;
    }
  }
}
close(true);
close(false);
const th = runsOn(m, true, MIN);
const tv = runsOn(m, false, MIN);
const wall = new Uint8Array(N);
for (let i = 0; i < N; i++) wall[i] = th[i] & tv[i] ? 1 : 0;
const dil = new Uint8Array(N);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!wall[idx(x, y)]) continue;
  for (let dy = -DILATE; dy <= DILATE; dy++) for (let dx = -DILATE; dx <= DILATE; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < W && ny < H) dil[idx(nx, ny)] = 1;
  }
}

const cand = new Uint8Array(N);
for (let i = 0; i < N; i++) cand[i] = raw[i] && !dil[i] ? 1 : 0;

const label = new Int32Array(N).fill(-1);
const stack = new Int32Array(N);
const arcs = [];
for (let s = 0; s < N; s++) {
  if (!cand[s] || label[s] !== -1) continue;
  const id = arcs.length;
  let sp = 0, cnt = 0, sx = 0, sy = 0;
  let x0 = s % W, x1 = x0, y0 = (s - x0) / W, y1 = y0;
  label[s] = id; stack[sp++] = s;
  while (sp > 0) {
    const p = stack[--sp];
    const px = p % W, py = (p - px) / W;
    cnt++; sx += px; sy += py;
    if (px < x0) x0 = px; if (px > x1) x1 = px;
    if (py < y0) y0 = py; if (py > y1) y1 = py;
    for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const np = idx(nx, ny);
      if (cand[np] && label[np] === -1) { label[np] = id; stack[sp++] = np; }
    }
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const bboxArea = w * h;
  const fill = cnt / bboxArea;
  const cx = sx / cnt, cy = sy / cnt;
  const off = Math.hypot(cx - (x0 + x1) / 2, cy - (y0 + y1) / 2) / Math.max(w, h);
  const aspect = Math.min(w, h) / Math.max(w, h);
  arcs.push({ id, cnt, x0, y0, x1, y1, w, h, fill, off, aspect });
}


function circleFit(d) {
  const corners = [[d.x0, d.y0], [d.x1, d.y0], [d.x0, d.y1], [d.x1, d.y1]];
  let best = null;
  for (const [ccx, ccy] of corners) {
    let n = 0, sum = 0, sum2 = 0;
    for (let y = d.y0; y <= d.y1; y++) for (let x = d.x0; x <= d.x1; x++) {
      const p = idx(x, y);
      if (!cand[p] || label[p] !== d.id) continue;
      const r = Math.hypot(x - ccx, y - ccy);
      n++; sum += r; sum2 += r * r;
    }
    if (n < 20) continue;
    const mean = sum / n;
    const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
    const cv = sd / mean;
    if (!best || cv < best.cv) best = { cx: ccx, cy: ccy, r: mean, cv };
  }
  return best;
}

function nearWall(cx, cy, reach) {
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    if (wall[idx(x, y)]) return true;
  }
  return false;
}

const doors = arcs.filter((a) =>
  a.w >= 25 && a.h >= 25 && a.w <= 115 && a.h <= 115 &&
  a.aspect >= 0.62 && a.fill >= 0.04 && a.fill <= 0.26 && a.off >= 0.10 && (() => { const f = circleFit(a); return f && f.cv <= 0.28 && f.r >= 0.45 * PX_PER_M && f.r <= 1.35 * PX_PER_M; })());

console.log(`components=${arcs.length} door-like=${doors.length}`);
for (const d of doors.sort((a, b) => b.w * b.h - a.w * a.h)) {
  console.log(`  bbox(${d.x0},${d.y0})-(${d.x1},${d.y1}) size ${d.w}x${d.h}  fill=${d.fill.toFixed(2)} arc=${(() => { const f = circleFit(d); return f ? f.cv.toFixed(2) : '-'; })()} r=${(() => { const f = circleFit(d); return f ? (f.r / PX_PER_M).toFixed(2) : '-'; })()}m center=(${(() => { const f = circleFit(d); return f ? (f.cx / PX_PER_M).toFixed(2) + ',' + (f.cy / PX_PER_M).toFixed(2) : '-'; })()})`);
}

const ov = new PNG({ width: W, height: H });
for (let i = 0; i < N; i++) {
  const g = gray[i];
  ov.data[i * 4] = g; ov.data[i * 4 + 1] = g; ov.data[i * 4 + 2] = g; ov.data[i * 4 + 3] = 255;
}
const paint = (x, y, c) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = idx(x, y) * 4;
  ov.data[o] = c[0]; ov.data[o + 1] = c[1]; ov.data[o + 2] = c[2];
};
for (const d of doors) {
  for (let x = d.x0; x <= d.x1; x++) { paint(x, d.y0, [230, 30, 30]); paint(x, d.y1, [230, 30, 30]); }
  for (let y = d.y0; y <= d.y1; y++) { paint(d.x0, y, [230, 30, 30]); paint(d.x1, y, [230, 30, 30]); }
  for (let t = 0; t < 360; t += 6) {
    const r = Math.max(d.w, d.h) / 2;
    paint(Math.round((d.x0 + d.x1) / 2 + r * Math.cos(t * Math.PI / 180)), Math.round((d.y0 + d.y1) / 2 + r * Math.sin(t * Math.PI / 180)), [30, 140, 30]);
  }
}
await writeFile('input/arcs-overlay.png', PNG.sync.write(ov));
console.log('wrote input/arcs-overlay.png');

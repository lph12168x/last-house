import { readFile, writeFile } from 'node:fs/promises';
import pngjs from 'pngjs';
const { PNG } = pngjs;

const T = Number(process.env.T ?? 180);
const LONG = Number(process.env.LONG ?? 45);
const GAP = Number(process.env.GAP ?? 10);
const MIN = Number(process.env.MIN ?? 6);
const MAX_OPEN = Number(process.env.MAX_OPEN ?? 140);
const MIN_LINE = Number(process.env.MIN_LINE ?? 90);
const MIN_ROOM = Number(process.env.MIN_ROOM ?? 9000);
const PX_PER_M = Number(process.env.PX_PER_M ?? 49);
const DEBUG_ALL = Number(process.env.DEBUG_ALL ?? 0);
const SEAL = Number(process.env.SEAL ?? 0);

const src = process.argv[2] ?? 'input/real-plan.png';
const png = PNG.sync.read(await readFile(src));
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

// walls are long in one axis (union keeps both orientations), then bridged across their own double lines
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
      let k = j, gapLen = 0;
      while (k < inner && !m[at(o, k)] && gapLen <= GAP) { k++; gapLen++; }
      if (gapLen > GAP || k >= inner) { i = j; continue; }
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

// a wall pixel is thick in BOTH axes; this drops room labels and furniture outlines that survived
const th = runsOn(m, true, MIN);
const tv = runsOn(m, false, MIN);
const wall = new Uint8Array(N);
for (let i = 0; i < N; i++) wall[i] = th[i] & tv[i] ? 1 : 0;

function detectLines(horizontal) {
  const outer = horizontal ? W : H, inner = horizontal ? H : W;
  const at = (o, i) => (horizontal ? wall[idx(o, i)] : wall[idx(i, o)]);
  const score = new Int32Array(outer);
  for (let o = 0; o < outer; o++) {
    let c = 0;
    for (let i = 0; i < inner; i++) c += at(o, i);
    score[o] = c;
  }
  const lines = [];
  let o = 0;
  while (o < outer) {
    if (score[o] < MIN_LINE) { o++; continue; }
    const s = o;
    while (o < outer && score[o] >= MIN_LINE) o++;
    let sum = 0, cnt = 0;
    for (let k = s; k < o; k++) { sum += score[k]; cnt++; }
    lines.push({ at: Math.round((s + o - 1) / 2), width: o - s, score: Math.round(sum / cnt) });
  }
  return lines;
}

const GRID_OVERLAY = Number(process.env.GRID_OVERLAY ?? 0);
const vlines = detectLines(false);
const hlines = detectLines(true);

function lineRuns(line, horizontal) {
  const inner = horizontal ? W : H;
  const outerLimit = horizontal ? H : W;
  const bandStart = line.at - Math.floor(line.width / 2);
  const cov = new Uint8Array(inner);
  for (let i = 0; i < inner; i++) {
    for (let o = bandStart; o < bandStart + line.width; o++) {
      if (o < 0 || o >= outerLimit) continue;
      if (horizontal ? wall[idx(i, o)] : wall[idx(o, i)]) { cov[i] = 1; break; }
    }
  }
  const segs = [];
  let i = 0;
  while (i < inner) {
    if (!cov[i]) { i++; continue; }
    const s = i;
    while (i < inner && cov[i]) i++;
    segs.push([s, i - 1]);
  }
  const closedSegs = [];
  const gaps = [];
  let cur = segs.length ? [...segs[0]] : null;
  for (let k = 1; k < segs.length; k++) {
    const [a, b] = segs[k];
    const gap = a - cur[1] - 1;
    if (SEAL || gap <= MAX_OPEN) {
      gaps.push([cur[1] + 1, a - 1]);
      cur[1] = b;
    } else {
      closedSegs.push(cur);
      cur = [a, b];
    }
  }
  if (cur) closedSegs.push(cur);
  return { closedSegs: closedSegs.filter(([a, b]) => b - a >= 20), gaps, cov };
}

const closedMask = Uint8Array.from(wall);
const openings = [];
for (const line of vlines) {
  const { closedSegs, gaps } = lineRuns(line, false);
  for (const [a, b] of closedSegs) for (let y = a; y <= b; y++) for (let x = line.at - 1; x <= line.at + 1; x++) if (x >= 0 && x < W) closedMask[idx(x, y)] = 1;
  for (const [a, b] of gaps) openings.push({ horizontal: false, at: line.at, from: a, to: b, size: b - a + 1 });
}
for (const line of hlines) {
  const { closedSegs, gaps } = lineRuns(line, true);
  for (const [a, b] of closedSegs) for (let x = a; x <= b; x++) for (let y = line.at - 1; y <= line.at + 1; y++) if (y >= 0 && y < H) closedMask[idx(x, y)] = 1;
  for (const [a, b] of gaps) openings.push({ horizontal: true, at: line.at, from: a, to: b, size: b - a + 1 });
}

let minX = W, maxX = 0, minY = H, maxY = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!closedMask[idx(x, y)]) continue;
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
}

const free = Uint8Array.from(closedMask, (v) => (v ? 0 : 1));
const seen = new Uint8Array(N);
const rooms = [];
for (let y = minY; y <= maxY; y++) {
  for (let x = minX; x <= maxX; x++) {
    const p = idx(x, y);
    if (!free[p] || seen[p]) continue;
    const st = [p];
    seen[p] = 1;
    let size = 0, x0 = x, x1 = x, y0 = y, y1 = y, frame = false;
    while (st.length) {
      const q = st.pop();
      const qx = q % W, qy = (q - qx) / W;
      size++;
      if (qx < x0) x0 = qx; if (qx > x1) x1 = qx;
      if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
      if (qx <= minX || qx >= maxX || qy <= minY || qy >= maxY) frame = true;
      for (const [nx, ny] of [[qx - 1, qy], [qx + 1, qy], [qx, qy - 1], [qx, qy + 1]]) {
        if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
        const np = idx(nx, ny);
        if (free[np] && !seen[np]) { seen[np] = 1; st.push(np); }
      }
    }
    if ((frame && !DEBUG_ALL) || size < MIN_ROOM) { if (DEBUG_ALL && size > MIN_ROOM) rooms.push({ x0, y0, x1, y1, size }); continue; }
    rooms.push({ x0, y0, x1, y1, size });
  }
}

const toM = (v, axis) => (v - (axis === 'x' ? minX : minY)) / PX_PER_M;
const r2 = (v) => Math.round(v * 100) / 100;
console.log(`vlines=${vlines.length} hlines=${hlines.length} openings=${openings.length} rooms=${rooms.length}`);
for (const r of rooms.sort((a, b) => b.size - a.size)) {
  const w = r2((r.x1 - r.x0 + 1) / PX_PER_M), d = r2((r.y1 - r.y0 + 1) / PX_PER_M);
  console.log(`  (${r2(toM(r.x0, 'x'))},${r2(toM(r.y0, 'y'))})-(${r2(toM(r.x1, 'x'))},${r2(toM(r.y1, 'y'))})  ${w} x ${d} = ${r2(w * d)} m2`);
}

if (GRID_OVERLAY) {
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
  vlines.forEach((l) => { for (let y = 0; y < H; y++) for (let d = -1; d <= 1; d++) paint(l.at + d, y, [220, 40, 40]); });
  hlines.forEach((l) => { for (let x = 0; x < W; x++) for (let d = -1; d <= 1; d++) paint(x, l.at + d, [30, 90, 220]); });
  await writeFile('input/grid-overlay.png', PNG.sync.write(ov));
  console.log('grid overlay: V at px', vlines.map((l) => l.at).join(','), '| H at px', hlines.map((l) => l.at).join(','));
}

const out = new PNG({ width: W, height: H });
for (let i = 0; i < N; i++) {
  const v = closedMask[i] ? 0 : 255;
  out.data[i * 4] = v; out.data[i * 4 + 1] = v; out.data[i * 4 + 2] = v; out.data[i * 4 + 3] = 255;
}
await writeFile('input/grid-mask.png', PNG.sync.write(out));
console.log('wrote input/grid-mask.png');

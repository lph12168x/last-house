import { readFile, writeFile } from 'node:fs/promises';
import pngjs from 'pngjs';
const { PNG } = pngjs;

const T = Number(process.env.T ?? 120);
const G = Number(process.env.G ?? 10);
const MIN = Number(process.env.MIN ?? 6);
const MIN_COMP = Number(process.env.MIN_COMP ?? 600);
const LONG = Number(process.env.LONG ?? 70);

const src = process.argv[2] ?? 'input/real-plan.png';
const png = PNG.sync.read(await readFile(src));
const W = png.width, H = png.height, N = W * H;
const idx = (x, y) => y * W + x;
const gray = new Uint8Array(N);
for (let i = 0; i < N; i++) gray[i] = png.data[i * 4];

const m = new Uint8Array(N);
for (let i = 0; i < N; i++) m[i] = gray[i] < T ? 1 : 0;
{
  const long = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      if (!m[idx(x, y)]) { x++; continue; }
      const s = x;
      while (x < W && m[idx(x, y)]) x++;
      if (x - s >= LONG) for (let k = s; k < x; k++) long[idx(k, y)] = 1;
    }
  }
  for (let x = 0; x < W; x++) {
    let y = 0;
    while (y < H) {
      if (!m[idx(x, y)]) { y++; continue; }
      const s = y;
      while (y < H && m[idx(x, y)]) y++;
      if (y - s >= LONG) for (let k = s; k < y; k++) long[idx(x, k)] = 1;
    }
  }
  for (let i = 0; i < N; i++) m[i] = long[i];
}

// 1D closing along each axis: bridge white gaps up to G px, which fuses a double-line wall's two
// leaves into one solid band while leaving furniture lines (spaced further apart) separate.
function closeAxis(horizontal) {
  const outer = horizontal ? H : W;
  const inner = horizontal ? W : H;
  const at = horizontal ? (o, i) => idx(i, o) : (o, i) => idx(o, i);
  for (let o = 0; o < outer; o++) {
    let i = 0;
    while (i < inner) {
      if (!m[at(o, i)]) { i++; continue; }
      const end = (() => { let j = i; while (j < inner && m[at(o, j)]) j++; return j - 1; })();
      let k = end + 1;
      while (k < inner) {
        let gap = 0;
        while (k + gap < inner && !m[at(o, k + gap)]) gap++;
        if (gap === 0 || gap > G) break;
        let j = k + gap;
        while (j < inner && m[at(o, j)]) j++;
        for (let f = k; f < j; f++) m[at(o, f)] = 1;
        k = j;
      }
      i = k > i ? k : end + 1;
    }
  }
}
closeAxis(true);
closeAxis(false);

const h = new Uint8Array(N);
const v = new Uint8Array(N);
for (let y = 0; y < H; y++) {
  let x = 0;
  while (x < W) {
    if (!m[idx(x, y)]) { x++; continue; }
    const s = x;
    while (x < W && m[idx(x, y)]) x++;
    if (x - s >= MIN) for (let k = s; k < x; k++) h[idx(k, y)] = 1;
  }
}
for (let x = 0; x < W; x++) {
  let y = 0;
  while (y < H) {
    if (!m[idx(x, y)]) { y++; continue; }
    const s = y;
    while (y < H && m[idx(x, y)]) y++;
    if (y - s >= MIN) for (let k = s; k < y; k++) v[idx(x, k)] = 1;
  }
}
const thick = new Uint8Array(N);
for (let i = 0; i < N; i++) thick[i] = h[i] && v[i] ? 1 : 0;

const label = new Int32Array(N).fill(-1);
const sizes = [];
const stack = new Int32Array(N);
for (let s = 0; s < N; s++) {
  if (!thick[s] || label[s] !== -1) continue;
  const id = sizes.length;
  let sp = 0;
  let size = 0;
  let x0 = s % W; let x1 = x0; let y0 = (s - x0) / W; let y1 = y0;
  label[s] = id;
  stack[sp++] = s;
  while (sp > 0) {
    const p = stack[--sp];
    const px = p % W;
    const py = (p - px) / W;
    size++;
    if (px < x0) x0 = px;
    if (px > x1) x1 = px;
    if (py < y0) y0 = py;
    if (py > y1) y1 = py;
    for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const np = idx(nx, ny);
      if (thick[np] && label[np] === -1) { label[np] = id; stack[sp++] = np; }
    }
  }
  sizes.push({ id, size, x0, y0, x1, y1 });
}
const keep = new Uint8Array(N);
for (const c of sizes) {
  if (c.size < MIN_COMP) continue;
  for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) if (thick[idx(x, y)] && label[idx(x, y)] === c.id) keep[idx(x, y)] = 1;
}
console.log(`T=${T} G=${G} MIN=${MIN}  闭运算后暗像素=${m.reduce((a, b) => a + b, 0)}  thick=${thick.reduce((a, b) => a + b, 0)}  保留=${keep.reduce((a, b) => a + b, 0)}`);
console.log('大连通域 (size / w x h):', sizes.filter((c) => c.size >= MIN_COMP).sort((a, b) => b.size - a.size).slice(0, 8).map((c) => `${c.size}@${c.x1 - c.x0 + 1}x${c.y1 - c.y0 + 1}`).join('  '));

const out = new PNG({ width: W, height: H });
for (let i = 0; i < N; i++) {
  const on = keep[i];
  out.data[i * 4] = on ? 0 : 255;
  out.data[i * 4 + 1] = on ? 0 : 255;
  out.data[i * 4 + 2] = on ? 0 : 255;
  out.data[i * 4 + 3] = 255;
}
await writeFile('input/walls-debug.png', PNG.sync.write(out));
console.log('wrote input/walls-debug.png');

if (process.env.ROOMS) {
  const PX_PER_M = Number(process.env.PX_PER_M ?? 49);
  const MIN_GAP = Number(process.env.MIN_GAP ?? 35);
  const MAX_GAP = Number(process.env.MAX_GAP ?? 220);
  const MIN_BAND = Number(process.env.MIN_BAND ?? 30);
  const wall = keep;
  const bridged = Uint8Array.from(wall);
  const found = [];

  function bridge(horizontal) {
    const outer = horizontal ? H : W;
    const inner = horizontal ? W : H;
    for (let o = 0; o < outer; o++) {
      const runs = [];
      let i = 0;
      while (i < inner) {
        if (!wall[horizontal ? idx(i, o) : idx(o, i)]) { i++; continue; }
        const s = i;
        while (i < inner && wall[horizontal ? idx(i, o) : idx(o, i)]) i++;
        runs.push([s, i - 1]);
      }
      for (let r = 0; r + 1 < runs.length; r++) {
        const [a0, a1] = runs[r];
        const [b0, b1] = runs[r + 1];
        const gap = b0 - a1 - 1;
        if (gap < MIN_GAP || gap > MAX_GAP) continue;
        if (a1 - a0 + 1 < MIN_BAND || b1 - b0 + 1 < MIN_BAND) continue;
        for (let k = a1 + 1; k <= b0 - 1; k++) {
          if (horizontal) bridged[idx(k, o)] = 1;
          else bridged[idx(o, k)] = 1;
        }
        found.push({ horizontal, o, from: a1 + 1, to: b0 - 1 });
      }
    }
  }
  bridge(true);
  bridge(false);

  const free = Uint8Array.from(bridged, (x) => (x ? 0 : 1));
  const seen = new Uint8Array(N);
  const rooms = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = idx(x, y);
      if (!free[p] || seen[p]) continue;
      const st = [p];
      seen[p] = 1;
      let size = 0;
      let x0 = x; let x1 = x; let y0 = y; let y1 = y;
      while (st.length) {
        const q = st.pop();
        const qx = q % W;
        const qy = (q - qx) / W;
        size++;
        if (qx < x0) x0 = qx;
        if (qx > x1) x1 = qx;
        if (qy < y0) y0 = qy;
        if (qy > y1) y1 = qy;
        for (const [nx, ny] of [[qx - 1, qy], [qx + 1, qy], [qx, qy - 1], [qx, qy + 1]]) {
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const np = idx(nx, ny);
          if (free[np] && !seen[np]) { seen[np] = 1; st.push(np); }
        }
      }
      const w = (x1 - x0 + 1) / PX_PER_M;
      const d = (y1 - y0 + 1) / PX_PER_M;
      if (size < 3000 || w < 1 || d < 1 || w > 14 || d > 14) continue;
      rooms.push({ x0, y0, x1, y1, size, w: Math.round(w * 100) / 100, d: Math.round(d * 100) / 100, fill: Math.round((size / ((x1 - x0 + 1) * (y1 - y0 + 1))) * 100) / 100 });
    }
  }
  console.log(`\nPX_PER_M=${PX_PER_M}  桥接开口 ${found.length} 个  候选房间 ${rooms.length} 个`);
  for (const r of rooms.sort((a, b) => b.size - a.size)) {
    console.log(`  bbox=(${r.x0},${r.y0})-(${r.x1},${r.y1})  ${r.w}m x ${r.d}m = ${(r.w * r.d).toFixed(1)}m2  fill=${r.fill}`);
  }
}

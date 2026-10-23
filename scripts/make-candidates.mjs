import { readFile, writeFile } from 'node:fs/promises';
import pngjs from 'pngjs';
const { PNG } = pngjs;

const E = process.env;
const INK = Number(E.INK ?? 200);
const MIN_RUN = Number(E.MIN_RUN ?? 20);
const MIN_LEN_M = Number(E.MIN_LEN_M ?? 0.8);
const X0 = Number(E.X0 ?? 470);
const Y0 = Number(E.Y0 ?? 638);
const SX = Number(E.SX ?? 49.32);
const SY = Number(E.SY ?? 49.35);
const BOX = { x0: 455, y0: 620, x1: 1165, y1: 1210 };
const AXES_X = [0, 3.8, 10.4, 13.6];
const AXES_Z = [0, 1.1, 3.5, 4.9, 6.4, 9.9, 11.0];

const png = PNG.sync.read(await readFile('input/real-plan.png'));
const W = png.width, H = png.height, N = W * H;
const gray = new Uint8Array(N);
for (let i = 0; i < N; i++) gray[i] = png.data[i * 4];
const ink = new Uint8Array(N);
for (let i = 0; i < N; i++) ink[i] = gray[i] < INK ? 1 : 0;

// 1px tolerance absorbs scan jitter; and keeps the two leaves of one wall apart
const dil = new Uint8Array(N);
for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
  if (!ink[y * W + x]) continue;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) dil[(y + dy) * W + x + dx] = 1;
}

function collectRuns(horizontal) {
  const runs = [];
  const outer = horizontal ? H : W, inner = horizontal ? W : H;
  for (let o = 0; o < outer; o++) {
    let i = 0;
    while (i < inner) {
      const on = horizontal ? dil[o * W + i] : dil[i * W + o];
      if (!on) { i++; continue; }
      const s = i;
      while (i < inner && (horizontal ? dil[o * W + i] : dil[i * W + o])) i++;
      if (i - s >= MIN_RUN) runs.push({ o, a: s, b: i - 1 });
    }
  }
  return runs;
}

function groupRuns(runs) {
  runs.sort((p, q) => p.o - q.o || p.a - q.a);
  const bands = [];
  for (const r of runs) {
    let best = null;
    for (let k = bands.length - 1; k >= 0; k--) {
      const b = bands[k];
      if (r.o - b.oLast > 2) break;
      if (r.o - b.oLast < -2) continue;
      const overlap = Math.min(b.x1, r.b) - Math.max(b.x0, r.a);
      const gap = r.a > b.x1 ? r.a - b.x1 : b.x0 > r.b ? b.x0 - r.b : 0;
      if (overlap >= -2 || gap <= 30) { best = b; break; }
    }
    if (!best) bands.push({ o: r.o, oLast: r.o, x0: r.a, x1: r.b, runs: [r] });
    else {
      best.oLast = r.o;
      best.x0 = Math.min(best.x0, r.a);
      best.x1 = Math.max(best.x1, r.b);
      best.runs.push(r);
      best.o = Math.round(best.runs.reduce((s, q) => s + q.o, 0) / best.runs.length);
    }
  }
  return bands;
}

const spanRows = (b) => Math.max(...b.runs.map((r) => r.o)) - Math.min(...b.runs.map((r) => r.o)) + 1;

function intervals(runs) {
  const s = [...runs].sort((p, q) => p.a - q.a);
  const out = [];
  for (const r of s) {
    const last = out[out.length - 1];
    if (last && r.a <= last.b + 3) last.b = Math.max(last.b, r.b);
    else out.push({ a: r.a, b: r.b });
  }
  return out;
}

function wallCandidates(bands) {
  const walls = [];
  for (const b of bands) if (spanRows(b) >= 3) walls.push({ line: b.o, thick: spanRows(b), members: [b] });
  for (let i = 0; i < bands.length; i++) {
    for (let j = i + 1; j < bands.length; j++) {
      const a = bands[i], b = bands[j];
      const d = Math.abs(a.o - b.o);
      if (d < 3 || d > 10) continue;
      if (Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) < 30) continue;
      walls.push({ line: (a.o + b.o) / 2, thick: d, members: [a, b] });
    }
  }
  return walls;
}

const snapAxis = (v, axes) => {
  let best = v, d = Infinity;
  for (const a of axes) if (Math.abs(a - v) < d) { d = Math.abs(a - v); best = a; }
  return d <= 0.07 ? best : Math.round(v / 0.05) * 0.05;
};
const worldX = (px) => (px - X0) / SX;
const worldZ = (py) => (py - Y0) / SY;

const walls = [];
for (const horizontal of [true, false]) {
  const bands = groupRuns(collectRuns(horizontal));
  for (const wall of wallCandidates(bands)) {
    if (horizontal && (wall.line < BOX.y0 || wall.line > BOX.y1)) continue;
    if (!horizontal && (wall.line < BOX.x0 || wall.line > BOX.x1)) continue;
    const members = wall.members.flatMap((m) => m.runs);
    for (const seg of intervals(members)) {
      const lenPx = seg.b - seg.a + 1;
      if (lenPx < MIN_LEN_M * (horizontal ? SX : SY)) continue;
      let x0, z0, x1, z1;
      if (horizontal) {
        const z = snapAxis(worldZ(wall.line), AXES_Z);
        x0 = snapAxis(worldX(seg.a), AXES_X);
        x1 = snapAxis(worldX(seg.b), AXES_X);
        z0 = z1 = z;
      } else {
        const x = snapAxis(worldX(wall.line), AXES_X);
        z0 = snapAxis(worldZ(seg.a), AXES_Z);
        z1 = snapAxis(worldZ(seg.b), AXES_Z);
        x0 = x1 = x;
      }
      if (x0 === x1 && z0 === z1) continue;
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < MIN_LEN_M) continue;
      walls.push({ x0, z0, x1, z1, len: Math.round(len * 1000) / 1000, thick: Math.round((wall.thick / SX) * 1000) / 1000 });
    }
  }
}

walls.sort((a, b) => b.len - a.len);
const unique = [];
for (const w of walls) {
  const dup = unique.find((u) => {
    const sameH = Math.abs(u.z0 - w.z0) < 0.03 && Math.abs(u.z1 - w.z1) < 0.03;
    const sameV = Math.abs(u.x0 - w.x0) < 0.03 && Math.abs(u.x1 - w.x1) < 0.03;
    if (!sameH && !sameV) return false;
    if (sameH) return Math.min(u.x1, w.x1) - Math.max(u.x0, w.x0) > 0.7 * Math.min(u.x1 - u.x0, w.x1 - w.x0);
    return Math.min(u.z1, w.z1) - Math.max(u.z0, w.z0) > 0.7 * Math.min(u.z1 - u.z0, w.z1 - w.z0);
  });
  if (!dup) unique.push(w);
}

let doorRaw = [];
try {
  doorRaw = JSON.parse(await readFile('input/doors-detected.json', 'utf8')).doors ?? [];
} catch {}
const doors = [];
for (const d of doorRaw) {
  if (d.score < 0.78) continue;
  const cx = d.hingePx.x, cy = d.hingePx.y;
  if (cx < BOX.x0 || cx > BOX.x1 || cy < BOX.y0 || cy > BOX.y1) continue;
  if (doors.some((k) => Math.hypot(k.px[0] - cx, k.px[1] - cy) < 16)) continue;
  doors.push({
    px: [cx, cy],
    width: d.width,
    hinge: [Math.round(worldX(cx) * 1000) / 1000, Math.round(worldZ(cy) * 1000) / 1000],
    open: d.open,
    swing: d.swing,
    score: d.score,
  });
}

const out = {
  source: 'real-plan.png',
  calibration: { x0: X0, y0: Y0, sx: SX, sy: SY },
  axes: { x: AXES_X, z: AXES_Z },
  walls: unique.slice(0, 140),
  doors: doors.slice(0, 40),
};
await writeFile('public/plans/plan-candidates.json', JSON.stringify(out, null, 2));
console.log(`walls=${out.walls.length} doors=${out.doors.length} -> public/plans/plan-candidates.json`);

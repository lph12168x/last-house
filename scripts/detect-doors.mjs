import { readFile, writeFile } from 'node:fs/promises';
import pngjs from 'pngjs';
const { PNG } = pngjs;

const E = process.env;
const INK = Number(E.INK ?? 200);
const MIN_RUN = Number(E.MIN_RUN ?? 18);
const MIN_GAP = Number(E.MIN_GAP ?? 22);
const MAX_GAP = Number(E.MAX_GAP ?? 95);
const X0 = Number(E.X0 ?? 470);
const Y0 = Number(E.Y0 ?? 638);
const SX = Number(E.SX ?? 49.32);
const SY = Number(E.SY ?? 49.35);
const MIN_W = Number(E.MIN_W ?? 0.55);
const MAX_W = Number(E.MAX_W ?? 1.35);
const ARC_MIN = Number(E.ARC_MIN ?? 0.6);
const LEAF_MIN = Number(E.LEAF_MIN ?? 0.5);
const CLEAR_MIN = Number(E.CLEAR_MIN ?? 0.8);
const BOX = { x0: 455, y0: 620, x1: 1165, y1: 1210 };

const png = PNG.sync.read(await readFile(process.argv[2] ?? 'input/real-plan.png'));
const W = png.width;
const H = png.height;
const N = W * H;
const gray = new Uint8Array(N);
for (let i = 0; i < N; i++) gray[i] = png.data[i * 4];
const ink = new Uint8Array(N);
for (let i = 0; i < N; i++) ink[i] = gray[i] < INK ? 1 : 0;

function dilate(r) {
  const out = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!ink[y * W + x]) continue;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H) out[ny * W + nx] = 1;
        }
      }
    }
  }
  return out;
}
const near2 = dilate(2);
const near3 = dilate(3);

function collectRuns(horizontal) {
  const runs = [];
  const outer = horizontal ? H : W;
  const inner = horizontal ? W : H;
  for (let o = 0; o < outer; o++) {
    let i = 0;
    while (i < inner) {
      const on = horizontal ? ink[o * W + i] : ink[i * W + o];
      if (!on) {
        i++;
        continue;
      }
      const s = i;
      while (i < inner && (horizontal ? ink[o * W + i] : ink[i * W + o])) i++;
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
      if (overlap >= -2 || gap <= MAX_GAP + 5) {
        best = b;
        break;
      }
    }
    if (!best) {
      bands.push({ o: r.o, oLast: r.o, x0: r.a, x1: r.b, runs: [r] });
    } else {
      best.oLast = r.o;
      best.x0 = Math.min(best.x0, r.a);
      best.x1 = Math.max(best.x1, r.b);
      best.runs.push(r);
      best.o = Math.round(best.runs.reduce((s, q) => s + q.o, 0) / best.runs.length);
    }
  }
  return bands;
}

function mergedIntervals(runs) {
  const s = [...runs].sort((p, q) => p.a - q.a);
  const out = [];
  for (const r of s) {
    const last = out[out.length - 1];
    if (last && r.a <= last.b + 2) last.b = Math.max(last.b, r.b);
    else out.push({ a: r.a, b: r.b });
  }
  return out;
}

function arcCoverage(cx, cy, r, t0, t1) {
  let hit = 0;
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const x = Math.round(cx + Math.cos(t) * r);
    const y = Math.round(cy + Math.sin(t) * r);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    if (near3[y * W + x]) hit++;
  }
  return hit / (n + 1);
}

function leafCoverage(cx, cy, r, t) {
  let hit = 0;
  const n = 14;
  for (let i = 0; i < n; i++) {
    const d = r * (0.15 + (0.8 * i) / (n - 1));
    const x = Math.round(cx + Math.cos(t) * d);
    const y = Math.round(cy + Math.sin(t) * d);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    if (near2[y * W + x]) hit++;
  }
  return hit / n;
}

function gapClear(cx, cy, r, tOpen, half) {
  let clear = 0;
  const n = 16;
  const px = Math.cos(tOpen + Math.PI / 2);
  const py = Math.sin(tOpen + Math.PI / 2);
  for (let i = 0; i < n; i++) {
    const d = r * (0.12 + (0.76 * i) / (n - 1));
    const bx = cx + Math.cos(tOpen) * d;
    const by = cy + Math.sin(tOpen) * d;
    let found = false;
    for (let s = -half; s <= half; s++) {
      if (Math.abs(s) <= 1.5) continue;
      const x = Math.round(bx + px * s);
      const y = Math.round(by + py * s);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      if (ink[y * W + x]) {
        found = true;
        break;
      }
    }
    if (!found) clear++;
  }
  return clear / n;
}

function hingeSideCoverage(cx, cy, tOpen) {
  let hit = 0;
  for (let d = 2; d <= 6; d += 2) {
    const x = Math.round(cx - Math.cos(tOpen) * d);
    const y = Math.round(cy - Math.sin(tOpen) * d);
    if (x >= 0 && y >= 0 && x < W && y < H && near2[y * W + x]) hit++;
  }
  return hit / 3;
}

const doors = [];
function testGap(orient, line, gap, thick) {
  if (orient === 'h' && (line < BOX.y0 || line > BOX.y1)) return;
  if (orient === 'v' && (line < BOX.x0 || line > BOX.x1)) return;
  if (orient === 'h' && (gap.b < BOX.x0 || gap.a > BOX.x1)) return;
  if (orient === 'v' && (gap.b < BOX.y0 || gap.a > BOX.y1)) return;
  const half = Math.max(2, Math.round(thick / 2) + 1);
  let best = null;
  for (let r = gap.b - gap.a - 3; r <= gap.b - gap.a + 4; r++) {
    const wm = r / (orient === 'h' ? SX : SY);
    if (wm < MIN_W || wm > MAX_W) continue;
    for (const side of ['lo', 'hi']) {
      const hinge = side === 'lo' ? gap.a : gap.b;
      const tOpen = orient === 'h' ? (side === 'lo' ? 0 : Math.PI) : side === 'lo' ? Math.PI / 2 : -Math.PI / 2;
      for (const swing of [1, -1]) {
        const tLeaf = tOpen + (swing * Math.PI) / 2;
        for (const off of [0, thick / 2, -thick / 2, thick / 2 - 1, -thick / 2 + 1]) {
          const cx = orient === 'h' ? hinge : line + off;
          const cy = orient === 'h' ? line + off : hinge;
          if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
          const arc = arcCoverage(cx, cy, r, tOpen, tLeaf);
          if (arc < ARC_MIN) continue;
          const leaf = leafCoverage(cx, cy, r, tLeaf);
          if (leaf < LEAF_MIN) continue;
          const clear = gapClear(cx, cy, r, tOpen, half);
          if (clear < CLEAR_MIN) continue;
          const jamb = hingeSideCoverage(cx, cy, tOpen);
          if (jamb < 0.6) continue;
          const score = 0.45 * arc + 0.3 * leaf + 0.2 * clear + 0.05 * jamb;
          const cand = {
            orient,
            line,
            gap: { a: gap.a, b: gap.b },
            hinge: { x: cx, y: cy },
            r,
            tOpen,
            tLeaf,
            arc,
            leaf,
            clear,
            jamb,
            score,
            thick,
            width: Math.round(wm * 100) / 100,
          };
          if (!best || score > best.score) best = cand;
        }
      }
    }
  }
  if (best) doors.push(best);
}

function spanRows(band) {
  const rows = [...new Set(band.runs.map((r) => r.o))];
  return Math.max(...rows) - Math.min(...rows) + 1;
}

// a wall is either a filled thick band or a pair of thin parallel leaves 3-10px apart
function wallCandidates(bands) {
  const walls = [];
  for (const b of bands) {
    if (spanRows(b) >= 3) walls.push({ line: b.o, thick: spanRows(b), members: [b] });
  }
  for (let i = 0; i < bands.length; i++) {
    for (let j = i + 1; j < bands.length; j++) {
      const a = bands[i], b = bands[j];
      const d = Math.abs(a.o - b.o);
      if (d < 3 || d > 10) continue;
      const ov = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      if (ov < 30) continue;
      walls.push({ line: (a.o + b.o) / 2, thick: d, members: [a, b] });
    }
  }
  return walls;
}

// fraction of [a,b] where a member band has ink (used to require the gap in every leaf)
function occupancy(member, a, b) {
  const rows = spanRows(member);
  const o0 = Math.min(...member.runs.map((r) => r.o));
  let hit = 0;
  let n = 0;
  for (let x = a; x <= b; x++) {
    n++;
    let inkCol = false;
    for (let o = o0; o < o0 + rows && !inkCol; o++) {
      if (member.runs.some((r) => r.o === o && x >= r.a && x <= r.b)) inkCol = true;
    }
    if (inkCol) hit++;
  }
  return n ? hit / n : 0;
}

// A door opening keeps its threshold line: inside the wall band only the centre-line may have ink.
// Anything painted on the two faces (or solid poché) means the wall is still there.
function openRuns(wall, horizontal) {
  let a = Infinity, b = -Infinity;
  for (const m of wall.members) {
    for (const r of m.runs) {
      a = Math.min(a, r.a);
      b = Math.max(b, r.b);
    }
  }
  const half = Math.max(2, Math.ceil(wall.thick / 2) + 1);
  const open = new Uint8Array(b - a + 1);
  for (let i = a; i <= b; i++) {
    let isOpen = true;
    for (let s = -half; s <= half; s++) {
      if (Math.abs(s) <= 1.5) continue;
      const x = horizontal ? i : wall.line + s;
      const y = horizontal ? wall.line + s : i;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      if (ink[y * W + x]) {
        isOpen = false;
        break;
      }
    }
    open[i - a] = isOpen ? 1 : 0;
  }
  const out = [];
  let s = -1;
  for (let k = 0; k <= open.length; k++) {
    if (k < open.length && open[k]) {
      if (s < 0) s = k;
    } else if (s >= 0) {
      const len = k - s;
      if (len >= MIN_GAP && len <= MAX_GAP + 10) out.push({ a: a + s, b: a + k - 1 });
      s = -1;
    }
  }
  return out;
}

for (const horizontal of [true, false]) {
  const bands = groupRuns(collectRuns(horizontal));
  const walls = wallCandidates(bands);
  const seen = new Set();
  for (const wall of walls) {
    for (const gap of openRuns(wall, horizontal)) {
      const key = `${horizontal ? 'h' : 'v'}:${Math.round(wall.line)}:${gap.a}:${gap.b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      testGap(horizontal ? 'h' : 'v', wall.line, gap, wall.thick);
    }
  }
}

doors.sort((p, q) => q.score - p.score);
const kept = [];
for (const d of doors) {
  const dup = kept.find(
    (k) => Math.abs(k.hinge.x - d.hinge.x) < 10 && Math.abs(k.hinge.y - d.hinge.y) < 10 && Math.abs(k.r - d.r) < 10,
  );
  if (!dup) kept.push(d);
}
kept.sort((p, q) => p.hinge.y - q.hinge.y || p.hinge.x - q.hinge.x);

const toWorld = (x, y) => ({
  x: Math.round(((x - X0) / SX) * 1000) / 1000,
  z: Math.round(((y - Y0) / SY) * 1000) / 1000,
});
console.log('doors=' + kept.length);
for (const d of kept) {
  const centerPx = {
    x: d.hinge.x + (Math.cos(d.tOpen) * d.r) / 2,
    y: d.hinge.y + (Math.sin(d.tOpen) * d.r) / 2,
  };
  const c = toWorld(centerPx.x, centerPx.y);
  const dx = Math.round(Math.cos(d.tOpen) * 100) / 100;
  const dy = Math.round(Math.sin(d.tOpen) * 100) / 100;
  const sx = Math.round(Math.cos(d.tLeaf) * 100) / 100;
  const sy = Math.round(Math.sin(d.tLeaf) * 100) / 100;
  console.log(
    `${d.orient} hinge=(${d.hinge.x},${d.hinge.y}) r=${d.r}px w=${d.width}m center=(${c.x},${c.z}) open=(${dx},${dy}) swing=(${sx},${sy}) arc=${d.arc.toFixed(2)} leaf=${d.leaf.toFixed(2)} clear=${d.clear.toFixed(2)} score=${d.score.toFixed(2)}`,
  );
}

const out = new PNG({ width: W, height: H });
for (let i = 0; i < N; i++) {
  const g = gray[i];
  out.data[i * 4] = g;
  out.data[i * 4 + 1] = g;
  out.data[i * 4 + 2] = g;
  out.data[i * 4 + 3] = 255;
}
const paint = (x, y, c, rad = 0) => {
  for (let dy = -rad; dy <= rad; dy++) {
    for (let dx = -rad; dx <= rad; dx++) {
      const nx = Math.round(x + dx);
      const ny = Math.round(y + dy);
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const o = (ny * W + nx) * 4;
      out.data[o] = c[0];
      out.data[o + 1] = c[1];
      out.data[o + 2] = c[2];
    }
  }
};
for (const d of kept) {
  for (let i = 0; i <= 40; i++) {
    const t = d.tOpen + ((d.tLeaf - d.tOpen) * i) / 40;
    paint(d.hinge.x + Math.cos(t) * d.r, d.hinge.y + Math.sin(t) * d.r, [0, 170, 0]);
  }
  for (let i = 0; i <= 30; i++) {
    const dd = (d.r * i) / 30;
    paint(d.hinge.x + Math.cos(d.tLeaf) * dd, d.hinge.y + Math.sin(d.tLeaf) * dd, [0, 90, 230]);
  }
  for (let i = 0; i <= 30; i++) {
    const dd = (d.r * i) / 30;
    paint(d.hinge.x + Math.cos(d.tOpen) * dd, d.hinge.y + Math.sin(d.tOpen) * dd, [255, 140, 0]);
  }
  paint(d.hinge.x, d.hinge.y, [220, 0, 0], 2);
}
await writeFile('input/doors-detected.png', PNG.sync.write(out));
await writeFile(
  'input/doors-detected.json',
  JSON.stringify(
    {
      scale: { x0: X0, y0: Y0, sx: SX, sy: SY },
      doors: kept.map((d) => ({
        orient: d.orient,
        linePx: d.line,
        gapPx: d.gap,
        hingePx: d.hinge,
        radiusPx: d.r,
        width: d.width,
        hingeWorld: toWorld(d.hinge.x, d.hinge.y),
        open: [Math.round(Math.cos(d.tOpen) * 100) / 100, Math.round(Math.sin(d.tOpen) * 100) / 100],
        swing: [Math.round(Math.cos(d.tLeaf) * 100) / 100, Math.round(Math.sin(d.tLeaf) * 100) / 100],
        score: Math.round(d.score * 1000) / 1000,
      })),
    },
    null,
    2,
  ),
);
console.log('wrote input/doors-detected.png / .json');

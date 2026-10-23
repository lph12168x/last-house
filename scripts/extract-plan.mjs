import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pngjs from 'pngjs';

const { PNG } = pngjs;
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const imageArg = process.argv[2] ?? 'public/plans/demo-3br.png';
const truthArg = process.argv[3] ?? 'plans/demo-3br.json';
const THRESHOLD = Number(process.env.THRESHOLD ?? 60);
const MIN_RUN = Number(process.env.MIN_RUN ?? 6);
const MIN_BAND = Number(process.env.MIN_BAND ?? 40);
const MIN_GAP = Number(process.env.MIN_GAP ?? 45);
const MAX_GAP = Number(process.env.MAX_GAP ?? 280);

const png = PNG.sync.read(await readFile(resolve(root, imageArg)));
const W = png.width;
const H = png.height;
const dark = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) {
  const o = i * 4;
  const luma = 0.299 * png.data[o] + 0.587 * png.data[o + 1] + 0.114 * png.data[o + 2];
  dark[i] = luma < THRESHOLD ? 1 : 0;
}

const idx = (x, y) => y * W + x;

// Walls are >= MIN_RUN px thick; room labels, dimension lines and door swings are thinner and get dropped.
function runsInRow(y) {
  const runs = [];
  let x = 0;
  while (x < W) {
    if (!dark[idx(x, y)]) { x++; continue; }
    const start = x;
    while (x < W && dark[idx(x, y)]) x++;
    runs.push([start, x - 1]);
  }
  return runs;
}

function runsInColumn(x) {
  const runs = [];
  let y = 0;
  while (y < H) {
    if (!dark[idx(x, y)]) { y++; continue; }
    const start = y;
    while (y < H && dark[idx(x, y)]) y++;
    runs.push([start, y - 1]);
  }
  return runs;
}

// A pixel is wall only when it sits in a long run BOTH horizontally and vertically: a wall band is thick
// across its own axis and long along it, while door leaves, label glyphs and window lines are thin ways.
const hThick = new Uint8Array(W * H);
const vThick = new Uint8Array(W * H);
for (let y = 0; y < H; y++) {
  for (const [a, b] of runsInRow(y)) {
    if (b - a + 1 >= MIN_RUN) for (let x = a; x <= b; x++) hThick[idx(x, y)] = 1;
  }
}
for (let x = 0; x < W; x++) {
  for (const [a, b] of runsInColumn(x)) {
    if (b - a + 1 >= MIN_RUN) for (let y = a; y <= b; y++) vThick[idx(x, y)] = 1;
  }
}
const thick = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) thick[i] = hThick[i] && vThick[i] ? 1 : 0;

// The scale bar is a solid 1 m bar parked in the bottom margin, so the longest thick run down there is it.
// Measure and erase it first, then keep every remaining thick pixel as wall: every opening cuts the wall
// network apart, so filtering to the largest component would drop all but one fragment.
let pxPerM = Number(process.env.PX_PER_M ?? 0);
{
  let longest = 0;
  let found = null;
  for (let y = Math.max(0, H - 120); y < H; y++) {
    let x = 0;
    while (x < W) {
      if (!thick[idx(x, y)]) { x++; continue; }
      const start = x;
      while (x < W && thick[idx(x, y)]) x++;
      if (x - start > longest) { longest = x - start; found = { x0: start, x1: x - 1, y0: y }; }
    }
  }
  if (!found || longest < 20) {
    console.error('no scale bar found in the bottom margin; set PX_PER_M explicitly');
    process.exit(1);
  }
  for (let y = Math.max(0, found.y0 - 14); y < H; y++) {
    for (let x = Math.max(0, found.x0 - 14); x <= Math.min(W - 1, found.x1 + 90); x++) thick[idx(x, y)] = 0;
  }
  if (!pxPerM) pxPerM = longest;
}

const wall = thick;
let minX = W; let maxX = 0; let minY = H; let maxY = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!wall[idx(x, y)]) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
}
const wallPx = Math.max(4, Math.round(pxPerM * (Number(process.env.WALL_M ?? 0.12))));

// Doors and windows are breaks in an otherwise continuous wall band. Bridge them so flood fill cannot
// leak from room to room, and remember each bridge as a candidate opening.
const openings = [];
const bridged = Uint8Array.from(wall);

function bridgeAxis(horizontal) {
  const outer = horizontal ? H : W;
  const inner = horizontal ? W : H;
  for (let o = 0; o < outer; o++) {
    const runs = [];
    let i = 0;
    while (i < inner) {
      const at = horizontal ? idx(i, o) : idx(o, i);
      if (!wall[at]) { i++; continue; }
      const start = i;
      while (i < inner && (horizontal ? wall[idx(i, o)] : wall[idx(o, i)])) i++;
      runs.push([start, i - 1]);
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
      openings.push({ horizontal, outer: o, from: a1 + 1, to: b0 - 1 });
    }
  }
}

bridgeAxis(true);
bridgeAxis(false);

// Flood fill the space left of the bridged walls: each sealed blob is one room.
const roomMask = Uint8Array.from(bridged, (v) => (v ? 0 : 1));
const visited = new Uint8Array(W * H);
const rooms = [];
const minRoomArea = (pxPerM * pxPerM) * 0.6;

for (let y = minY; y <= maxY; y++) {
  for (let x = minX; x <= maxX; x++) {
    const p = idx(x, y);
    if (!roomMask[p] || visited[p]) continue;
    const stack = [p];
    visited[p] = 1;
    let size = 0;
    let rx0 = x; let rx1 = x; let ry0 = y; let ry1 = y;
    let touchesFrame = false;
    while (stack.length) {
      const q = stack.pop();
      const qx = q % W;
      const qy = (q - qx) / W;
      size++;
      if (qx < rx0) rx0 = qx;
      if (qx > rx1) rx1 = qx;
      if (qy < ry0) ry0 = qy;
      if (qy > ry1) ry1 = qy;
      if (qx <= minX || qx >= maxX || qy <= minY || qy >= maxY) touchesFrame = true;
      for (const [nx2, ny2] of [[qx - 1, qy], [qx + 1, qy], [qx, qy - 1], [qx, qy + 1]]) {
        if (nx2 < minX || nx2 > maxX || ny2 < minY || ny2 > maxY) continue;
        const np = idx(nx2, ny2);
        if (roomMask[np] && !visited[np]) { visited[np] = 1; stack.push(np); }
      }
    }
    if (touchesFrame || size < minRoomArea) continue;
    const fill = size / ((rx1 - rx0 + 1) * (ry1 - ry0 + 1));
    const pad = wallPx / 2;
    rooms.push({
      px: { x0: rx0 - pad, z0: ry0 - pad, x1: rx1 + pad, z1: ry1 + pad },
      clear: { x0: rx0, z0: ry0, x1: rx1, z1: ry1 },
      size,
      fill,
    });
  }
}

const toM = (v, axis) => (v - (axis === 'x' ? minX : minY)) / pxPerM;
for (const r of rooms) {
  r.rect = [toM(r.px.x0, 'x'), toM(r.px.z0, 'z'), toM(r.px.x1, 'x'), toM(r.px.z1, 'z')];
  r.rect = r.rect.map((v) => Math.round(v * 100) / 100);
  r.area = Math.round((r.rect[2] - r.rect[0]) * (r.rect[3] - r.rect[1]) * 100) / 100;
  r.center = [(r.rect[0] + r.rect[2]) / 2, (r.rect[1] + r.rect[3]) / 2];
  r.shape = r.fill > 0.9 ? 'rect' : 'irregular';
}

// Merge the per-row bridges back into one opening per physical gap.
function mergeOpenings(list, horizontal) {
  const groups = [];
  for (const o of list) {
    const hit = groups.find((g) => {
      const overlap = Math.min(g.to, o.to) - Math.max(g.from, o.from);
      return overlap > (o.to - o.from) * 0.5 && Math.abs(g.outerAvg - o.outer) <= wallPx;
    });
    if (hit) {
      hit.from = Math.min(hit.from, o.from);
      hit.to = Math.max(hit.to, o.to);
      hit.rows.push(o.outer);
      hit.outerAvg = hit.rows.reduce((a, b) => a + b, 0) / hit.rows.length;
    } else {
      groups.push({ horizontal, from: o.from, to: o.to, outer: o.outer, outerAvg: o.outer, rows: [o.outer] });
    }
  }
  return groups;
}

const merged = [
  ...mergeOpenings(openings.filter((o) => o.horizontal), true),
  ...mergeOpenings(openings.filter((o) => !o.horizontal), false),
];

function classify(group) {
  const half = wallPx / 2;
  let darkInside = 0;
  let span = 0;
  if (group.horizontal) {
    span = group.to - group.from + 1;
    for (let x = group.from; x <= group.to; x++) {
      for (let y = Math.round(group.outerAvg - half); y <= Math.round(group.outerAvg + half); y++) {
        if (y < 0 || y >= H || x < 0 || x >= W) continue;
        if (dark[idx(x, y)] && !wall[idx(x, y)]) darkInside++;
      }
    }
  } else {
    span = group.to - group.from + 1;
    for (let y = group.from; y <= group.to; y++) {
      for (let x = Math.round(group.outerAvg - half); x <= Math.round(group.outerAvg + half); x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        if (dark[idx(x, y)] && !wall[idx(x, y)]) darkInside++;
      }
    }
  }
  const cx = group.horizontal ? (group.from + group.to) / 2 : group.outerAvg;
  const cz = group.horizontal ? group.outerAvg : (group.from + group.to) / 2;
  const onFrame = cx <= minX + wallPx || cx >= maxX - wallPx || cz <= minY + wallPx || cz >= maxY - wallPx;
  return {
    horizontal: group.horizontal,
    cx: toM(cx, 'x'),
    cz: toM(cz, 'z'),
    widthPx: group.to - group.from + 1,
    widthM: Math.round(((group.to - group.from + 1) / pxPerM) * 100) / 100,
    kind: darkInside > span * 0.8 ? 'window' : 'door',
    exterior: onFrame,
  };
}

const detected = merged.map(classify).filter((o) => o.widthM >= 0.4 && o.widthM <= 3.5);

// Ring convention: 0 north, 1 east, 2 south, 3 west; t runs along that edge's own direction.
function attach(room, o) {
  const [x0, z0, x1, z1] = room.rect;
  const tol = 0.35;
  const cands = [];
  if (Math.abs(o.cz - z0) <= tol) cands.push({ wallIndex: 0, t: (o.cx - x0) / (x1 - x0) });
  if (Math.abs(o.cx - x1) <= tol) cands.push({ wallIndex: 1, t: (o.cz - z0) / (z1 - z0) });
  if (Math.abs(o.cz - z1) <= tol) cands.push({ wallIndex: 2, t: (x1 - o.cx) / (x1 - x0) });
  if (Math.abs(o.cx - x0) <= tol) cands.push({ wallIndex: 3, t: (z1 - o.cz) / (z1 - z0) });
  const ok = cands.filter((c) => c.t > -0.05 && c.t < 1.05);
  if (!ok.length) return null;
  const best = ok.sort((a, b) => Math.abs(a.t - 0.5) - Math.abs(b.t - 0.5))[0];
  return { wallIndex: best.wallIndex, t: Math.round(Math.min(0.95, Math.max(0.05, best.t)) * 100) / 100 };
}

const used = new Set();
for (const room of rooms) {
  room.doors = [];
  room.windows = [];
  detected.forEach((o, i) => {
    if (used.has(i)) return;
    const at = attach(room, o);
    if (!at) return;
    used.add(i);
    if (o.kind === 'door') room.doors.push({ ...at, width: o.widthM, exterior: o.exterior });
    else room.windows.push({ ...at, width: o.widthM, height: 1.4, sillHeight: 0.9 });
  });
}

const out = {
  name: '自动识别结果',
  meta: { source: imageArg, pxPerM, wallThicknessM: Math.round((wallPx / pxPerM) * 1000) / 1000, rooms: rooms.length, openings: detected.length },
  level: { height: 2.8, wallThickness: Math.round((wallPx / pxPerM) * 1000) / 1000 },
  rooms: rooms
    .sort((a, b) => a.center[1] - b.center[1] || a.center[0] - b.center[0])
    .map((r, i) => ({
      name: `房间${i + 1}`,
      rect: r.rect,
      area: r.area,
      shape: r.shape,
      ...(r.doors.length ? { doors: r.doors } : {}),
      ...(r.windows.length ? { windows: r.windows } : {}),
    })),
};

await writeFile(join(root, 'plans', 'extracted.json'), JSON.stringify(out, null, 2));

const truth = JSON.parse(await readFile(resolve(root, truthArg), 'utf8'));
console.log(`\npxPerM=${pxPerM}  wall=${out.level.wallThickness}m  rooms=${out.rooms.length} (truth ${truth.rooms.length})  openings=${detected.length}`);
console.log('\nroom                truth area   ours    dArea   dx0    dz0    dx1    dz1');
const unmatched = [...truth.rooms];
for (const r of out.rooms) {
  let best = null;
  for (const t of unmatched) {
    const d = Math.hypot((t.rect[0] + t.rect[2]) / 2 - r.rect[0] - (r.rect[2] - r.rect[0]) / 2,
      (t.rect[1] + t.rect[3]) / 2 - r.rect[1] - (r.rect[3] - r.rect[1]) / 2);
    if (!best || d < best.d) best = { t, d };
  }
  if (!best || best.d > 2) {
    console.log(`${r.name.padEnd(10)}  (无匹配)  area=${r.area}`);
    continue;
  }
  unmatched.splice(unmatched.indexOf(best.t), 1);
  const ta = (best.t.rect[2] - best.t.rect[0]) * (best.t.rect[3] - best.t.rect[1]);
  const d = (a, b) => (Math.round((a - b) * 100) / 100).toFixed(2).padStart(6);
  console.log(
    `${best.t.name.padEnd(6)}/${r.name.padEnd(6)} ${ta.toFixed(1).padStart(7)} ${r.area.toFixed(1).padStart(7)} ${(r.area - ta).toFixed(2).padStart(7)}` +
      ` ${d(r.rect[0], best.t.rect[0])} ${d(r.rect[1], best.t.rect[1])} ${d(r.rect[2], best.t.rect[2])} ${d(r.rect[3], best.t.rect[3])}`,
  );
}
if (unmatched.length) console.log('漏检房间:', unmatched.map((t) => t.name).join(', '));
const tDoors = truth.rooms.filter((r) => r.door).length;
const tWins = truth.rooms.reduce((a, r) => a + (r.windows ?? []).length, 0);
const oDoors = out.rooms.reduce((a, r) => a + (r.doors ?? (r.door ? [r.door] : [])).length, 0);
const oWins = out.rooms.reduce((a, r) => a + (r.windows ?? []).length, 0);
console.log(`门: 识别 ${oDoors} / 真值 ${tDoors}    窗: 识别 ${oWins} / 真值 ${tWins}`);
console.log('wrote plans/extracted.json');

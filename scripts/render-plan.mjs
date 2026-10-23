import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const planPath = process.argv[2] ? resolve(process.argv[2]) : join(root, 'plans/demo-3br.json');
const name = basename(planPath, '.json');
const S = Number(process.env.SCALE ?? 100);
const M = 150;

const plan = JSON.parse(await readFile(planPath, 'utf8'));
const wallPx = plan.level.wallThickness * S;
const rooms = plan.rooms.map((r) => ({
  ...r,
  x0: r.rect[0] * S,
  z0: r.rect[1] * S,
  x1: r.rect[2] * S,
  z1: r.rect[3] * S,
}));

const b = rooms.reduce(
  (a, r) => ({
    x0: Math.min(a.x0, r.x0),
    z0: Math.min(a.z0, r.z0),
    x1: Math.max(a.x1, r.x1),
    z1: Math.max(a.z1, r.z1),
  }),
  { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity },
);

const W = b.x1 - b.x0 + M * 2;
const H = b.z1 - b.z0 + M * 2;
const ox = M - b.x0;
const oy = M - b.z0;
const X = (v) => v + ox;
const Y = (v) => v + oy;

// Ring order matches build-from-plan.mjs rectToPolygon so wallIndex lines up:
// 0 = north (left to right), 1 = east (top to bottom), 2 = south (right to left), 3 = west (bottom to top).
function edgeOf(room, wallIndex) {
  const c = [[room.x0, room.z0], [room.x1, room.z0], [room.x1, room.z1], [room.x0, room.z1]];
  const [ax, az] = c[wallIndex];
  const [bx, bz] = c[(wallIndex + 1) % 4];
  const len = Math.hypot(bx - ax, bz - az);
  return { ax, az, ux: (bx - ax) / len, uz: (bz - az) / len, len };
}

function opening(room, wallIndex, t, widthM) {
  const e = edgeOf(room, wallIndex);
  const half = (widthM * S) / 2;
  return {
    cx: e.ax + e.ux * e.len * t,
    cz: e.az + e.uz * e.len * t,
    ux: e.ux,
    uz: e.uz,
    half,
    horizontal: Math.abs(e.uz) < 0.5,
  };
}

const P = [];

for (const r of rooms) {
  P.push(
    `<rect x="${X(r.x0)}" y="${Y(r.z0)}" width="${r.x1 - r.x0}" height="${r.z1 - r.z0}" fill="none" stroke="#141414" stroke-width="${wallPx}"/>`,
  );
}

const punch = (o) =>
  o.horizontal
    ? `<rect x="${X(o.cx - o.half)}" y="${Y(o.cz) - wallPx / 2 - 1}" width="${o.half * 2}" height="${wallPx + 2}" fill="#ffffff"/>`
    : `<rect x="${X(o.cx) - wallPx / 2 - 1}" y="${Y(o.cz - o.half)}" width="${wallPx + 2}" height="${o.half * 2}" fill="#ffffff"/>`;

// Leaf of door length hinged at one jamb, plus the quarter-circle swing to the other jamb.
function door(o) {
  const L = o.half * 2;
  const hx = X(o.cx - o.ux * o.half);
  const hz = Y(o.cz - o.uz * o.half);
  const nx = -o.uz;
  const nz = o.ux;
  const lx = hx + nx * L;
  const lz = hz + nz * L;
  const jx = hx + o.ux * L;
  const jz = hz + o.uz * L;
  const sweep = nx * (jz - hz) - nz * (jx - hx) > 0 ? 0 : 1;
  return (
    `<line x1="${hx}" y1="${hz}" x2="${lx}" y2="${lz}" stroke="#141414" stroke-width="2.5"/>` +
    `<path d="M ${lx} ${lz} A ${L} ${L} 0 0 ${sweep} ${jx} ${jz}" fill="none" stroke="#9a9a9a" stroke-width="1.5" stroke-dasharray="6 5"/>`
  );
}

function windowGlyph(o) {
  const t = wallPx;
  const q = t / 4;
  if (o.horizontal) {
    const y = Y(o.cz);
    const x0 = X(o.cx - o.half);
    const x1 = X(o.cx + o.half);
    return (
      punch(o) +
      `<line x1="${x0}" y1="${y - q}" x2="${x1}" y2="${y - q}" stroke="#141414" stroke-width="2"/>` +
      `<line x1="${x0}" y1="${y + q}" x2="${x1}" y2="${y + q}" stroke="#141414" stroke-width="2"/>`
    );
  }
  const x = X(o.cx);
  const z0 = Y(o.cz - o.half);
  const z1 = Y(o.cz + o.half);
  return (
    punch(o) +
    `<line x1="${x - q}" y1="${z0}" x2="${x - q}" y2="${z1}" stroke="#141414" stroke-width="2"/>` +
    `<line x1="${x + q}" y1="${z0}" x2="${x + q}" y2="${z1}" stroke="#141414" stroke-width="2"/>`
  );
}

for (const r of rooms) {
  if (r.door) {
    const o = opening(r, r.door.wallIndex, r.door.t, r.door.width);
    P.push(punch(o), door(o));
  }
  for (const w of r.windows ?? []) P.push(windowGlyph(opening(r, w.wallIndex, w.t, w.width)));
}

for (const r of rooms) {
  const cx = X((r.x0 + r.x1) / 2);
  const cz = Y((r.z0 + r.z1) / 2);
  const area = ((r.x1 - r.x0) / S) * ((r.z1 - r.z0) / S);
  P.push(`<text x="${cx}" y="${cz - 6}" text-anchor="middle" font-family="Noto Sans CJK SC" font-size="24" fill="#141414">${r.name}</text>`);
  P.push(`<text x="${cx}" y="${cz + 22}" text-anchor="middle" font-family="Noto Sans CJK SC" font-size="18" fill="#3c3c3c">${area.toFixed(1)} m²</text>`);
}

const dim = (x1, y1, x2, y2, label) =>
  `<g stroke="#5a5a5a" stroke-width="1.5" fill="none"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>` +
  `<line x1="${x1}" y1="${y1 - 6}" x2="${x1}" y2="${y1 + 6}"/><line x1="${x2}" y1="${y2 - 6}" x2="${x2}" y2="${y2 + 6}"/></g>` +
  `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 8}" text-anchor="middle" font-family="Noto Sans CJK SC" font-size="18" fill="#5a5a5a">${label}</text>`;

P.push(dim(X(b.x0), M - 55, X(b.x1), M - 55, `${Math.round(((b.x1 - b.x0) / S) * 1000)} mm`));
P.push(dim(M - 55, Y(b.z0), M - 55, Y(b.z1), `${Math.round(((b.z1 - b.z0) / S) * 1000)} mm`));

const barY = H - 70;
const ticks = [0.25, 0.5, 0.75]
  .map((f) => `<line x1="${40 + f * S}" y1="${barY - 6}" x2="${40 + f * S}" y2="${barY + 14}" stroke="#141414" stroke-width="2"/>`)
  .join('');
P.push(
  `<rect x="40" y="${barY}" width="${S}" height="8" fill="#141414"/>${ticks}` +
    `<text x="${40 + S + 14}" y="${barY + 10}" font-family="Noto Sans CJK SC" font-size="18" fill="#141414">1 m</text>`,
);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${P.join('')}</svg>`;

await mkdir(join(root, 'public/plans'), { recursive: true });
await writeFile(join(root, 'public/plans', `${name}.svg`), svg);
execFileSync('rsvg-convert', ['-w', String(W), '-h', String(H), '-o', join(root, 'public/plans', `${name}.png`), join(root, 'public/plans', `${name}.svg`)], { stdio: 'inherit' });
console.log(`rendered public/plans/${name}.png  ${W}x${H}  scale=${S}px/m`);

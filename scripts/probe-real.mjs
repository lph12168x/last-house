import { readFile } from 'node:fs/promises';
import pngjs from 'pngjs';
const { PNG } = pngjs;
const png = PNG.sync.read(await readFile(process.argv[2] ?? 'input/real-plan.png'));
const W = png.width, H = png.height, idx = (x, y) => y * W + x;
const T = Number(process.argv[3] ?? 128);
const dark = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) dark[i] = png.data[i * 4] < T ? 1 : 0;
const total = dark.reduce((a, b) => a + b, 0);
const hist = new Map();
const hRuns = []; const vRuns = [];
for (let y = 0; y < H; y++) { let x = 0; while (x < W) { if (!dark[idx(x, y)]) { x++; continue; } const s = x; while (x < W && dark[idx(x, y)]) x++; const L = x - s; hRuns.push(L); hist.set(L, (hist.get(L) ?? 0) + 1); } }
for (let x = 0; x < W; x++) { let y = 0; while (y < H) { if (!dark[idx(x, y)]) { y++; continue; } const s = y; while (y < H && dark[idx(x, y)]) y++; const L = y - s; vRuns.push(L); hist.set(L, (hist.get(L) ?? 0) + 1); } }
const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log(`size ${W}x${H} threshold ${T} dark=${total} (${(total / (W * H) * 100).toFixed(1)}%)`);
console.log('run 长度分布 top10 (长度:次数):', top.map(([l, c]) => `${l}:${c}`).join('  '));
const MIN_RUN = 6;
const h = new Uint8Array(W * H), v = new Uint8Array(W * H);
for (let y = 0; y < H; y++) { let x = 0; while (x < W) { if (!dark[idx(x, y)]) { x++; continue; } const s = x; while (x < W && dark[idx(x, y)]) x++; if (x - s >= MIN_RUN) for (let k = s; k < x; k++) h[idx(k, y)] = 1; } }
for (let x = 0; x < W; x++) { let y = 0; while (y < H) { if (!dark[idx(x, y)]) { y++; continue; } const s = y; while (y < H && dark[idx(x, y)]) y++; if (y - s >= MIN_RUN) for (let k = s; k < y; k++) v[idx(x, k)] = 1; } }
let both = 0; let bx0 = W, bx1 = 0, by0 = H, by1 = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = idx(x, y); if (h[i] && v[i]) { both++; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; } }
console.log(`横竖都>=${MIN_RUN}px 的像素: ${both} (占暗像素 ${(both / total * 100).toFixed(1)}%) bbox=${bx0},${by0}-${bx1},${by1}`);

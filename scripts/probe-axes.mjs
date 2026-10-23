import { readFile } from 'node:fs/promises';
import pngjs from 'pngjs';
const { PNG } = pngjs;
const png = PNG.sync.read(await readFile('input/real-plan.png'));
const W = png.width, H = png.height;
const g = (x, y) => png.data[(y * W + x) * 4];
const LO = 175;
const y0 = Number(process.argv[2] ?? 350), y1 = Number(process.argv[3] ?? 1300);
const colScore = [];
for (let x = 0; x < W; x++) { let c = 0; for (let y = y0; y <= y1; y++) if (g(x, y) < LO) c++; colScore.push([x, c]); }
const rowScore = [];
for (let y = 0; y < H; y++) { let c = 0; for (let x = 400; x < W; x++) if (g(x, y) < LO) c++; rowScore.push([y, c]); }
function peaks(list, minSep, topN) {
  const sorted = [...list].sort((a, b) => b[1] - a[1]);
  const kept = [];
  for (const [p, v] of sorted) {
    if (kept.some(([q]) => Math.abs(q - p) < minSep)) continue;
    kept.push([p, v]);
    if (kept.length >= topN) break;
  }
  return kept.sort((a, b) => a[0] - b[0]);
}
console.log(`列峰值(竖向轴线候选) y=${y0}..${y1}:`, peaks(colScore, 25, 14).map(([x, c]) => `${x}:${c}`).join('  '));
console.log('行峰值(横向轴线候选):', peaks(rowScore, 25, 14).map(([y, c]) => `${y}:${c}`).join('  '));

import { readFile } from 'node:fs/promises';
import pngjs from 'pngjs';
const { PNG } = pngjs;
const png = PNG.sync.read(await readFile('input/real-plan.png'));
const W = png.width, H = png.height;
const g = (x, y) => png.data[(y * W + x) * 4];
const LO = 180;
function runs(list) { const out = []; let i = 0; while (i < list.length) { if (!list[i]) { i++; continue; } const s = i; while (i < list.length && list[i]) i++; out.push([s, i - 1]); } return out; }
for (const [label, y0, y1, axis] of [["底部轴圈(横向轴号)", 1580, 1748, 'x'], ["顶部尺寸线", 0, 60, 'x']]) {
  const cols = [];
  for (let x = 0; x < W; x++) { let c = 0; for (let y = y0; y <= y1; y++) if (g(x, y) < LO) c++; cols.push(c >= 6); }
  console.log(label, runs(cols).filter(([a, b]) => b - a > 8).map(([a, b]) => `x=${(a + b) / 2}(w${b - a + 1})`).join('  '));
}
const rows = [];
for (let y = 0; y < H; y++) { let c = 0; for (let x = 55; x <= 130; x++) if (g(x, y) < LO) c++; rows.push(c >= 6); }
console.log("左侧轴圈(纵向轴号)", runs(rows).filter(([a, b]) => b - a > 8).map(([a, b]) => `y=${(a + b) / 2}(h${b - a + 1})`).join('  '));

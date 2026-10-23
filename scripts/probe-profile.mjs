import { readFile } from 'node:fs/promises';
import pngjs from 'pngjs';
const { PNG } = pngjs;
const png = PNG.sync.read(await readFile('input/real-plan.png'));
const W = png.width, H = png.height;
const g = (x, y) => png.data[(y * W + x) * 4];
const LO = 170;
function runsAlong(fixed, count, axis) {
  const out = [];
  let i = 0;
  while (i < count) {
    const v = axis === 'x' ? g(fixed + i, 380 + i) : g(430 + i, fixed);
    if (v >= LO) { i++; continue; }
    const s = i;
    let minV = 255;
    while (i < count) {
      const vv = axis === 'x' ? g(fixed + i, 380 + i) : g(430 + i, fixed);
      if (vv >= LO) break;
      if (vv < minV) minV = vv;
      i++;
    }
    out.push(`${s}-${i - 1}(len ${i - s},min ${minV})`);
  }
  return out;
}
for (const x of [468, 470, 640]) console.log(`col x=${x} y=380..1250:`, runsAlong(x, 870, 'y').slice(0, 14).join(' '));
for (const y of [700, 880, 1130]) console.log(`row y=${y} x=430..1170:`, runsAlong(y, 740, 'x').slice(0, 14).join(' '));

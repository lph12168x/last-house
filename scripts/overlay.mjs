import { readFile, writeFile } from 'node:fs/promises';
import pngjs from 'pngjs';
const { PNG } = pngjs;
const base = PNG.sync.read(await readFile('input/real-plan.png'));
const mask = PNG.sync.read(await readFile(process.argv[2] ?? 'input/walls-debug.png'));
const out = new PNG({ width: base.width, height: base.height });
for (let i = 0; i < base.width * base.height; i++) {
  const o = i * 4;
  out.data[o] = base.data[o];
  out.data[o + 1] = base.data[o + 1];
  out.data[o + 2] = base.data[o + 2];
  out.data[o + 3] = 255;
  if (mask.data[o] < 128) {
    out.data[o] = 230;
    out.data[o + 1] = 30;
    out.data[o + 2] = 40;
  }
}
await writeFile(process.argv[3] ?? 'input/overlay.png', PNG.sync.write(out));
console.log('wrote', process.argv[3] ?? 'input/overlay.png');

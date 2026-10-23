import { readFile } from 'node:fs/promises';

const s = JSON.parse(await readFile('public/scenes/your-house.json', 'utf8'));
const nodes = s.nodes;
for (const w of Object.values(nodes).filter((n) => n.type === 'window')) {
  const wall = nodes[w.parentId];
  if (!wall) continue;
  const len = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
  const t = w.position[0] / len;
  const cx = wall.start[0] + (wall.end[0] - wall.start[0]) * t;
  const cz = wall.start[1] + (wall.end[1] - wall.start[1]) * t;
  const horiz = Math.abs(wall.end[1] - wall.start[1]) < 1e-6;
  console.log(
    `win w=${w.width} h=${w.height} sill=${w.position[1] - w.height / 2} center=(${cx.toFixed(2)},${cz.toFixed(2)}) ${horiz ? 'H' : 'V'} wallThick=${wall.thickness}`,
  );
}
import { readFile, writeFile } from 'node:fs/promises';

const path = 'public/scenes/your-house.json';
const scene = JSON.parse(await readFile(path, 'utf8'));
const origin = process.env.ORIGIN || 'http://127.0.0.1:4173';
let n = 0;
for (const node of Object.values(scene.nodes)) {
  if (node.type !== 'item') continue;
  node.asset.src = `${origin}/items/${node.asset.id}/model.glb`;
  n++;
}
await writeFile(path, JSON.stringify(scene, null, 2));
console.log('localized', n, 'item assets to', origin);

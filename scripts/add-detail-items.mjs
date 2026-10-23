import { readFile, writeFile } from 'node:fs/promises';

const path = 'public/scenes/your-house.json';
const scene = JSON.parse(await readFile(path, 'utf8'));
const nodes = scene.nodes;
const origin = 'http://127.0.0.1:4173';

const assets = {
  curtain: { category: 'decor', name: 'Curtain', dimensions: [1.11, 2.64, 0.1], tags: ['window', 'textile'] },
  backsplash: { category: 'kitchen', name: 'Stone Backsplash', dimensions: [1.95, 0.46, 0.02], tags: ['wall', 'kitchen', 'stone'] },
  vanity: { category: 'bathroom', name: 'Vanity', dimensions: [1.24, 1.08, 0.55], tags: ['floor', 'bathroom', 'storage'] },
  mirror: { category: 'bathroom', name: 'Mirror Cabinet', dimensions: [1.0, 0.9, 0.16], tags: ['wall', 'bathroom'] },
};

const place = [
  ['curtain', '北次卧A窗帘', [1.45, 0, 0.15], [1.7, 1, 1]],
  ['curtain', '北次卧B窗帘', [4.45, 0, 0.15], [1.7, 1, 1]],
  ['curtain', '主卧窗帘', [1.9, 0, 10.86], [1.8, 1, 1]],
  ['curtain', '南次卧窗帘', [12.0, 0, 9.76], [1.7, 1, 1]],
  ['curtain', '阳台窗帘左', [4.05, 0, 10.86], [0.55, 1, 1]],
  ['curtain', '阳台窗帘右', [10.15, 0, 10.86], [0.55, 1, 1]],
  ['backsplash', '厨房石材背板', [7.0, 0, 0.085], [1, 1, 1]],
  ['vanity', '公卫外洗手台', [3.05, 0, 3.84], [1, 1, 1]],
  ['vanity', '主卫洗手台', [1.45, 0, 5.18], [0.75, 1, 1]],
  ['mirror', '公卫镜柜', [3.05, 0, 3.64], [1, 1, 1]],
  ['mirror', '主卫镜柜', [1.45, 0, 5.04], [0.8, 1, 1]],
];

let seq = 0;
for (const [assetId, name, position, scale] of place) {
  const a = assets[assetId];
  const id = `item_detail_${assetId}_${++seq}`;
  nodes[id] = {
    object: 'node',
    id,
    type: 'item',
    name,
    parentId: 'level_0',
    visible: true,
    metadata: {},
    position,
    rotation: [0, 0, 0],
    scale,
    children: [],
    asset: {
      id: assetId,
      category: a.category,
      name: a.name,
      source: 'library',
      src: `${origin}/items/${assetId}/model.glb`,
      dimensions: a.dimensions,
      tags: a.tags,
      offset: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
  };
  nodes.level_0.children = [...nodes.level_0.children, id];
}

await writeFile(path, JSON.stringify(scene, null, 2));
console.log('added', place.length, 'detail items; total nodes', Object.keys(nodes).length);
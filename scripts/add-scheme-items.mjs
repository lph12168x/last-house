import { readFile, writeFile } from 'node:fs/promises';

const path = 'public/scenes/your-house.json';
const scene = JSON.parse(await readFile(path, 'utf8'));
const nodes = scene.nodes;
const level = nodes['level_0'];
if (!level) throw new Error('level_0 missing');

const assets = {
  wardrobe: { category: 'furniture', name: 'Wardrobe', dimensions: [1.8, 2.4, 0.64], tags: ['floor', 'storage', 'bedroom'] },
  'tv-wall': { category: 'furniture', name: 'TV Wall', dimensions: [2.6, 2.4, 0.47], tags: ['floor', 'living', 'media'] },
  'upper-cabinet': { category: 'kitchen', name: 'Upper Cabinet', dimensions: [1.9, 0.79, 0.38], tags: ['wall', 'kitchen', 'storage'] },
  pendant: { category: 'lighting', name: 'Linear Pendant', dimensions: [1.5, 1.01, 0.08], tags: ['ceiling', 'dining', 'lighting'] },
  rug: { category: 'decor', name: 'Living Rug', dimensions: [3.8, 0.012, 2.4], tags: ['floor', 'living', 'textile'] },
  bookshelf: { category: 'furniture', name: 'Book Wall', dimensions: [2.7, 2.2, 0.35], tags: ['floor', 'storage', 'living'] },
  desk: { category: 'furniture', name: 'Desk', dimensions: [1.6, 0.76, 0.6], tags: ['floor', 'work', 'living'] },
};

const place = [
  ['wardrobe', '主卧衣柜', [0.36, 0, 7.8], [0, Math.PI / 2, 0], [1.4, 1, 1]],
  ['wardrobe', '北次卧A衣柜', [1.45, 0, 3.15], [0, Math.PI, 0], [1.3, 1, 1]],
  ['wardrobe', '北次卧B衣柜', [4.45, 0, 3.15], [0, Math.PI, 0], [1.35, 1, 1]],
  ['wardrobe', '南次卧衣柜', [12.2, 0, 6.85], [0, 0, 0], [1.2, 1, 1]],
  ['tv-wall', '电视墙', [3.87, 0, 8.35], [0, Math.PI / 2, 0], [1, 1, 1]],
  ['upper-cabinet', '厨房吊柜', [7.0, 0, 0.3], [0, 0, 0], [1, 1, 1]],
  ['pendant', '餐厅吊灯', [7.35, 0, 5.55], [0, Math.PI / 2, 0], [1, 1, 1]],
  ['rug', '客厅地毯', [5.95, 0, 8.35], [0, 0, 0], [1, 1, 1]],
  ['bookshelf', '书墙', [10.165, 0, 8.1], [0, -Math.PI / 2, 0], [1, 1, 1]],
  ['desk', '书桌', [9.7, 0, 8.1], [0, -Math.PI / 2, 0], [1, 1, 1]],
];

let seq = 0;
function assetFor(id) {
  const a = assets[id];
  return {
    id,
    category: a.category,
    name: a.name,
    source: 'library',
    src: `/items/${id}/model.glb`,
    dimensions: a.dimensions,
    tags: a.tags,
    offset: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

for (const [assetId, name, position, rotation, scale] of place) {
  const id = `item_scheme_${assetId}_${++seq}`;
  nodes[id] = {
    object: 'node',
    id,
    type: 'item',
    name,
    parentId: 'level_0',
    visible: true,
    metadata: {},
    position,
    rotation,
    scale,
    children: [],
    asset: assetFor(assetId),
  };
  level.children = [...(level.children ?? []), id];
}

for (const node of Object.values(nodes)) {
  if (node.type === 'item' && node.name === 'TV Stand') node.visible = false;
}

await writeFile(path, JSON.stringify(scene, null, 2));
console.log('added', place.length, 'scheme items; tv stand hidden; nodes now', Object.keys(nodes).length);

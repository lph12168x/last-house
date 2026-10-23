import { readFile, writeFile } from 'node:fs/promises';

const path = 'public/scenes/your-house.json';
const scene = JSON.parse(await readFile(path, 'utf8'));
const nodes = scene.nodes;
const find = (id) => Object.values(nodes).find((n) => n.type === 'item' && n.asset?.id === id);

const shelf = find('bookshelf');
shelf.position = [10.165, 0, 8.55];
shelf.scale = [0.85, 1, 1];
const desk = find('desk');
desk.position = [9.25, 0, 8.55];

if (!nodes.item_scheme_desk_chair) {
  const chair = Object.values(nodes).find((n) => n.type === 'item' && n.asset?.id === 'dining-chair');
  const id = 'item_scheme_desk_chair';
  nodes[id] = {
    object: 'node',
    id,
    type: 'item',
    name: '书桌椅',
    parentId: 'level_0',
    visible: true,
    metadata: {},
    position: [8.65, 0, 8.55],
    rotation: [0, Math.PI / 2, 0],
    scale: [1, 1, 1],
    children: [],
    asset: JSON.parse(JSON.stringify(chair.asset)),
  };
  nodes.level_0.children = [...nodes.level_0.children, id];
}

await writeFile(path, JSON.stringify(scene, null, 2));
console.log('shelf', shelf.position, shelf.scale, 'desk', desk.position, 'chair added:', !!nodes.item_scheme_desk_chair);

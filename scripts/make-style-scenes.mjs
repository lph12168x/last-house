import fs from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const base = JSON.parse(fs.readFileSync(`${root}/public/scenes/your-house.json`, 'utf8'));

const styles = {
  warm: {
    wall: 'library:preset-cream',
    floor: 'library:flooring-lightceramic24',
    side: '#cfccc6',
  },
  grey: {
    wall: 'library:preset-lightgrey',
    floor: 'library:flooring-statuarettowhite',
    side: '#c6c6c2',
  },
  dark: {
    wall: 'library:preset-softwhite',
    floor: 'library:flooring-statuarettowhite',
    side: '#b8ac9c',
  },
};

const styledIds = new Set([
  'sofa', 'rug', 'curtain', 'wardrobe', 'tv-wall', 'bookshelf', 'desk',
  'pendant', 'upper-cabinet', 'backsplash', 'vanity', 'mirror',
  'double-bed', 'bedside-table', 'dining-table', 'dining-chair', 'coffee-table', 'kitchen',
]);

const reposition = {
  item_scheme_bookshelf_9: [10.165, 0, 8.72],
  item_scheme_desk_10: [9.25, 0, 8.72],
  item_scheme_desk_chair: [8.65, 0, 8.72],
  'item_scheme_tv-wall_5': [3.94, 0, 8.35],
};

const removeIds = new Set([
  'item_tzln1prmxyghaqth',
  'item_67lkya71kory3b8l',
  'item_wq5t6ib53y1cavn1',
]);

for (const [style, conf] of Object.entries(styles)) {
  const scene = structuredClone(base);
  const nodes = scene.nodes;

  for (const [id, node] of Object.entries(nodes)) {
    if ((node.type === 'item' && node.visible === false) || removeIds.has(id)) {
      const parent = nodes[node.parentId];
      if (parent?.children) parent.children = parent.children.filter((child) => child !== id);
      delete nodes[id];
    }
  }

  for (const [id, pos] of Object.entries(reposition)) {
    if (nodes[id]) nodes[id].position = pos;
  }

  for (const node of Object.values(nodes)) {
    if (node.type === 'wall' && node.slots) {
      node.slots.a = conf.wall;
      node.slots.b = conf.wall;
    }
    if (node.type === 'slab' && node.slots) {
      node.slots.surface = conf.floor;
      node.slots.side = conf.side;
    }
  }

  for (const node of Object.values(nodes)) {
    if (node.type !== 'item' || !node.asset) continue;
    if (!styledIds.has(node.asset.id)) continue;
    node.asset.src = `items/${style}/${node.asset.id}/model.glb`;
    node.asset.source = 'library';
  }

  // Keep the JSON portable: strip the local preview host from any remaining assets.
  for (const node of Object.values(nodes)) {
    if (node.type !== 'item' || !node.asset?.src) continue;
    node.asset.src = node.asset.src.replace(/^https?:\/\/192\.168\.107\.130:4173\//, '');
  }

  scene.name = `My Home · ${style}`;
  scene.metadata = { ...(scene.metadata ?? {}), style };
  fs.writeFileSync(`${root}/public/scenes/your-house-${style}.json`, JSON.stringify(scene, null, 2));
  console.log('scene', style, Object.keys(nodes).length, 'nodes');
}

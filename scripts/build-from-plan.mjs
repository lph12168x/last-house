import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { reconcileSceneStructure } from '@pascal-app/core';
import { AGENT_OPERATIONS, applySceneChanges } from '@pascal-app/core/agent-operations';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const planPath = process.argv[2]
  ? resolve(process.argv[2])
  : join(root, 'plans/demo-3br.json');
const sceneName = basename(planPath, '.json');

const plan = JSON.parse(await readFile(planPath, 'utf8'));

const SITE = 'site_gen';
const BUILDING = 'building_gen';
const LEVEL = 'level_0';

let nodes = {
  [SITE]: {
    object: 'node',
    id: SITE,
    type: 'site',
    parentId: null,
    visible: true,
    metadata: {},
    polygon: { type: 'polygon', points: [[-30, -30], [30, -30], [30, 30], [-30, 30]] },
    children: [BUILDING],
  },
  [BUILDING]: {
    object: 'node',
    id: BUILDING,
    type: 'building',
    parentId: SITE,
    visible: true,
    metadata: {},
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    children: [LEVEL],
  },
  [LEVEL]: {
    object: 'node',
    id: LEVEL,
    type: 'level',
    parentId: BUILDING,
    visible: true,
    metadata: {},
    level: 0,
    height: plan.level.height,
    children: [],
  },
};

const catalogMod = await import(pathToFileURL(join(root, "node_modules/@pascal-app/mcp/dist/tools/asset-catalog.js")).href);
const catalog = await catalogMod.builtInCatalog();
console.log("catalog items:", catalog.length);
const context = { activeLevelId: LEVEL, catalog };

// Counter-clockwise ring in the right-handed XZ plane, matching how Pascal's walls traverse a boundary.
function rectToPolygon([minX, minZ, maxX, maxZ]) {
  return [
    [minX, minZ],
    [maxX, minZ],
    [maxX, maxZ],
    [minX, maxZ],
  ];
}

const built = [];
for (const room of plan.rooms) {
  const outcome = AGENT_OPERATIONS.create_room(nodes, {
    levelId: LEVEL,
    name: room.name,
    polygon: room.polygon ?? rectToPolygon(room.rect),
    wallHeight: room.wallHeight ?? plan.level.height,
    wallThickness: plan.level.wallThickness,
    doors: room.doors ?? (room.door ? [room.door] : []),
    windows: room.windows ?? [],
  }, context);

  nodes = applySceneChanges(nodes, outcome.changes);
  console.log(`room ${room.name}:`, JSON.stringify(outcome.result).slice(0, 160));
built.push({ name: room.name, kind: room.kind, zoneId: outcome.result.zoneId, doorWallIndex: room.doors?.[0]?.wallIndex });
}

let idSeq = 0;
const reconciled = reconcileSceneStructure({
  nodes,
  levelIds: [LEVEL],
  mintId: (kind) => `${kind}_gen_${++idSeq}`,
});

function edgePoints(room, wallIndex) {
  const poly = room.polygon ?? rectToPolygon(room.rect);
  const a = poly[wallIndex];
  const b = poly[(wallIndex + 1) % poly.length];
  return [a, b];
}

function distToSeg(p, a, b) {
  const vx = b[0] - a[0], vz = b[1] - a[1];
  const wx = p[0] - a[0], wz = p[1] - a[1];
  const len2 = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / len2));
  return Math.hypot(p[0] - (a[0] + vx * t), p[1] - (a[1] + vz * t));
}

function addWall(nodes, start, end, thickness, height) {
  const id = 'wall_cut_' + Math.random().toString(36).slice(2, 10);
  nodes[id] = {
    object: 'node', id, type: 'wall', name: 'Wall', parentId: LEVEL, visible: true, metadata: {},
    thickness, height, start, end, frontSide: 'interior', backSide: 'interior', children: [],
  };
  const level = nodes[LEVEL];
  if (level) level.children = [...(level.children ?? []), id];
  return id;
}

function deleteSubtree(nodes, id) {
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop();
    const n = nodes[cur];
    if (!n) continue;
    for (const c of n.children ?? []) stack.push(c);
    delete nodes[cur];
    for (const other of Object.values(nodes)) {
      if (other.children?.includes(cur)) other.children = other.children.filter((c) => c !== cur);
    }
  }
}

// A plain opening: cut every wall the gap crosses into pieces around it, so no door leaf exists.
function cutOpening(nodes, room, spec) {
  const [a, b] = edgePoints(room, spec.wallIndex);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const u0 = spec.t - spec.width / 2 / len;
  const u1 = spec.t + spec.width / 2 / len;
  const p0 = [a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0];
  const p1 = [a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1];
  let cuts = 0;
  for (const w of [...Object.values(nodes)]) {
    if (w.type !== 'wall') continue;
    const vx = p1[0] - p0[0], vz = p1[1] - p0[1];
    const vlen = Math.hypot(vx, vz) || 1;
    const lineDist = (q) => Math.abs((q[0] - p0[0]) * vz - (q[1] - p0[1]) * vx) / vlen;
    if (lineDist(w.start) > 0.04 || lineDist(w.end) > 0.04) continue;
    const s = w.start, e = w.end;
    const wlen = Math.hypot(e[0] - s[0], e[1] - s[1]);
    if (wlen < 0.05) continue;
    const dx = (e[0] - s[0]) / wlen, dz = (e[1] - s[1]) / wlen;
    const along = (p) => (p[0] - s[0]) * dx + (p[1] - s[1]) * dz;
    const ca = Math.max(0, Math.min(wlen, along(p0)));
    const cb = Math.max(0, Math.min(wlen, along(p1)));
    const lo = Math.min(ca, cb), hi = Math.max(ca, cb);
    if (hi - lo < 0.05) continue;
    const th = w.thickness, h = w.height;
    const kids = (w.children ?? []).map((id) => nodes[id]).filter(Boolean);
    deleteSubtree(nodes, w.id);
    const wallA = lo > 0.05 ? addWall(nodes, s, [s[0] + dx * lo, s[1] + dz * lo], th, h) : null;
    const wallB = wlen - hi > 0.05 ? addWall(nodes, [s[0] + dx * hi, s[1] + dz * hi], e, th, h) : null;
    for (const kid of kids) {
      const at = kid.position?.[0] ?? 0;
      if (at < lo && wallA) {
        nodes[kid.id] = { ...kid, parentId: wallA };
        nodes[wallA].children.push(kid.id);
      } else if (at > hi && wallB) {
        nodes[kid.id] = { ...kid, parentId: wallB, position: [at - hi, kid.position[1], kid.position[2]] };
        nodes[wallB].children.push(kid.id);
      }
    }
    cuts++;
  }
  return cuts;
}

for (const room of plan.rooms) {
  for (const spec of room.openings ?? []) cutOpening(reconciled.nodes, room, spec);
}
for (const part of plan.partitions ?? []) {
  const [s, e] = [part.start, part.end];
  const len = Math.hypot(e[0] - s[0], e[1] - s[1]);
  const gaps = [...(part.gaps ?? [])].sort((x, y) => x.t - y.t);
  let cursor = 0;
  for (const g of gaps) {
    const u0 = g.t - g.width / len / 2;
    const u1 = g.t + g.width / len / 2;
    if (u0 > cursor) addWall(reconciled.nodes, [s[0] + (e[0] - s[0]) * cursor, s[1] + (e[1] - s[1]) * cursor], [s[0] + (e[0] - s[0]) * u0, s[1] + (e[1] - s[1]) * u0], part.thickness ?? 0.1, part.height ?? 2.75);
    cursor = u1;
  }
  if (cursor < 1) addWall(reconciled.nodes, [s[0] + (e[0] - s[0]) * cursor, s[1] + (e[1] - s[1]) * cursor], e, part.thickness ?? 0.1, part.height ?? 2.75);
}
console.log('plain openings + partitions applied');

// Explicit, hand-placed furniture: replaces the auto layout for the rooms it covers.
if (plan.items?.length) {
  const placed = AGENT_OPERATIONS.place_items(reconciled.nodes, {
    levelId: LEVEL,
    items: plan.items.map((it) => ({
      assetId: it.assetId,
      x: it.x,
      z: it.z,
      ...(it.y !== undefined ? { y: it.y } : {}),
      ...(it.rotation !== undefined ? { rotation: it.rotation } : {}),
    })),
  }, context);
  reconciled.nodes = applySceneChanges(reconciled.nodes, placed.changes);
  console.log('hand-placed items:', JSON.stringify(placed.result));
}

if (process.env.FURNISH) {
  console.log('--- furnish ---');
  for (const b of built) {
    if (!b.kind || !b.zoneId) continue;
    if (plan.furnish && !plan.furnish.includes(b.name)) continue;
    try {
      const outcome2 = AGENT_OPERATIONS.furnish_room(reconciled.nodes, {
        levelId: LEVEL,
        zoneId: b.zoneId,
        roomType: b.kind,
        ...(b.doorWallIndex !== undefined ? { doorWallIndex: b.doorWallIndex } : {}),
      }, context);
      reconciled.nodes = applySceneChanges(reconciled.nodes, outcome2.changes);
      console.log(b.name, '->', JSON.stringify(outcome2.result).slice(0, 200));
    } catch (error) {
      console.log(b.name, 'skipped:', error.code ?? String(error).slice(0, 90));
    }
  }
}
const outdoorZones = new Set(built.filter((b) => b.kind === 'outdoor').map((b) => b.zoneId));
if (outdoorZones.size) {
  const doomed = Object.values(reconciled.nodes).filter((n) => n.type === 'ceiling' && outdoorZones.has(n.zoneId)).map((n) => n.id);
  for (const id of doomed) {
    delete reconciled.nodes[id];
    for (const n of Object.values(reconciled.nodes)) {
      if (n.children?.includes(id)) n.children = n.children.filter((c) => c !== id);
    }
  }
  console.log('open to sky, removed ceilings:', doomed.join(', '));
}
const byType = {};
for (const node of Object.values(reconciled.nodes)) {
  byType[node.type] = (byType[node.type] ?? 0) + 1;
}

await mkdir(join(root, 'public/scenes'), { recursive: true });
await writeFile(
  join(root, 'public/scenes', `${sceneName}.json`),
  JSON.stringify({ nodes: reconciled.nodes, rootNodeIds: [SITE] }, null, 2),
);

console.log('\nnodes by type:', JSON.stringify(byType));
console.log('structure events:', reconciled.events.length);
console.log('wrote public/scenes/' + sceneName + '.json');

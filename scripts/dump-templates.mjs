import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const templatesUrl = pathToFileURL(
  join(root, 'node_modules/@pascal-app/mcp/dist/templates/index.js'),
).href;
const mod = await import(templatesUrl);

const { TEMPLATES } = mod;
await mkdir(join(root, 'public/scenes'), { recursive: true });

for (const [id, entry] of Object.entries(TEMPLATES)) {
  const graph = entry.template;
  await writeFile(
    join(root, 'public/scenes', `${id}.json`),
    JSON.stringify(graph, null, 2),
  );
  console.log(id, 'nodes=' + Object.keys(graph.nodes).length, 'roots=' + graph.rootNodeIds.length, '-', entry.description);
}

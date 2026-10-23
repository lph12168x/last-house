import { loadPlugin, useScene } from '@pascal-app/core';
import type { SceneGraph } from '@pascal-app/core/clone-scene-graph';
import { builtinPlugin } from '@pascal-app/nodes';

let pluginsReady: Promise<void> | null = null;

export function bootstrap() {
  pluginsReady ??= loadPlugin(builtinPlugin);
  return pluginsReady;
}

export async function loadSceneFromUrl(url: string) {
  await bootstrap();
  const graph = (await fetch(url).then((r) => r.json())) as SceneGraph;
  const { nodes, rootNodeIds } = graph;

  // Scene JSON keeps asset paths portable ("items/..."). Resolve them against the
  // deployment base so the same files work at / and at /<repo>/ on GitHub Pages.
  // The viewer's asset loader needs fully-qualified URLs for local files.
  const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin).href;
  const resolveSrc = (src?: string) => {
    if (!src) return src;
    if (/^[a-z]+:/i.test(src)) return src;
    return new URL(src.replace(/^\/+/, ''), baseUrl).href;
  };
  for (const node of Object.values(nodes) as Array<Record<string, unknown>>) {
    const asset = node.asset as { src?: string } | undefined;
    if (asset?.src) asset.src = resolveSrc(asset.src);
  }

  useScene.getState().setScene(nodes, rootNodeIds, {
    collections: graph.collections,
    materials: graph.materials,
  });
  return Object.keys(nodes).length;
}

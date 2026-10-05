// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { build, type Metafile } from 'esbuild';

/**
 * The canvas runs in Obsidian for the GM and in a browser for online players (ADR 0001), so
 * everything it imports must work in both: it takes what Obsidian and the GM's UI provide
 * through its `CanvasHost`, never by importing them.
 */
const CANVAS_ENTRY = 'src/app/PixiRendererOrchestrator.ts';

/** What the canvas may not reach, by import path or source file. */
const FORBIDDEN: ReadonlyArray<{ reason: string; matches: (path: string) => boolean }> = [
  { reason: 'Obsidian exists only in the plugin', matches: (path) => path === 'obsidian' },
  { reason: "the GM's React UI belongs to the plugin", matches: (path) => /^src\/app\/(react|packages)\//.test(path) || path.endsWith('.tsx') },
  { reason: 'Node modules do not exist in a browser', matches: (path) => /^(node:|http$|https$|fs$|path$|crypto$|child_process$)/.test(path) },
];

async function canvasImports(): Promise<Metafile['inputs']> {
  const result = await build({
    entryPoints: [CANVAS_ENTRY],
    bundle: true,
    write: false,
    metafile: true,
    format: 'esm',
    platform: 'browser',
    outdir: 'canvas-import-graph',
    logLevel: 'silent',
    // Kept out of the bundle so the test sees them as imports
    external: ['obsidian', 'events', 'http', 'https', 'fs', 'path', 'crypto', 'child_process', 'node:*'],
    loader: { '.webp': 'empty', '.png': 'empty', '.svg': 'empty', '.mp3': 'empty', '.scss': 'empty', '.css': 'empty' },
    plugins: [{
      name: 'vite-queries',
      setup(pluginBuild) {
        pluginBuild.onResolve({ filter: /\?|^virtual:/ }, (args) => ({ path: args.path, namespace: 'vite-query' }));
        pluginBuild.onLoad({ filter: /.*/, namespace: 'vite-query' }, () => ({ contents: 'export default ""', loader: 'js' }));
      },
    }],
  });
  return result.metafile.inputs;
}

/** Each forbidden import with the chain of files that reaches it from the canvas. */
function forbiddenChains(inputs: Metafile['inputs']): string[] {
  const parent = new Map<string, string | null>([[CANVAS_ENTRY, null]]);
  const queue = [CANVAS_ENTRY];
  const found: string[] = [];
  while (queue.length > 0) {
    const file = queue.shift()!;
    for (const { path, external } of inputs[file]?.imports ?? []) {
      if (parent.has(path)) continue;
      parent.set(path, file);
      const rule = FORBIDDEN.find((candidate) => candidate.matches(path));
      if (rule) {
        const chain: string[] = [];
        for (let node: string | null | undefined = path; node; node = parent.get(node)) chain.unshift(node);
        found.push(`${rule.reason}: ${chain.join(' → ')}`);
      } else if (!external) {
        queue.push(path);
      }
    }
  }
  return found;
}

describe('the canvas import graph', () => {
  it('reaches neither Obsidian, nor the GM UI, nor Node', async () => {
    expect(forbiddenChains(await canvasImports())).toEqual([]);
  }, 30_000);
});

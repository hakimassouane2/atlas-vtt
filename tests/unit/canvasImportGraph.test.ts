// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { build, type Metafile } from 'esbuild';

/**
 * The canvas runs in Obsidian for the GM and in a browser for online players (ADR 0001), so
 * everything it imports must work in both: it takes what Obsidian and the GM's UI provide
 * through its `CanvasHost`, never by importing them.
 */
const CANVAS_ENTRIES = ['src/app/PixiRendererOrchestrator.ts', 'src/app/storeFactory.ts'];
/** The player's canvas page, which mounts Atlas' player overlays besides the canvas. */
const PAGE_ENTRY = 'src/app/online/canvas/main.ts';

/** What the canvas may not reach, by import path or source file. */
interface Rule {
  reason: string;
  matches: (path: string) => boolean;
}

const NO_OBSIDIAN: Rule = { reason: 'Obsidian exists only in the plugin', matches: (path) => path === 'obsidian' };
const NO_GM_UI: Rule = { reason: "the GM's React UI belongs to the plugin", matches: (path) => /^src\/app\/(react|packages)\//.test(path) || path.endsWith('.tsx') };
const NO_NODE: Rule = { reason: 'Node modules do not exist in a browser', matches: (path) => /^(node:|http$|https$|fs$|path$|crypto$|child_process$)/.test(path) };

async function canvasImports(entry: string): Promise<Metafile['inputs']> {
  const result = await build({
    entryPoints: [entry],
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
function forbiddenChains(entry: string, inputs: Metafile['inputs'], rules: readonly Rule[]): string[] {
  const parent = new Map<string, string | null>([[entry, null]]);
  const queue = [entry];
  const found: string[] = [];
  while (queue.length > 0) {
    const file = queue.shift()!;
    for (const { path, external } of inputs[file]?.imports ?? []) {
      if (parent.has(path)) continue;
      parent.set(path, file);
      const rule = rules.find((candidate) => candidate.matches(path));
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
  it.each(CANVAS_ENTRIES)('from %s reaches neither Obsidian, nor the GM UI, nor Node', async (entry) => {
    expect(forbiddenChains(entry, await canvasImports(entry), [NO_OBSIDIAN, NO_GM_UI, NO_NODE])).toEqual([]);
  }, 30_000);

  it('from the player canvas page reaches neither Obsidian nor Node', async () => {
    expect(forbiddenChains(PAGE_ENTRY, await canvasImports(PAGE_ENTRY), [NO_OBSIDIAN, NO_NODE])).toEqual([]);
  }, 30_000);
});

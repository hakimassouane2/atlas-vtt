import type { Plugin } from 'vite';
import { build, type Plugin as EsbuildPlugin } from 'esbuild';
import path from 'node:path';

const VIRTUAL_ID = 'virtual:atlas-player-client';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const CLIENT_DIR = 'src/app/selfhost/client';

/**
 * Builds the online player page (`src/app/selfhost/client/main.ts`) for the browser and exposes its
 * script and stylesheet to the plugin as `virtual:atlas-player-client`, which the player server
 * sends. Atlas' canvas imports neither Obsidian nor Node (`tests/unit/canvasImportGraph.test.ts`),
 * so only Node's `events` is swapped, for PIXI's own emitter; component styles come from the DM's
 * window instead of SCSS imports, and dice sounds are left out.
 */
export function playerClient(): Plugin {
  let root: string;
  let isProduction = false;
  return {
    name: 'atlas-player-client',
    configResolved(config) {
      root = config.root;
      isProduction = config.isProduction;
    },
    resolveId(source) {
      return source === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return null;
      const clientDir = path.join(root, CLIENT_DIR);
      const result = await build({
        entryPoints: [path.join(clientDir, 'main.ts')],
        bundle: true,
        write: false,
        outdir: 'player-client',
        metafile: true,
        format: 'iife',
        platform: 'browser',
        target: 'es2020',
        jsx: 'automatic',
        minify: isProduction,
        define: { 'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development') },
        loader: { '.webp': 'dataurl', '.png': 'dataurl', '.svg': 'text' },
        plugins: [browserStandIns(clientDir), inlineWorkers(isProduction)],
        logLevel: 'silent',
      });
      for (const input of Object.keys(result.metafile.inputs)) {
        if (!input.includes('node_modules')) this.addWatchFile(path.resolve(root, input));
      }
      const output = (extension: string): string => result.outputFiles.find((file) => file.path.endsWith(extension))?.text ?? '';
      return `export default ${JSON.stringify({ script: output('.js'), styles: output('.css') })};`;
    },
  };
}

/** What the page needs in a browser in place of what only exists in Obsidian's Node. */
function browserStandIns(clientDir: string): EsbuildPlugin {
  return {
    name: 'atlas-player-client-stand-ins',
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: /^events$/ }, () => ({ path: path.join(clientDir, 'events.ts') }));
      // Component styles are already in the stylesheet copied from the DM's window
      pluginBuild.onResolve({ filter: /\.scss$/ }, (args) => ({ path: args.path, namespace: 'atlas-no-style' }));
      pluginBuild.onLoad({ filter: /.*/, namespace: 'atlas-no-style' }, () => ({ contents: '', loader: 'js' }));
      pluginBuild.onResolve({ filter: /\.mp3\?inline$/ }, (args) => ({ path: args.path, namespace: 'atlas-no-sound' }));
      pluginBuild.onLoad({ filter: /.*/, namespace: 'atlas-no-sound' }, () => ({ contents: "export default '';", loader: 'js' }));
    },
  };
}

/**
 * Vite's `?worker&inline` imports (the map tile worker) for esbuild: the worker is bundled on its own
 * and the import gives a class that starts it from a blob, as Vite's inline workers do.
 */
function inlineWorkers(isProduction: boolean): EsbuildPlugin {
  return {
    name: 'atlas-player-client-inline-workers',
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: /\?worker&inline$/ }, (args) => ({
        path: path.resolve(args.resolveDir, args.path.replace(/\?worker&inline$/, '.ts')),
        namespace: 'atlas-inline-worker',
      }));
      pluginBuild.onLoad({ filter: /.*/, namespace: 'atlas-inline-worker' }, async (args) => {
        const worker = await build({
          entryPoints: [args.path],
          bundle: true,
          write: false,
          format: 'iife',
          platform: 'browser',
          target: 'es2020',
          minify: isProduction,
          metafile: true,
          logLevel: 'silent',
        });
        const code = worker.outputFiles[0]?.text ?? '';
        return {
          contents: `const code = ${JSON.stringify(code)};
export default class InlineWorker {
  constructor(options) {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    const worker = new Worker(url, options);
    URL.revokeObjectURL(url);
    return worker;
  }
}`,
          loader: 'js',
          watchFiles: Object.keys(worker.metafile?.inputs ?? {}),
        };
      });
    },
  };
}

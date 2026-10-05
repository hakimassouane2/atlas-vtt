import type { Plugin } from 'vite';
import { build, type Plugin as EsbuildPlugin, type PluginBuild } from 'esbuild';
import path from 'node:path';

const VIRTUAL_ID = 'virtual:atlas-player-client';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const CLIENT_DIR = 'src/app/online/client';
const CANVAS_CLIENT_DIR = 'src/app/online/canvas';

/**
 * Builds the online player pages for the browser and exposes their scripts and stylesheets to
 * the plugin as `virtual:atlas-player-client`, which the player server sends: the frame page
 * (`src/app/online/client/main.ts`) and the canvas page (`src/app/online/canvas/main.ts`). The frame page runs Atlas' own player overlays outside
 * Obsidian: `obsidian`, `events`, the vault-bound dice avatar hook and Atlas' settings
 * resolve to browser stand-ins, styles come from the DM's window instead of SCSS
 * imports, and dice sounds are left out: the DM's window plays them.
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
      const options = { isProduction };
      const [frames, canvas] = await Promise.all([
        bundle(path.join(root, CLIENT_DIR, 'main.ts'), [browserStandIns(path.join(root, CLIENT_DIR))], options),
        bundle(path.join(root, CANVAS_CLIENT_DIR, 'main.ts'), [canvasStandIns(path.join(root, CANVAS_CLIENT_DIR))], options),
      ]);
      for (const input of [...frames.inputs, ...canvas.inputs]) {
        if (!input.includes('node_modules')) this.addWatchFile(path.resolve(root, input));
      }
      return `export default ${JSON.stringify({
        script: frames.script,
        styles: frames.styles,
        canvasScript: canvas.script,
        canvasStyles: canvas.styles,
      })};`;
    },
  };
}

interface BundledPage {
  script: string;
  styles: string;
  /** Source files the bundle read, for the watcher. */
  inputs: string[];
}

/** Bundles one page's script for the browser, with its stylesheet. */
async function bundle(entry: string, plugins: EsbuildPlugin[], { isProduction }: { isProduction: boolean }): Promise<BundledPage> {
  const result = await build({
    entryPoints: [entry],
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
    plugins,
    logLevel: 'silent',
  });
  const output = (extension: string): string => result.outputFiles.find((file) => file.path.endsWith(extension))?.text ?? '';
  return { script: output('.js'), styles: output('.css'), inputs: Object.keys(result.metafile.inputs) };
}

/**
 * What the player canvas page (`src/app/online/canvas/`) needs in a browser: Atlas' canvas
 * imports neither Obsidian nor the GM's UI (`tests/unit/canvasImportGraph.test.ts`), so only
 * Node's `events` is swapped, for PIXI's own emitter, and styles and sounds are left out.
 */
function canvasStandIns(canvasDir: string): EsbuildPlugin {
  return {
    name: 'atlas-player-canvas-stand-ins',
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: /^events$/ }, () => ({ path: path.join(canvasDir, 'events.ts') }));
      leaveOutStylesAndSounds(pluginBuild);
    },
  };
}

/** Swaps what only exists inside Obsidian for the client's browser versions. */
function browserStandIns(clientDir: string): EsbuildPlugin {
  const standIns: Array<[RegExp, string]> = [
    [/^obsidian$/, 'obsidianStub.ts'],
    [/^events$/, 'eventsStub.ts'],
    [/\/useDiceAvatar$/, 'diceAvatar.ts'],
    [/\/services\/SettingsService$/, 'settingsStub.ts'],
  ];
  return {
    name: 'atlas-player-client-stand-ins',
    setup(pluginBuild) {
      for (const [filter, file] of standIns) {
        pluginBuild.onResolve({ filter }, () => ({ path: path.join(clientDir, file) }));
      }
      leaveOutStylesAndSounds(pluginBuild);
    },
  };
}

/** Component styles are already in the stylesheet copied from the DM's window; dice sounds play there. */
function leaveOutStylesAndSounds(pluginBuild: PluginBuild): void {
  pluginBuild.onResolve({ filter: /\.scss$/ }, (args) => ({ path: args.path, namespace: 'atlas-no-style' }));
  pluginBuild.onLoad({ filter: /.*/, namespace: 'atlas-no-style' }, () => ({ contents: '', loader: 'js' }));
  pluginBuild.onResolve({ filter: /\.mp3\?inline$/ }, (args) => ({ path: args.path, namespace: 'atlas-no-sound' }));
  pluginBuild.onLoad({ filter: /.*/, namespace: 'atlas-no-sound' }, () => ({ contents: "export default '';", loader: 'js' }));
}

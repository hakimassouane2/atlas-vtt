import type { Plugin } from 'vite';
import { build, type Plugin as EsbuildPlugin } from 'esbuild';
import path from 'node:path';

const VIRTUAL_ID = 'virtual:atlas-player-client';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const CLIENT_DIR = 'src/app/online/client';

/**
 * Builds the online player page (`src/app/online/client/main.ts`) for the browser
 * and exposes its script and stylesheet to the plugin as `virtual:atlas-player-client`,
 * which the player server sends. The page runs Atlas' own player overlays outside
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
        plugins: [browserStandIns(clientDir)],
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
      // Component styles are already in the stylesheet copied from the DM's window
      pluginBuild.onResolve({ filter: /\.scss$/ }, (args) => ({ path: args.path, namespace: 'atlas-no-style' }));
      pluginBuild.onLoad({ filter: /.*/, namespace: 'atlas-no-style' }, () => ({ contents: '', loader: 'js' }));
      pluginBuild.onResolve({ filter: /\.mp3\?inline$/ }, (args) => ({ path: args.path, namespace: 'atlas-no-sound' }));
      pluginBuild.onLoad({ filter: /.*/, namespace: 'atlas-no-sound' }, () => ({ contents: "export default '';", loader: 'js' }));
    },
  };
}

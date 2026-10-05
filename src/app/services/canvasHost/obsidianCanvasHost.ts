import type { App } from 'obsidian';
import type { CanvasCollections, CanvasHost } from '../../canvas/canvasHost';
import { AssetService } from '../AssetService';
import { SettingsService } from '../SettingsService';
import { gmTokenMenu } from '../../react/components/context-menu/gmTokenMenu';
import { vaultArtSource } from './vaultArtSource';
import { withStatblockData } from './statblockTokenData';
import { LightingFeature } from '../../pixi/lighting/LightingFeature';
import { AudioFeature } from '../../pixi/audio/AudioFeature';

/**
 * The canvas of a view in Obsidian: art from the vault, rules from the asset index, lighting and
 * ambient audio. A GM's view adds the GM's token menu.
 */
export function obsidianCanvasHost(app: App, { tokenMenu }: { tokenMenu: boolean }): CanvasHost {
  return {
    art: vaultArtSource(app),
    collections: assetIndexCollections(app),
    settings: () => SettingsService.forApp(app),
    prepareToken: (token, resources) => withStatblockData(app, token, resources),
    lighting: (deps) => new LightingFeature({ ...deps, obsApp: app }),
    audio: (deps) => new AudioFeature({ ...deps, obsApp: app }),
    ...(tokenMenu ? { tokenMenu: gmTokenMenu(app) } : {}),
  };
}

function assetIndexCollections(app: App): CanvasCollections {
  const assets = AssetService.getInstance(app);
  return {
    getCollectionForMap: (mapPath) => assets.getCollectionForMap(mapPath),
    getCollectionSettings: (collectionId) => assets.getCollectionSettings(collectionId),
    ready: () => assets.initialize(),
    onChanged: (listener) => {
      const ref = app.workspace.on('atlas-vtt:collection-settings-changed', listener);
      return () => app.workspace.offref(ref);
    },
  };
}

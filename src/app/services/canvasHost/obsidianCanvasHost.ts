import type { App } from 'obsidian';
import type { CanvasCollections, CanvasHost } from '../../canvas/canvasHost';
import { SettingsService } from '../SettingsService';
import { gmTokenMenu } from '../../react/components/context-menu/gmTokenMenu';
import { vaultArtSource } from './vaultArtSource';
import { statblockTokenAppearance } from '../../plugin/statblockTokenAppearance';
import { TokenStatblockLinkService } from '../TokenStatblockLinkService';
import { LightingFeature } from '../../pixi/lighting/LightingFeature';
import { AudioFeature } from '../../pixi/audio/AudioFeature';
import { onMapRulesChange, rulesLookup } from '../mapRules';
import { MapController } from '../../MapController';

/**
 * The canvas of a view in Obsidian: art from the vault, rules from the asset index, lighting and
 * ambient audio. A GM's view adds the GM's token menu.
 */
export function obsidianCanvasHost(app: App, { tokenMenu }: { tokenMenu: boolean }): CanvasHost {
  return {
    art: vaultArtSource(app),
    collections: assetIndexCollections(app),
    settings: () => SettingsService.forApp(app),
    prepareToken: (token, resources) => statblockTokenAppearance(app, token, TokenStatblockLinkService.getInstance(app), () => resources),
    lighting: (deps) => new LightingFeature({ ...deps, obsApp: app }),
    audio: (deps) => new AudioFeature({ ...deps, obsApp: app }),
    followBackground: (store, mapImage) => MapController.followBackground(app, store, mapImage),
    ...(tokenMenu ? { tokenMenu: gmTokenMenu(app) } : {}),
  };
}

/** The rules of the campaign this device plays, else of the asset index's collections. */
function assetIndexCollections(app: App): CanvasCollections {
  return {
    ...rulesLookup(app),
    onRulesChanged: (mapPath, listener) => onMapRulesChange(app, mapPath, listener),
  };
}

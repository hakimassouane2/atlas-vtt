import type { App } from 'obsidian';
import type { CanvasCollections, CanvasHost } from '../../canvas/canvasHost';
import { SettingsService } from '../SettingsService';
import { gmTokenMenu } from '../../react/components/context-menu/gmTokenMenu';
import { vaultArtSource } from './vaultArtSource';
import { statblockTokenAppearance } from '../../plugin/statblockTokenAppearance';
import { TokenStatblockLinkService } from '../TokenStatblockLinkService';
import { LightingController } from '../../pixi/lighting/LightingController';
import { createBelowLevelsHost, createRoofHost } from '../../pixi/lighting/belowLevelsHost';
import { settingsLightingQuality } from '../../pixi/lighting/settingsLightingQuality';
import { linkedSceneLevels } from '../linkedSceneLevels';
import { onLeavingView } from '../../pixi/viewLeaving';
import { PlayerWindowService } from '../PlayerWindowService';
import { playerWindowStore } from '../../stores/playerWindowStore';
import { AudioFeature } from '../../pixi/audio/AudioFeature';
import { onMapRulesChange, rulesLookup } from '../mapRules';
import { MapController } from '../../MapController';

/**
 * The canvas of a view in Obsidian: art from the vault, rules from the asset index, lighting,
 * roofs, animated maps and ambient audio. A GM's view adds the GM's token menu.
 */
export function obsidianCanvasHost(app: App, { tokenMenu }: { tokenMenu: boolean }): CanvasHost {
  return {
    art: vaultArtSource(app),
    collections: assetIndexCollections(app),
    settings: () => SettingsService.forApp(app),
    prepareToken: (token, resources) => statblockTokenAppearance(app, token, TokenStatblockLinkService.getInstance(app), () => resources),
    lighting: (deps) => {
      const quality = settingsLightingQuality(SettingsService.forApp(app));
      return new LightingController({ ...deps, obsApp: app, below: createBelowLevelsHost({ ...deps.below, obsApp: app }), ...(quality && { quality }) });
    },
    lightingQuality: () => settingsLightingQuality(SettingsService.forApp(app)),
    roofHost: (pixi, viewport) => createRoofHost(app, pixi, viewport),
    linkedSceneLevels: (from, link) => linkedSceneLevels(app, from, link),
    onLeavingView: (eventBus, viewId, stop) => onLeavingView({ eventBus, obsApp: app, viewId }, stop),
    mapVideo: {
      playersSee: (store) => PlayerWindowService.getInstance()?.mirrors(store) ?? false,
      onPlayersChange: (listener) => playerWindowStore.subscribe(listener),
      animate: () => {
        const settings = SettingsService.forApp(app);
        return settings ? { get: () => settings.getAnimateMaps(), onChange: (listener) => settings.onChange(listener) } : null;
      },
    },
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

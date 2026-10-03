import { sideOf } from '../initiative/sides';
import type { ResourceDefinition } from '../resources/resourceTypes';
import type { AtlasSettings } from '../services/SettingsService';
import type { ViewAtlasState } from '../storeFactory';
import type { PlayerScene, SceneToken } from './protocol';

/**
 * The presented scene for players' pages. Hidden tokens and their initiative turns
 * are left out, and so are the names the player view settings hide and the HP the
 * collection hides from players, so a player's browser never receives what they may not see.
 */
export function playerScene(state: ViewAtlasState, settings: AtlasSettings['localPlayerView'], resources: readonly ResourceDefinition[]): PlayerScene {
  const hpVisible = resources.some((definition) => definition.key === 'hp' && definition.visibleToPlayers);
  const tokens: Record<string, SceneToken> = {};
  for (const token of Object.values(state.objects.tokens)) {
    if (token.isHidden) continue;
    const { id, kind, imagePath, showRing, ringColor } = token;
    const hp = hpVisible ? token.resources?.hp : undefined;
    tokens[id] = {
      id, kind, imagePath, side: sideOf(token),
      ...(showRing !== undefined && { showRing }),
      ...(ringColor !== undefined && { ringColor }),
      ...(hp && { resources: { hp } }),
    };
  }
  const { initiative } = state;
  return {
    objects: { tokens },
    initiative: initiative && {
      ...initiative,
      entries: initiative.entries.filter((entry) => tokens[entry.tokenId]).map((entry) => ({
        ...entry,
        name: settings.showTokenNameplates ? entry.name : '',
        statblockPath: undefined,
      })),
    },
    initiativeTrackerOpen: state.initiativeTrackerOpen,
  };
}

/** Image files players may load: the artwork of the tokens and initiative turns they see. */
export function sceneImagePaths(scene: PlayerScene): Set<string> {
  const paths = new Set<string>();
  for (const token of Object.values(scene.objects.tokens)) if (token.imagePath) paths.add(token.imagePath);
  for (const entry of scene.initiative?.entries ?? []) if (entry.imagePath) paths.add(entry.imagePath);
  return paths;
}

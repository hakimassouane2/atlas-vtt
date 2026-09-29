import type { AtlasSettings } from '../services/SettingsService';
import { visibleInitiativeEntries } from '../services/PlayerInitiativePanel';
import type { ViewAtlasState } from '../storeFactory';
import type { PlayerScene, SceneToken } from './protocol';

/**
 * The presented scene for players' pages. Hidden tokens and their initiative turns
 * are left out, and so are the names and hit points the player view settings hide,
 * so a player's browser never receives what they may not see.
 */
export function playerScene(state: ViewAtlasState, settings: AtlasSettings['localPlayerView']): PlayerScene {
  const tokens: Record<string, SceneToken> = {};
  for (const token of Object.values(state.objects.tokens)) {
    if (token.isHidden) continue;
    const { id, kind, imagePath, showRing, ringColor } = token;
    tokens[id] = { id, kind, imagePath, ...(showRing !== undefined && { showRing }), ...(ringColor !== undefined && { ringColor }) };
  }
  const { initiative } = state;
  return {
    objects: { tokens },
    initiative: initiative && {
      ...initiative,
      entries: visibleInitiativeEntries(initiative, state.objects.tokens).map((entry) => ({
        ...entry,
        name: settings.showTokenNameplates ? entry.name : '',
        hp: settings.showTokenHP ? entry.hp : { current: 0, max: 0 },
        stress: undefined,
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

import type { AtlasSettings } from '../services/SettingsService';
import type { ViewAtlasState } from '../storeFactory';
import type { ConditionDefinition } from '../types/collectionSettingsTypes';
import type { InitiativeRules } from '../types/initiativeRulesTypes';
import type { TokenEntity } from '../types';
import type { FrameView } from './PlayerFrameRenderer';
import type { PlayerToken } from './playerTokens';

/**
 * What the DM's Atlas and a player's page tell each other. Shared by the server
 * (`src/app/online/`) and the page (`src/app/online/client/`) as types only.
 */

/** A frame's header: where it looks, and whether that is the DM's framing. */
export interface FrameHeader extends FrameView {
  isDmCamera: boolean;
}

/**
 * A token players can see, as much as Atlas' player overlays read of it: its side in the
 * initiative, and its HP only when the collection shows them to players.
 */
export type SceneToken = Pick<TokenEntity, 'id' | 'kind' | 'imagePath' | 'showRing' | 'ringColor' | 'side' | 'resources'>;

/**
 * The presented scene as a player's page holds it: enough of a view store for the
 * overlays of the local player window (initiative, dice rolls) to run unchanged.
 * Only tokens players can see are in it.
 */
export interface PlayerScene {
  objects: { tokens: Record<string, SceneToken> };
  initiative: ViewAtlasState['initiative'] | undefined;
  initiativeTrackerOpen: boolean;
}

/** Everything players share about the presented scene. */
export interface PlayerState {
  /** Tokens the players control. */
  tokens: PlayerToken[];
  /** Conditions players may put on their tokens: those of the scene's collection. */
  conditions: Array<Pick<ConditionDefinition, 'id' | 'name' | 'color'> & { valued: boolean }>;
  scene: PlayerScene;
  /** The initiative rules of the scene's collection: whether the order lists sides. */
  initiativeRules: InitiativeRules;
  /** What the DM shows players (initiative, names, hit points), as for the local player window. */
  settings: AtlasSettings['localPlayerView'];
}

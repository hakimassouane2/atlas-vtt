import type { AtlasSettings } from '../../services/SettingsService';
import type { CollectionSettings } from '../../types/collectionSettingsTypes';
import type { InitiativeRules } from '../../types/initiativeRulesTypes';
import type { ReplicatedScene, SceneChange } from './sceneReplica';

/**
 * What a player's canvas reads besides the scene: the rules of the scene's collection
 * (conditions, resources, measurement, initiative) and what the DM shows players.
 */
export interface PlayerCanvasContext {
  collectionId: string | null;
  collection: CollectionSettings | null;
  /** How the scene's tracker runs a fight, as the DM's Atlas reads it (its own, its preset's or the default). */
  initiativeRules: InitiativeRules;
  playerView: AtlasSettings['localPlayerView'];
}

/** The messages the DM's Atlas sends a player's canvas, by event name. */
export type PlayerSceneMessage =
  | { event: 'context'; data: PlayerCanvasContext }
  | { event: 'scene'; data: ReplicatedScene }
  | { event: 'changes'; data: SceneChange[] }
  /** The DM closed every scene: players wait for the next one. */
  | { event: 'noScene'; data: null };

import type { AtlasSettings } from '../services/SettingsService';
import { visibleInitiativeEntries } from '../services/PlayerInitiativePanel';
import type { ViewAtlasState } from '../storeFactory';

/** One turn in the order, as players' pages receive it. The portrait comes from `/image?token=`. */
export interface PlayerInitiativeEntry {
  tokenId: string;
  /** Null while the DM hides nameplates from players. */
  name: string | null;
  initiative: number;
  isActive: boolean;
  /** Null while the DM hides hit points from players. */
  hp: { current: number; max: number } | null;
}

export interface PlayerInitiative {
  round: number;
  isActive: boolean;
  entries: PlayerInitiativeEntry[];
}

/**
 * The initiative order as the local player window shows it: only while the DM's
 * tracker is open and players may see it, without hidden tokens, with names and
 * hit points only where the player view settings show them.
 */
export function playerInitiative(state: ViewAtlasState, settings: AtlasSettings['localPlayerView']): PlayerInitiative | null {
  const { initiative, initiativeTrackerOpen, objects } = state;
  if (!settings.showInitiative || !initiativeTrackerOpen || !initiative) return null;
  const entries = visibleInitiativeEntries(initiative, objects.tokens);
  if (entries.length === 0) return null;
  return {
    round: initiative.round,
    isActive: initiative.isActive,
    entries: entries.map((entry) => ({
      tokenId: entry.tokenId,
      name: settings.showTokenNameplates ? entry.name : null,
      initiative: entry.initiative,
      isActive: initiative.isActive && entry.isActive,
      hp: settings.showTokenHP && entry.hp.max > 0 ? entry.hp : null,
    })),
  };
}

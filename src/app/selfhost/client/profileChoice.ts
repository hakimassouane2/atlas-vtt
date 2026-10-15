import type { PlayerProfile } from '../../types/collectionSettingsTypes';

const STORAGE_PREFIX = 'atlas-vtt:player-profile:';

/** What the page shows about the player's profile. */
export interface ProfileChoiceState {
  /** The profiles of the presented scene's collection; null until the DM's Atlas said which collection. */
  players: readonly PlayerProfile[] | null;
  /** The profile the player is; null until they chose one of `players`. */
  chosen: PlayerProfile | null;
}

/**
 * Who the player at this page is: one of the profiles of the presented scene's collection. The
 * browser remembers the choice per collection, so a player who comes back, or whose GM presents
 * a scene of the same collection again, is not asked twice; a profile the collection no longer
 * has is asked for anew.
 */
export class ProfileChoice {
  private collectionId: string | null = null;
  private state: ProfileChoiceState = { players: null, chosen: null };
  private readonly listeners = new Set<() => void>();

  /** The presented scene's collection and its profiles, as the DM's Atlas sends them. */
  setCollection(collectionId: string | null, players: readonly PlayerProfile[]): void {
    const sameCollection = collectionId === this.collectionId;
    this.collectionId = collectionId;
    const keptId = sameCollection ? this.state.chosen?.id : storedProfile(collectionId);
    const chosen = players.find(({ id }) => id === keptId) ?? null;
    this.update({ players, chosen });
  }

  /** The player picked `profileId`, one of the collection's profiles, on joining or from the settings menu. */
  choose(profileId: string): void {
    const chosen = this.state.players?.find(({ id }) => id === profileId);
    if (!chosen) return;
    storeProfile(this.collectionId, chosen.id);
    this.update({ ...this.state, chosen });
  }

  /** The id of the profile the player is, for the DM's Atlas and the canvas. */
  profileId(): string | null {
    return this.state.chosen?.id ?? null;
  }

  getState = (): ProfileChoiceState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private update(next: ProfileChoiceState): void {
    this.state = next;
    this.listeners.forEach((listener) => listener());
  }
}

// The page runs in a browser without Obsidian's App, so it keeps this in the browser's storage
function storedProfile(collectionId: string | null): string | null {
  if (!collectionId) return null;
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + collectionId);
  } catch {
    // Storage blocked (private window): the player chooses on every visit
    return null;
  }
}

function storeProfile(collectionId: string | null, profileId: string): void {
  if (!collectionId) return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + collectionId, profileId);
  } catch {
    // Storage blocked: the choice lasts until the page reloads
  }
}

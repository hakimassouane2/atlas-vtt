import type { PlayerProfile } from '../types/collectionSettingsTypes';

/** Longer than any profile id Atlas makes; anything longer is not from the player page. */
const MAX_PROFILE_ID = 100;

/** The profile a page says its player chose: an id, or null for none yet. Undefined when the body is no such choice. */
export function parseProfileChoice(body: unknown): string | null | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const { profile } = body as Record<string, unknown>;
  if (profile === null) return null;
  return typeof profile === 'string' && profile !== '' && profile.length <= MAX_PROFILE_ID ? profile : undefined;
}

/**
 * The pages connected to the online session and the profile each one's player chose. A page
 * says its choice whenever it connects and whenever the player changes it, so a reconnect needs
 * nothing kept from before.
 */
export class ConnectedPlayers {
  private readonly profiles = new Map<string, string | null>();

  get count(): number {
    return this.profiles.size;
  }

  join(playerId: string): void {
    this.profiles.set(playerId, null);
  }

  leave(playerId: string): void {
    this.profiles.delete(playerId);
  }

  /** Records the choice of a connected page; returns whether it was one. */
  choose(playerId: string, profileId: string | null): boolean {
    if (!this.profiles.has(playerId)) return false;
    this.profiles.set(playerId, profileId);
    return true;
  }

  profileOf(playerId: string | null): string | null {
    return playerId ? this.profiles.get(playerId) ?? null : null;
  }

  clear(): void {
    this.profiles.clear();
  }

  /** The profiles of `players` someone is connected as, in their order; a profile opened twice counts once. */
  connectedProfiles(players: readonly PlayerProfile[]): PlayerProfile[] {
    const chosen = new Set(this.profiles.values());
    return players.filter(({ id }) => chosen.has(id));
  }
}

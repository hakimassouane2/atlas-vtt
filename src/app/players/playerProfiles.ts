import type { CollectionLookup } from '../resources/collectionResources';
import { RESOURCE_COLORS } from '../resources/resourceColors';
import type { TokenEntity } from '../types';
import type { CollectionSettings, PlayerProfile } from '../types/collectionSettingsTypes';

/**
 * The order new profiles take their colour in: hues far apart first, so the first players of a
 * table never look alike, then the rest of the palette.
 */
const NEW_PLAYER_COLORS = [
  '#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#dc2626', '#06b6d4', '#ec4899', '#84cc16',
  ...RESOURCE_COLORS.map(({ value }) => value),
];

/** The collection's players, as stored ones are read: entries that are no profile are passed over. */
export function collectionPlayers(settings: Pick<CollectionSettings, 'players'> | null | undefined): PlayerProfile[] {
  const players = settings?.players;
  if (!Array.isArray(players)) return [];
  return players.filter((player): player is PlayerProfile =>
    typeof player === 'object' && player !== null
    && typeof player.id === 'string' && player.id !== ''
    && typeof player.name === 'string'
    && typeof player.color === 'string');
}

/** The players of the collection of the map at `mapPath`; none for a map outside every collection. */
export function mapPlayers(assets: CollectionLookup, mapPath: string | null | undefined): PlayerProfile[] {
  const collectionId = mapPath ? assets.getCollectionForMap(mapPath) : null;
  return collectionId ? collectionPlayers(assets.getCollectionSettings(collectionId)) : [];
}

/** A new profile without a name, in the first colour no other player of `players` has. */
export function newPlayerProfile(players: readonly PlayerProfile[]): PlayerProfile {
  const taken = new Set(players.map(({ color }) => color.toLowerCase()));
  const color = NEW_PLAYER_COLORS.find((value) => !taken.has(value)) ?? NEW_PLAYER_COLORS[players.length % NEW_PLAYER_COLORS.length]!;
  return { id: crypto.randomUUID(), name: '', color };
}

/** Players as they are stored: names trimmed. */
export function savedPlayers(players: readonly PlayerProfile[]): PlayerProfile[] {
  return players.map((player) => ({ ...player, name: player.name.trim() }));
}

/**
 * The profiles that act on `token`. Ids of deleted profiles may remain on tokens of closed
 * maps; they match no profile and are ignored wherever they are read.
 */
export function controllersOf(token: Pick<TokenEntity, 'controlledBy'>): string[] {
  return Array.isArray(token.controlledBy) ? token.controlledBy.filter((id) => typeof id === 'string') : [];
}

/** `token`'s profiles with `profileId` added or taken away; undefined once none is left. */
export function withController(token: Pick<TokenEntity, 'controlledBy'>, profileId: string, controls: boolean): string[] | undefined {
  const others = controllersOf(token).filter((id) => id !== profileId);
  const next = controls ? [...others, profileId] : others;
  return next.length > 0 ? next : undefined;
}

/** The profiles in `ids` that `players` still holds, in the order of `players`. */
export function knownPlayers(players: readonly PlayerProfile[], ids: readonly string[]): PlayerProfile[] {
  return players.filter(({ id }) => ids.includes(id));
}

import { BUILT_IN_SYSTEM_PRESETS } from '../../gameSystems/builtInPresets';
import { legacyCollectionResources } from '../../resources/collectionResources';
import { sameResourceDefinitions } from '../../resources/resourceDefinitions';
import type { CollectionSettings } from '../../types/collectionSettingsTypes';
import type { Asset } from '../AssetService';

/**
 * A collection's settings as bundles compare them. Resources that only restate what the
 * settings read as before resources were stored are left out: Atlas stores them by itself
 * (`storeLegacyResources`), which is no edit of the GM's. Nor is what players see, nor who
 * the players are: they belong to the table, not to what is shared.
 */
export function comparableSettings(settings: CollectionSettings | undefined): Omit<CollectionSettings, 'resources' | 'players'> | undefined {
  if (!settings) return settings;
  const { players: _players, ...shared } = settings;
  if (!shared.resources) return shared;
  const { resources, ...rest } = shared;
  return sameResourceDefinitions(resources, legacyCollectionResources(rest, BUILT_IN_SYSTEM_PRESETS)) ? rest : shared;
}

/** `asset` without what the table's maps made of it (a character's record), which a bundle never carries. */
export function withoutTableState(asset: Asset): Asset {
  if (asset.type !== 'token' || !asset.character) return asset;
  const { character: _character, ...shared } = asset;
  return shared;
}

/** `settings` without the table's players, which a bundle never carries. */
export function withoutPlayers(settings: CollectionSettings): CollectionSettings {
  const { players: _players, ...shared } = settings;
  return shared;
}

/** `settings` with each loot base at the path `pathOf` gives it; a base without one is left out. */
export function withLootBases(settings: CollectionSettings, pathOf: (path: string) => string | undefined): CollectionSettings {
  const { lootBases } = settings;
  return lootBases ? { ...settings, lootBases: lootBases.flatMap((path) => pathOf(path) ?? []) } : settings;
}

/**
 * The settings an import takes from a bundle. One written by an older Atlas names no resources:
 * the vault keeps its own. The vault always keeps its players.
 */
export function settingsFromBundle(theirs: CollectionSettings, mine: CollectionSettings | undefined): CollectionSettings {
  const settings = theirs.resources || !mine?.resources ? withoutPlayers(theirs) : { ...withoutPlayers(theirs), resources: mine.resources };
  return mine?.players ? { ...settings, players: mine.players } : settings;
}

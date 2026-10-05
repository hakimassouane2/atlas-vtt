import type { ConditionDefinition } from '../types/collectionSettingsTypes';
import type { CollectionLookup } from '../resources/collectionResources';

/** The conditions the collection of the map at `mapPath` defines; none for a map outside any collection. */
export function mapConditions(assetService: CollectionLookup, mapPath: string | null | undefined): ConditionDefinition[] {
  if (!mapPath) return [];
  const collectionId = assetService.getCollectionForMap(mapPath);
  return collectionId ? assetService.getCollectionSettings(collectionId).conditions : [];
}

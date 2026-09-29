import type { ConditionDefinition } from '../types/collectionSettingsTypes';
import type { AssetService } from './AssetService';

/** The conditions the collection of the map at `mapPath` defines; none for a map outside any collection. */
export function mapConditions(assetService: AssetService, mapPath: string | null | undefined): ConditionDefinition[] {
  if (!mapPath) return [];
  const collectionId = assetService.getCollectionForMap(mapPath);
  return collectionId ? assetService.getCollectionSettings(collectionId).conditions : [];
}

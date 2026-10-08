import React from 'react';
import type { App } from 'obsidian';
import { TokenRingContext } from '../packages/components/shared/tokenRingContext';
import { useAtlasStore } from '../react/ViewStoreContext';
import { AssetService } from '../services/AssetService';
import { usePortraitRings } from './usePortraitRings';
import { useCollectionRulesRevision } from '../react/hooks/useCollectionRulesRevision';

/** Frames the portraits of a map view (initiative, rolls, statblocks) with the rings of the map's collection. */
export function MapTokenRings({ app, children }: { app: App; children: React.ReactNode }): React.JSX.Element {
  const mapPath = useAtlasStore((state) => state.mapPath);
  // A map shown before the asset index loaded reads as outside every collection until then
  useCollectionRulesRevision(app);
  const collectionId = mapPath ? AssetService.getInstance(app).getCollectionForMap(mapPath) : null;
  const ringOf = usePortraitRings(app, collectionId);
  return <TokenRingContext.Provider value={ringOf}>{children}</TokenRingContext.Provider>;
}

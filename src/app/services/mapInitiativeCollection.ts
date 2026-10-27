import type { App } from 'obsidian';
import { mapResources } from '../resources/collectionResources';
import { AssetService } from './AssetService';
import { mapInitiativeRules } from './mapInitiativeRules';
import { rulesLookup } from './mapRules';
import { mapConditions } from '../gameSystems/mapRules';
import type { InitiativeCollection } from './PlayerInitiativePanel';
import { TokenRingLibrary } from '../tokenRings/TokenRingLibrary';

/** What the collection holding a map tells the players' initiative order, read from the vault. */
export function mapInitiativeCollection(app: App): InitiativeCollection {
  return {
    // Players see HP where the map's rules show it to them
    showsHp: (mapPath) => mapResources(rulesLookup(app), mapPath).some((definition) => definition.key === 'hp' && definition.visibleToPlayers),
    rules: (mapPath) => mapInitiativeRules(app, mapPath),
    resources: (mapPath) => mapResources(rulesLookup(app), mapPath),
    conditions: (mapPath) => mapConditions(rulesLookup(app), mapPath),
    // The local player window is shared by the table: nobody in particular looks at it
    viewerOf: () => 'player',
    ringOf: (mapPath, token) => {
      const collectionId = mapPath ? AssetService.getInstance(app).getCollectionForMap(mapPath) : null;
      return TokenRingLibrary.forApp(app)?.portraitRing(collectionId, token) ?? { color: token.ringColor };
    },
  };
}

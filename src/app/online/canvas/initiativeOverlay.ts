import { PlayerInitiativePanel } from '../../services/PlayerInitiativePanel';
import { DEFAULT_INITIATIVE_RULES } from '../../gameSystems/initiativeRules';
import { mapResources, type CollectionLookup } from '../../resources/collectionResources';
import type { ViewAtlasStore } from '../../storeFactory';
import type { InitiativeRules } from '../../types/initiativeRulesTypes';
import { PageSettings, pageApp } from '../client/pageStandIns';
import type { PlayerCanvasContext } from '../scene/sceneProtocol';

/** The local player window's initiative order on the canvas page, read from the page's own store. */
export class InitiativeOverlay {
  private readonly settings = new PageSettings();
  private rules: InitiativeRules = { ...DEFAULT_INITIATIVE_RULES };

  constructor(container: HTMLElement, store: ViewAtlasStore, collection: CollectionLookup) {
    const panel = new PlayerInitiativePanel(pageApp, this.settings.asSettingsService(), {
      // As in the DM's Atlas: players see the combatants' HP where the collection shows HP to them
      showsHp: (mapPath) => mapResources(collection, mapPath).some((definition) => definition.key === 'hp' && definition.visibleToPlayers),
      rules: () => this.rules,
    });
    panel.mount(container);
    panel.present(store);
  }

  setContext(context: PlayerCanvasContext): void {
    this.rules = context.initiativeRules;
    this.settings.set(context.playerView);
  }
}

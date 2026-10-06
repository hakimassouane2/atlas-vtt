import { PlayerInitiativePanel } from '../../services/PlayerInitiativePanel';
import { DEFAULT_INITIATIVE_RULES } from '../../gameSystems/initiativeRules';
import { mapResources, type CollectionLookup } from '../../resources/collectionResources';
import type { ViewAtlasStore } from '../../storeFactory';
import type { TokenEntity } from '../../types';
import type { InitiativeRules } from '../../types/initiativeRulesTypes';
import { PageSettings, pageApp } from './pageStandIns';
import type { PlayerCanvasContext } from '../scene/sceneProtocol';

/** The local player window's initiative order on the canvas page, read from the page's own store. */
export class InitiativeOverlay {
  private readonly settings = new PageSettings();
  private rules: InitiativeRules = { ...DEFAULT_INITIATIVE_RULES };

  constructor(container: HTMLElement, store: ViewAtlasStore, collection: CollectionLookup, controls: (token: TokenEntity) => boolean) {
    const panel = new PlayerInitiativePanel(pageApp, this.settings.asSettingsService(), {
      // As in the DM's Atlas: players see the combatants' HP where the collection shows HP to them
      showsHp: (mapPath) => mapResources(collection, mapPath).some((definition) => definition.key === 'hp' && definition.visibleToPlayers),
      rules: () => this.rules,
      viewerOf: (token) => (controls(token) ? 'controller' : 'player'),
    });
    panel.mount(container);
    panel.present(store);
  }

  setContext(context: PlayerCanvasContext): void {
    this.rules = context.initiativeRules;
    this.settings.set(context.playerView);
  }
}

import type { App } from 'obsidian';
import type { EventEmitter } from 'events';
import type { ViewAtlasStore } from '../storeFactory';
import { mapResources } from '../resources/collectionResources';
import { StatblockTokenSync } from '../plugin/StatblockTokenSync';
import { onMapRulesChange, rulesLookup } from './mapRules';
import { TokenStatblockLinkService } from './TokenStatblockLinkService';

/**
 * Keeps a view's linked tokens in step with their statblocks (`StatblockTokenSync`), outside the
 * canvas: an edited statblock note refreshes its linked tokens, a link made or broken elsewhere
 * reaches every token with that artwork, and linked tokens start the resources of their rules
 * they do not hold yet, on every load and whenever those rules change.
 */
export class TokenStatblockSync {
  private readonly sync: StatblockTokenSync;
  private readonly stopRules: () => void;
  private readonly onMapLoaded = (): void => this.sync.fillMissingResources();
  private destroyed = false;

  constructor(app: App, store: ViewAtlasStore, private readonly eventBus: EventEmitter) {
    const mapPath = (): string | null => store.getState().mapPath;
    this.sync = new StatblockTokenSync(app, store, TokenStatblockLinkService.getInstance(app), () => mapResources(rulesLookup(app), mapPath()));
    // Tokens loaded before the index read their rules' resources as unknown
    this.stopRules = onMapRulesChange(app, mapPath, () => {
      if (!this.destroyed) this.sync.fillMissingResources();
    });
    eventBus.on('map-loaded', this.onMapLoaded);
  }

  destroy(): void {
    this.destroyed = true;
    this.stopRules();
    this.sync.destroy();
    this.eventBus.off('map-loaded', this.onMapLoaded);
  }
}

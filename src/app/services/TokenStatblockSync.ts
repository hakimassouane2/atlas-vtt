import { TFile, type App, type EventRef } from 'obsidian';
import type { EventEmitter } from 'events';
import type { TokenUpdates, ViewAtlasStore } from '../storeFactory';
import type { ResourceDefinition } from '../resources/resourceTypes';
import { mapResources } from '../resources/collectionResources';
import { fillMissingResources, syncedResources } from '../resources/statblockResourceSync';
import { runUntracked } from '../stores/history';
import { runInBackground } from '../utils/backgroundTask';
import { buildStatblockLinkUpdates, readStatblockVitals, STATBLOCK_UNLINK_UPDATES } from '../pixi/token-renderer/statblockFrontmatter';
import { AssetService } from './AssetService';
import { TokenStatblockLinkService, type LinkChangeEvent } from './TokenStatblockLinkService';

/**
 * Keeps a view's linked tokens in step with their statblocks: an edited statblock note
 * relinks its artwork and refreshes name, resources and difficulty; a link made or broken
 * elsewhere reaches every token with that artwork; and linked tokens start the resources
 * of their collection they do not hold yet.
 */
export class TokenStatblockSync {
  private readonly assets: AssetService;
  private readonly links: TokenStatblockLinkService;
  private readonly metadataRef: EventRef;
  private readonly settingsRef: EventRef;
  private readonly onLinkChange = (event: LinkChangeEvent): void => this.applyLinkChange(event);
  private readonly onMapLoaded = (): void => this.fillMissingResources();
  private destroyed = false;

  constructor(private readonly app: App, private readonly store: ViewAtlasStore, private readonly eventBus: EventEmitter) {
    this.assets = AssetService.getInstance(app);
    this.links = TokenStatblockLinkService.getInstance(app);
    this.metadataRef = app.metadataCache.on('changed', (file: TFile) => runInBackground(this.statblockChanged(file), 'Statblock sync'));
    this.settingsRef = app.workspace.on('atlas-vtt:collection-settings-changed', (collectionId) => {
      const mapPath = this.store.getState().mapPath;
      if (mapPath && this.assets.getCollectionForMap(mapPath) === collectionId) this.fillMissingResources();
    });
    this.links.on('link-changed', this.onLinkChange);
    eventBus.on('map-loaded', this.onMapLoaded);
    // Tokens loaded before the index read their collection's resources as unknown
    this.assets.initialize().then(() => this.fillMissingResources(), (err: unknown) => {
      console.error('[TokenStatblockSync] Failed to initialize AssetService:', err);
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.app.metadataCache.offref(this.metadataRef);
    this.app.workspace.offref(this.settingsRef);
    this.links.off('link-changed', this.onLinkChange);
    this.eventBus.off('map-loaded', this.onMapLoaded);
  }

  private resources(): readonly ResourceDefinition[] {
    return mapResources(this.assets, this.store.getState().mapPath);
  }

  private async statblockChanged(file: TFile): Promise<void> {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontmatter) return;

    // Only character and statblock notes (with HP, or marked as a character)
    const isCharacter = frontmatter.hp !== undefined ||
      frontmatter.statblock !== undefined ||
      frontmatter.isCharacter === true ||
      frontmatter.type === 'character';
    if (!isCharacter) return;

    const statblockPath = file.path;
    // Read through the link service so this listener and the writer agree
    // on which frontmatter key holds the statblock's image.
    const newTokenImage = this.links.readStatblockImage(file);
    const currentTokenImage = await this.links.getTokenLinkedToStatblock(statblockPath);
    if (newTokenImage) {
      if (!currentTokenImage || !this.links.arePathsEquivalent(currentTokenImage, newTokenImage)) {
        // Unlinks the old artwork and updates every instance; the statblock changed, so it is not written again
        await this.links.linkTokenToStatblock(newTokenImage, statblockPath, { showConfirmation: false, updateStatblockAvatar: false });
      }
    } else if (currentTokenImage) {
      await this.links.unlinkToken(currentTokenImage, { updateStatblockAvatar: false });
    }
    if (this.destroyed) return;

    // Refresh statblock-derived data on this map, keeping live values such as the current HP
    const vitals = readStatblockVitals(frontmatter);
    for (const [tokenId, token] of Object.entries(this.store.getState().objects.tokens)) {
      if (token.kind !== 'character' || token.statblockPath !== statblockPath) continue;
      const updates: TokenUpdates = { name: vitals.name || token.name };
      const resources = syncedResources(token, frontmatter, this.resources());
      if (JSON.stringify(resources) !== JSON.stringify(token.resources ?? {})) updates.resources = resources;
      if (vitals.difficulty !== undefined) updates.difficulty = vitals.difficulty;
      if (newTokenImage && token.imagePath !== newTokenImage) updates.imagePath = newTokenImage;
      this.store.getState().updateToken(tokenId, updates);
    }
  }

  private applyLinkChange(event: LinkChangeEvent): void {
    const tokens = this.store.getState().objects.tokens;
    const affected = Object.keys(tokens).filter((tokenId) => tokens[tokenId]?.imagePath === event.tokenImagePath);
    if (event.type === 'linked' && event.statblockPath) {
      this.linkTokens(affected, event.statblockPath);
    } else if (event.type === 'unlinked') {
      // Unlinked: clear all statblock-derived data
      for (const tokenId of affected) this.store.getState().updateToken(tokenId, STATBLOCK_UNLINK_UPDATES);
    }
  }

  /** Gives tokens the data of the statblock they were linked to. */
  private linkTokens(tokenIds: string[], statblockPath: string): void {
    const statblockFile = this.app.vault.getAbstractFileByPath(statblockPath);
    const frontmatter = statblockFile instanceof TFile ? this.app.metadataCache.getFileCache(statblockFile)?.frontmatter : undefined;
    if (!frontmatter) return;
    for (const tokenId of tokenIds) {
      const token = this.store.getState().objects.tokens[tokenId];
      if (!token) continue;
      const currentName = token.kind === 'character' ? token.name : undefined;
      this.store.getState().updateToken(tokenId, {
        statblockPath,
        // Maxima set by hand belonged to the previous statblock.
        overriddenMax: undefined,
        ...buildStatblockLinkUpdates(frontmatter, currentName, this.resources(), token.resources),
      });
    }
  }

  /** Linked tokens start the collection's resources they do not hold yet, e.g. one defined after they were placed. */
  private fillMissingResources(): void {
    if (this.destroyed || this.store.getState().isPlayerView) return;
    runInBackground(fillMissingResources(
      {
        tokens: () => this.store.getState().objects.tokens,
        // Not an edit of the game master's: it must not become an undo step.
        apply: (entries) => runUntracked(this.store, () => this.store.getState().updateTokens(entries)),
      },
      this.resources(),
      (path) => this.links.readStatblockRecord(path),
    ), 'Starting missing token resources');
  }
}

import type { App, EventRef } from 'obsidian';
import type { EventEmitter } from 'events';
import type { ViewAtlasState, ViewAtlasStore } from '../storeFactory';
import type { TokenEntity } from '../types';
import { AssetService } from '../services/AssetService';
import { runUntracked } from '../stores/history';
import { sameValue } from '../utils/sameValue';
import { configOf, followLook, followRecord, lookOf, recordOf, sameLook, stateOf, type LibraryLook } from './characterRecord';
import type { TokenAsset } from '../services/AssetService';

/**
 * Keeps a view's tokens the characters of the library they were placed from (recognised by
 * their artwork): what a library character records of itself (`TokenAsset.character`) is what
 * its placements are, on every map. A map that loads and a token that appears (placed, pasted,
 * undone) take the record; a placement whose settings change, or a linked one whose resources
 * or conditions change, writes them to the record, which every open map then follows. A
 * character with no record yet is left alone until one of its placements is changed.
 */
export class CharacterSync {
  private readonly assets: AssetService;
  private readonly unsubscribe: () => void;
  private readonly characterRef: EventRef;
  private readonly onMapLoaded = (): void => this.followAll();
  /** While the record's values are written into the store, so they are not taken for an edit. */
  private following = false;
  private destroyed = false;

  constructor(private readonly app: App, private readonly store: ViewAtlasStore, private readonly eventBus: EventEmitter) {
    this.assets = AssetService.getInstance(app);
    this.unsubscribe = store.subscribe((state, previous) => this.tokensChanged(state, previous));
    this.characterRef = app.workspace.on('atlas-vtt:character-changed', (imagePath) => this.followSoon((token) => token.imagePath === imagePath));
    eventBus.on('map-loaded', this.onMapLoaded);
    // A map loaded before the index knew no characters
    this.assets.initialize().then(() => this.followAll(), (err: unknown) => {
      console.error('[CharacterSync] Failed to initialize AssetService:', err);
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.unsubscribe();
    this.app.workspace.offref(this.characterRef);
    this.eventBus.off('map-loaded', this.onMapLoaded);
  }

  private followAll(): void {
    this.follow(() => true);
  }

  /**
   * `follow` once the store write under way has reached every listener: records change while
   * the store tells its listeners of an edit, and a write then would reach the later ones out of order.
   */
  private followSoon(which: (token: TokenEntity) => boolean): void {
    queueMicrotask(() => {
      if (!this.destroyed) this.follow(which);
    });
  }

  /** Brings the tokens `which` picks in line with their characters' records, as no step of the GM's undo. */
  private follow(which: (token: TokenEntity) => boolean): void {
    const state = this.store.getState();
    if (state.isMapLoading) return;
    const updates = Object.values(state.objects.tokens).filter(which).flatMap((token) => {
      const changes = this.recordChanges(token);
      return changes ? [{ id: token.id, changes }] : [];
    });
    if (updates.length === 0) return;
    this.following = true;
    try {
      runUntracked(this.store, () => this.store.getState().updateTokens(updates));
    } finally {
      this.following = false;
    }
  }

  private recordChanges(token: TokenEntity): ReturnType<typeof followRecord> {
    const asset = this.assets.findTokenAssetByImagePath(token.imagePath);
    if (!asset) return null;
    // Without a record a placement still takes its library token's role and ring
    return asset.character ? followRecord(token, asset.character, libraryLookOf(asset)) : followLook(token, libraryLookOf(asset));
  }

  private tokensChanged(state: ViewAtlasState, previous: ViewAtlasState): void {
    if (this.following || state.isMapLoading || previous.isMapLoading) return;
    const tokens = state.objects.tokens;
    const before = previous.objects.tokens;
    if (tokens === before || state.mapPath !== previous.mapPath) return;
    const appeared = new Set<string>();
    for (const token of Object.values(tokens)) {
      const old = before[token.id];
      if (!old) appeared.add(token.id);
      else if (old !== token && changesCharacter(old, token)) this.record(token);
    }
    if (appeared.size > 0) this.followSoon((token) => appeared.has(token.id));
  }

  /** Writes what `token` now says of its character to the record, unless the record already says it. */
  private record(token: TokenEntity): void {
    const asset = this.assets.findTokenAssetByImagePath(token.imagePath);
    if (!asset) return;
    const record = recordOf(token);
    const look = lookOf(token);
    if (asset.character && sameValue(asset.character, record) && sameLook(libraryLookOf(asset), look)) return;
    this.assets.setCharacter(asset.id, record, look);
  }
}

function libraryLookOf(asset: TokenAsset): LibraryLook {
  return { size: asset.size, role: asset.role, ringStyle: asset.ringStyle };
}

/** Whether going from `old` to `token` changed what the character records: its settings, or its state while linked. */
function changesCharacter(old: TokenEntity, token: TokenEntity): boolean {
  if (!sameLook(lookOf(old), lookOf(token)) || !sameValue(configOf(old), configOf(token))) return true;
  return !!token.linked && !sameValue(stateOf(old), stateOf(token));
}

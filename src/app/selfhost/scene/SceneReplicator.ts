import type { StoreApi } from 'zustand';
import type { SettingsService } from '../../services/SettingsService';
import type { ViewAtlasState } from '../../storeFactory';
import type { CollectionSettings } from '../../types/collectionSettingsTypes';
import type { InitiativeRules } from '../../types/initiativeRulesTypes';
import type { PlayerCanvasContext, PlayerSceneMessage } from './sceneProtocol';
import { replicatedImagePaths, sceneChanges, sceneOf, type ReplicatedScene } from './sceneReplica';

/** The DM's scene: its store, and the collection whose rules it follows. */
export interface ReplicatedSource {
  store: StoreApi<ViewAtlasState>;
  /** The id and settings of the scene's collection; null for a map outside every collection. */
  collection(): { id: string; settings: CollectionSettings } | null;
  initiativeRules(): InitiativeRules;
  /** Calls `listener` when a collection's settings change; returns what stops it. */
  onCollectionChanged(listener: () => void): () => void;
}

/** Where the messages for players' canvases go: every player, or one who just joined. */
export interface SceneSink {
  toAll(event: PlayerSceneMessage['event'], data: unknown): void;
  toPlayer(playerId: string, event: PlayerSceneMessage['event'], data: unknown): void;
}

/**
 * Keeps the canvases in players' browsers in step with the DM's scene. A player who
 * joins, a scene that finished loading (another scene the DM opened, too) are sent whole (`scene`);
 * after that only what changed is sent (`changes`), once per task however many writes it made
 * (a drag, a player's command). Not per animation frame: frames stop while the DM's window is
 * hidden or behind another, and players would see nothing a player changed until the DM looked. What
 * the canvas reads besides the scene, the collection's rules and the player view settings,
 * travels as `context`. While a scene loads nothing is sent: players keep the scene they had.
 */
export class SceneReplicator {
  private source: ReplicatedSource | null = null;
  private sent: ReplicatedScene | null = null;
  private stopWatching: Array<() => void> = [];
  /** Whether a send waits for the current task to end. */
  private pending = false;

  constructor(private readonly settingsService: SettingsService, private readonly sink: SceneSink) {}

  setSource(source: ReplicatedSource | null): void {
    this.stopWatching.splice(0).forEach((stop) => stop());
    this.pending = false;
    this.source = source;
    this.sent = null;
    if (!source) return;
    this.stopWatching.push(
      source.store.subscribe(() => this.scheduleSend()),
      source.onCollectionChanged(() => this.sendContext()),
      this.settingsService.onChange(() => this.sendContext()),
    );
    this.sendWhole();
  }


  /** Gives a player who just joined the scene as it is now. */
  sendTo(playerId: string): void {
    const source = this.source;
    const state = source?.store.getState();
    if (!source || !state || state.isMapLoading) return;
    this.sink.toPlayer(playerId, 'context', this.context(source));
    this.sink.toPlayer(playerId, 'scene', sceneOf(state));
  }

  stop(): void {
    this.setSource(null);
  }

  /** The image files of the scene players were last sent, which their canvases load. */
  sentImages(): Set<string> {
    return this.sent ? replicatedImagePaths(this.sent) : new Set();
  }

  private scheduleSend(): void {
    if (this.pending) return;
    this.pending = true;
    const source = this.source;
    queueMicrotask(() => {
      // A source set meanwhile was sent whole
      if (!this.pending || this.source !== source) return;
      this.pending = false;
      this.sendChanges();
    });
  }

  private sendChanges(): void {
    const state = this.source?.store.getState();
    // A load rewrites the store in steps; the scene goes whole once it is done
    if (!state || state.isMapLoading) {
      this.sent = null;
      return;
    }
    if (!this.sent || this.sent.mapPath !== state.mapPath) {
      this.sendWhole();
      return;
    }
    const next = sceneOf(state);
    const changes = sceneChanges(this.sent, next);
    this.sent = next;
    if (changes.length > 0) this.sink.toAll('changes', changes);
  }

  private sendWhole(): void {
    const state = this.source?.store.getState();
    if (!state || state.isMapLoading) return;
    this.sent = sceneOf(state);
    this.sendContext();
    this.sink.toAll('scene', this.sent);
  }

  private sendContext(): void {
    if (this.source) this.sink.toAll('context', this.context(this.source));
  }

  private context(source: ReplicatedSource): PlayerCanvasContext {
    const collection = source.collection();
    return {
      collectionId: collection?.id ?? null,
      collection: collection?.settings ?? null,
      initiativeRules: source.initiativeRules(),
      playerView: this.settingsService.getLocalPlayerViewSettings(),
      diceDisplay: this.settingsService.getDiceDisplay(),
    };
  }
}

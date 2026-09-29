import type { OnlineFrameSource } from './OnlineFrameStream';
import { applyPlayerCommand, parsePlayerCommand } from './playerCommands';
import { playerTokens, type PlayerToken } from './playerTokens';

/** What players' pages receive: the tokens they may move, or none while the scene is not live. */
export interface PlayerState {
  tokens: PlayerToken[];
}

/**
 * Lets players act on the presented scene: publishes the tokens they control and
 * applies their commands. Only while the scene is live: a held frame shows a scene
 * the view no longer holds (its store then shows the DM's other tab), so commands
 * are refused until the DM presents or returns to it.
 */
export class PlayerControls {
  private source: OnlineFrameSource | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly publishState: (state: PlayerState) => void) {}

  /** The live scene, or null while it is held or gone. */
  setSource(source: OnlineFrameSource | null): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.source = source;
    if (source) {
      this.unsubscribe = source.store.subscribe((state, previous) => {
        if (state.isMapLoading) return;
        const changed = previous.isMapLoading || state.objects.tokens !== previous.objects.tokens || state.grid?.size !== previous.grid?.size;
        if (changed) this.publish();
      });
    }
    this.publish();
  }

  /** The map view owning `store` is closing. */
  releaseSource(store: OnlineFrameSource['store']): void {
    if (this.source?.store === store) this.setSource(null);
  }

  apply(body: unknown): boolean {
    const command = parsePlayerCommand(body);
    const source = this.source;
    if (!command || !source || source.store.getState().isMapLoading) return false;
    return applyPlayerCommand(source.store, source.renderer.getGridSystem(), command);
  }

  destroy(): void {
    this.setSource(null);
  }

  private publish(): void {
    const state = this.source?.store.getState();
    const tokens = state && !state.isMapLoading ? playerTokens(state.objects.tokens, state.grid?.size ?? 70) : [];
    this.publishState({ tokens });
  }
}

import type { StoreApi } from 'zustand';
import type { ViewAtlasState } from '../storeFactory';
import type { SharedRulers } from '../canvas/sharedRulers';

/** Who the DM's ruler is shared as; players' rulers go by their connection's id. */
export const DM_RULER = 'dm';

interface RulerSink {
  toAll(event: 'rulers', data: SharedRulers): void;
  toPlayer(playerId: string, event: 'rulers', data: SharedRulers): void;
}

/**
 * The drag rulers drawn on the followed scene, for players' pages: the DM's own (`localRuler`)
 * and the players' (`sharedRulers`, set by their `ruler` commands). Sent whole whenever one starts,
 * gains a waypoint or ends, and to every page that joins; each page leaves out its own.
 */
export class PlayerRulers {
  private store: StoreApi<ViewAtlasState> | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly sink: RulerSink) {}

  /** Follows the rulers of `store`; none while no scene is open. */
  setStore(store: StoreApi<ViewAtlasState> | null): void {
    if (store === this.store) return;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.store = store;
    if (store) {
      this.unsubscribe = store.subscribe((state, previous) => {
        if (state.localRuler !== previous.localRuler || state.sharedRulers !== previous.sharedRulers) this.sink.toAll('rulers', this.rulers());
      });
    }
    this.sink.toAll('rulers', this.rulers());
  }

  sendTo(playerId: string): void {
    this.sink.toPlayer(playerId, 'rulers', this.rulers());
  }

  private rulers(): SharedRulers {
    const state = this.store?.getState();
    if (!state) return {};
    return state.localRuler ? { ...state.sharedRulers, [DM_RULER]: state.localRuler } : state.sharedRulers;
  }
}

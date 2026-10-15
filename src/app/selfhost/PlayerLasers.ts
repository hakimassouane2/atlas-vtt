import type { StoreApi } from 'zustand';
import type { ViewAtlasState } from '../storeFactory';
import type { SharedLaser, SharedLaserPieces, SharedLasers } from '../canvas/sharedLasers';
import type { LaserPointerSettings } from '../tools/laserPointerSettings';

/** Who the DM's laser is shared as; players' lasers go by their connection's id. */
export const DM_LASER = 'dm';

interface LaserSink {
  toAll(event: 'lasers', data: SharedLaserPieces): void;
}

/**
 * Relays the lasers pointed on the followed scene to players' pages: the DM's own (`localLaser`,
 * in the colour and size the DM set) and the players' (`sharedLasers`, set by their `laser`
 * commands). Each new piece goes to every page as it comes, and a player who left goes as null;
 * each page leaves out its own. A page that joins sees the next piece: lasers last under a second.
 */
export class PlayerLasers {
  private unsubscribe: (() => void) | null = null;
  private store: StoreApi<ViewAtlasState> | null = null;

  constructor(private readonly sink: LaserSink, private readonly dmLaser: () => LaserPointerSettings) {}

  /** Follows the lasers of `store`; none while no scene is open. */
  setStore(store: StoreApi<ViewAtlasState> | null): void {
    if (store === this.store) return;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.store = store;
    if (!store) return;
    this.unsubscribe = store.subscribe((state, previous) => {
      const pieces: Record<string, SharedLaser | null> = {};
      if (state.localLaser && state.localLaser !== previous.localLaser) {
        const { color, size } = this.dmLaser();
        pieces[DM_LASER] = { ...state.localLaser, color, size };
      }
      if (state.sharedLasers !== previous.sharedLasers) Object.assign(pieces, changedLasers(state.sharedLasers, previous.sharedLasers));
      if (Object.keys(pieces).length > 0) this.sink.toAll('lasers', pieces);
    });
  }
}

/** The lasers of `lasers` that got a new piece since `previous`, and null for those that went. */
function changedLasers(lasers: SharedLasers, previous: SharedLasers): SharedLaserPieces {
  const changed: Record<string, SharedLaser | null> = {};
  for (const [who, laser] of Object.entries(lasers)) if (laser !== previous[who]) changed[who] = laser;
  for (const who of Object.keys(previous)) if (!lasers[who]) changed[who] = null;
  return changed;
}

import type { Viewport } from 'pixi-viewport';
import type { PlayerCameraState } from '../../local-player-view';

/** How long the camera glides to the DM's framing. */
const GLIDE_MS = 300;

/** The player's own camera on the page, moved as the GM moves theirs; recentering goes to where the DM looks. */
export class PageCamera {
  private dm: PlayerCameraState | null = null;

  constructor(private readonly viewport: () => Viewport | null) {}

  /** Where the DM looks now. */
  setDmCamera(camera: PlayerCameraState): void {
    this.dm = camera;
  }

  /** Glides to where the DM looks; returns whether the DM's camera is known. */
  recenter(): boolean {
    const viewport = this.viewport();
    if (!this.dm || !viewport) return false;
    const { centerX, centerY, scale } = this.dm;
    viewport.animate({ position: { x: centerX, y: centerY }, scale, time: GLIDE_MS, ease: 'easeInOutSine', removeOnInterrupt: true });
    return true;
  }
}

import type { Viewport } from 'pixi-viewport';
import type { PlayerCameraState } from '../../local-player-view';

/** How long the camera glides to the DM's framing. */
const GLIDE_MS = 300;

/**
 * The player's camera on the canvas page: their own, moved with the mouse as the GM moves theirs,
 * or the DM's while the DM makes players follow it. Recentering goes to where the DM looks.
 */
export class PageCamera {
  private dm: PlayerCameraState | null = null;
  private following = false;
  private readonly listeners = new Set<(following: boolean) => void>();

  constructor(private readonly viewport: () => Viewport | null) {}

  /** Where the DM looks now. */
  setDmCamera(camera: PlayerCameraState): void {
    this.dm = camera;
    if (this.following) this.goTo(camera, false);
  }

  /** The DM makes players follow their camera, or lets them move their own again. */
  setFollowing(following: boolean): void {
    this.following = following;
    const viewport = this.viewport();
    // While following, the player's own pan and zoom would only fight the DM's
    if (viewport) for (const plugin of ['drag', 'wheel', 'pinch', 'decelerate']) {
      if (following) viewport.plugins.pause(plugin);
      else viewport.plugins.resume(plugin);
    }
    if (following && this.dm) this.goTo(this.dm, true);
    this.listeners.forEach((listener) => listener(following));
  }

  isFollowing(): boolean {
    return this.following;
  }

  /** Calls `listener` when following starts or ends; returns what stops it. */
  onFollowingChange(listener: (following: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Goes to where the DM looks; returns whether the DM's camera is known. */
  recenter(): boolean {
    if (!this.dm) return false;
    this.goTo(this.dm, true);
    return true;
  }

  private goTo(camera: PlayerCameraState, glide: boolean): void {
    const viewport = this.viewport();
    if (!viewport) return;
    if (!glide) {
      viewport.setZoom(camera.scale, true);
      viewport.moveCenter(camera.centerX, camera.centerY);
      return;
    }
    viewport.animate({ position: { x: camera.centerX, y: camera.centerY }, scale: camera.scale, time: GLIDE_MS, ease: 'easeInOutSine', removeOnInterrupt: true });
  }
}

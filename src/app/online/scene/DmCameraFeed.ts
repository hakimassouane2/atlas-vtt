import type { PlayerCameraState } from '../../local-player-view';

/** How often the DM's camera is looked at. */
const CAMERA_INTERVAL_MS = 250;

/**
 * Tells players' canvases where the DM looks (`camera`: the centre of the DM's view and its zoom),
 * whenever it moves, so a player who recenters goes there.
 */
export class DmCameraFeed {
  private getCamera: (() => PlayerCameraState | undefined) | null = null;
  private sent: PlayerCameraState | null = null;
  private timer: number | null = null;

  constructor(private readonly send: (camera: PlayerCameraState) => void) {}

  /** Follows the camera `getCamera` reads, or none while the scene is held. */
  setSource(getCamera: (() => PlayerCameraState | undefined) | null): void {
    this.getCamera = getCamera;
    this.sent = null;
    if (getCamera && this.timer === null) this.timer = window.setInterval(() => this.check(), CAMERA_INTERVAL_MS);
    if (!getCamera) this.stop();
    else this.check();
  }

  /** The camera as it is now, for a player who just joined. */
  current(): PlayerCameraState | null {
    return this.getCamera?.() ?? null;
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private check(): void {
    const camera = this.getCamera?.();
    if (!camera) return;
    const { sent } = this;
    if (sent && sent.centerX === camera.centerX && sent.centerY === camera.centerY && sent.scale === camera.scale) return;
    this.sent = camera;
    this.send(camera);
  }
}

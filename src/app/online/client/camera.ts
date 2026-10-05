import type { FrameHeader } from '../protocol';
import { post } from './session';

/** What the player looks at: the world point at the centre of the window, and CSS pixels per world pixel. */
export interface Camera {
  centerX: number;
  centerY: number;
  zoom: number;
}

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 20;
/** A zoom the camera allows. */
export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Camera updates reach the DM's Atlas at most this often. */
const SEND_INTERVAL_MS = 50;

/**
 * The player's own camera. It moves at once on screen; the DM's Atlas hears of it
 * shortly after and renders the next frames through it. Without one (on arrival,
 * after recentering) and while the DM makes players follow theirs, frames taken
 * with the DM's camera set it.
 */
class PlayerCamera {
  current: Camera | null = null;
  isFollowingDm = false;
  private sendTimer: number | null = null;
  private readonly listeners = new Set<() => void>();

  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }

  toWorld(clientX: number, clientY: number, camera: Camera): { x: number; y: number } {
    return { x: camera.centerX + (clientX - innerWidth / 2) / camera.zoom, y: camera.centerY + (clientY - innerHeight / 2) / camera.zoom };
  }

  toScreen(x: number, y: number, camera: Camera): { x: number; y: number } {
    return { x: innerWidth / 2 + (x - camera.centerX) * camera.zoom, y: innerHeight / 2 + (y - camera.centerY) * camera.zoom };
  }

  /** Takes the DM's framing from a frame when the player has no camera of their own. */
  adopt(header: FrameHeader): void {
    if (!header.isDmCamera || (this.current && !this.isFollowingDm)) return;
    this.current = { centerX: header.centerX, centerY: header.centerY, zoom: header.zoom };
    this.notify();
  }

  /** The player panned or zoomed. */
  move(camera: Camera): void {
    this.current = { ...camera, zoom: clampZoom(camera.zoom) };
    this.notify();
    this.scheduleSend();
  }

  /** Back to the DM's framing: the next frame taken with the DM's camera sets it. */
  recenter(): void {
    this.current = null;
    void post('/camera', { recenter: true });
  }

  /** The DM's Atlas forgot this player's camera (another scene was presented). */
  forget(): void {
    this.current = null;
  }

  setFollowingDm(isFollowing: boolean): void {
    const wasFollowing = this.isFollowingDm;
    this.isFollowingDm = isFollowing;
    // Released players keep looking where the DM left them
    if (wasFollowing && !isFollowing) this.sendNow();
  }

  /** Tells the DM's Atlas the player's camera now, e.g. on a new connection, which starts on the DM's. */
  sendNow(): void {
    if (this.current && !this.isFollowingDm) {
      void post('/camera', { centerX: this.current.centerX, centerY: this.current.centerY, scale: this.current.zoom });
    }
  }

  private scheduleSend(): void {
    if (this.sendTimer !== null) return;
    this.sendTimer = window.setTimeout(() => {
      this.sendTimer = null;
      this.sendNow();
    }, SEND_INTERVAL_MS);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const playerCamera = new PlayerCamera();

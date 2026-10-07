import { LASER_PIECE_INTERVAL, type LaserPiece } from '../../canvas/sharedLasers';
import type { TrailPoint } from './laserTrail';

/**
 * Gathers what this view's laser draws into pieces for the others at an online table
 * (`localLaser`): at most one every `LASER_PIECE_INTERVAL` while pressed, and one at once when let go.
 */
export class LaserPublisher {
  private pending: TrailPoint[] = [];
  private pressing = false;
  private changed = false;
  private lastSent = -Infinity;

  constructor(private readonly publish: (piece: LaserPiece) => void) {}

  add(point: TrailPoint): void {
    this.pending.push(point);
    this.changed = true;
  }

  /** The laser was pressed or let go; letting go sends what is left at once. */
  setPressing(pressing: boolean, now: number): void {
    if (pressing === this.pressing) return;
    this.pressing = pressing;
    this.changed = true;
    if (!pressing) this.flush(now, true);
  }

  /** Sends what was drawn since the last piece, once the interval has passed (or at once with `force`). */
  flush(now: number, force = false): void {
    if (!this.changed || (!force && now - this.lastSent < LASER_PIECE_INTERVAL)) return;
    this.publish({
      points: this.pending.map(({ x, y, timestamp }) => ({ x, y, age: Math.max(0, now - timestamp) })),
      pressing: this.pressing,
    });
    this.pending = [];
    this.changed = false;
    this.lastSent = now;
  }
}

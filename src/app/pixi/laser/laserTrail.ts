import { LASER_FADE_TIME } from '../../tools/laserPointerSettings';
import type { BeamPoint } from './laserBeamGeometry';

/** A point of a laser's trail and when it was drawn, in this computer's `Date.now()`. */
export interface TrailPoint {
  x: number;
  y: number;
  timestamp: number;
}

/** Whether `point` still shows at `now`. */
export function isLive(point: TrailPoint, now: number): boolean {
  return now - point.timestamp < LASER_FADE_TIME;
}

/** The trail as the beam draws it: each point narrowing and fading with its age. */
export function beamTrail(points: readonly TrailPoint[], now: number): BeamPoint[] {
  return points.map((point) => ({ x: point.x, y: point.y, life: 1 - (now - point.timestamp) / LASER_FADE_TIME }));
}

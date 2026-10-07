import { LASER_FADE_TIME } from '../tools/laserPointerSettings';

/** A point of a laser's trail as it travels: where, and how many milliseconds before its piece was sent it was drawn. */
export interface LaserPoint {
  x: number;
  y: number;
  age: number;
}

/**
 * What a laser drew since its last piece, sent about every `LASER_PIECE_INTERVAL` while it is pressed,
 * and once more when it is let go (`pressing` false). Ages are relative, so the clocks of the
 * computers at the table never have to agree.
 */
export interface LaserPiece {
  points: LaserPoint[];
  pressing: boolean;
}

/** Someone else's laser: its latest piece, in their colour and size; `name` is the player's, none for the DM. */
export interface SharedLaser extends LaserPiece {
  color: string;
  size: number;
  name?: string;
}

/** The lasers of everyone else at an online table, by who points. */
export type SharedLasers = Readonly<Record<string, SharedLaser>>;

/** New pieces by who points; null for someone who left, whose laser goes. */
export type SharedLaserPieces = Readonly<Record<string, SharedLaser | null>>;

/** How often a pressed laser sends what it drew, in milliseconds; receivers play it back that much later, so it runs smoothly. */
export const LASER_PIECE_INTERVAL = 33;

/** More points than a hand draws between two pieces; a piece with more is not from Atlas. */
const MAX_PIECE_POINTS = 64;

/** A laser piece read from the network, or undefined for anything that is no piece. */
export function readLaserPiece(value: unknown): LaserPiece | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { points, pressing } = value as Record<string, unknown>;
  if (typeof pressing !== 'boolean' || !Array.isArray(points) || points.length > MAX_PIECE_POINTS) return undefined;
  const read: LaserPoint[] = [];
  for (const point of points) {
    const { x, y, age } = (point ?? {}) as Record<string, unknown>;
    if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(age)) return undefined;
    read.push({ x, y, age: Math.min(LASER_FADE_TIME, Math.max(0, age)) });
  }
  return { points: read, pressing };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

import type { Point } from '../grid/hexGeometry';

/**
 * A token's drag ruler as others see it: the token measured, and its snapped start followed by
 * every waypoint. The ruler ends where the token stands, which reaches others with the token.
 */
export interface RulerPath {
  tokenId: string;
  waypoints: Point[];
}

/** Someone else's ruler, in their colour (`#rrggbb`, a player's profile); the DM's has none and takes the accent. */
export interface SharedRuler extends RulerPath {
  color?: string;
}

/** The rulers of everyone else dragging a token now, by who drags. */
export type SharedRulers = Readonly<Record<string, SharedRuler>>;

/** More waypoints than anyone sets by hand; a path with more is not from Atlas. */
const MAX_WAYPOINTS = 64;

/** A ruler path read from the network: null for none, undefined for anything that is no path. */
export function readRulerPath(value: unknown): RulerPath | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'object' || value === undefined) return undefined;
  const { tokenId, waypoints } = value as Record<string, unknown>;
  if (typeof tokenId !== 'string' || !Array.isArray(waypoints) || waypoints.length === 0 || waypoints.length > MAX_WAYPOINTS) return undefined;
  const points: Point[] = [];
  for (const point of waypoints) {
    const { x, y } = (point ?? {}) as Record<string, unknown>;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    points.push({ x, y });
  }
  return { tokenId, waypoints: points };
}

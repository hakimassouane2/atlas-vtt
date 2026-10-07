import { getTokenRingCenterRadius } from '../tokenRingMetrics';
import { computeTokenStrokeWidth, WHEEL_ANCHOR_OFFSET, tokenUIScale } from '../tokenSizing';

/**
 * Where a token's right wheels hang from, in world units from the token's centre: a little
 * past the ring (by an offset that scales with the token, not with the UI), on the token's
 * bottom edge. The left wheels hang from its mirror, `-x`. The wheels and their
 * controls both use it, so they cannot drift apart.
 */
export function wheelAnchor(spriteSize: number, gridSize: number, ringScale: number): { x: number; y: number } {
  const ringRadius = getTokenRingCenterRadius(spriteSize * ringScale, computeTokenStrokeWidth(gridSize), ringScale);
  return { x: ringRadius + (WHEEL_ANCHOR_OFFSET / 2) * tokenUIScale(spriteSize), y: spriteSize / 2 };
}

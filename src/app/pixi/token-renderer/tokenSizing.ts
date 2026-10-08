import { t } from '../../i18n';
/**
 * Shared token sizing derived from the grid cell size.
 *
 * A size-1 token fills one cell minus a stroke inset on each side. On hex grids
 * the cell size is the flat-to-flat distance, so the same formula fits the
 * hex's inscribed circle. Larger tokens span (2n - 1) cells so they stay
 * centered on a cell.
 */

const REFERENCE_CELL_SIZE = 70;
const REFERENCE_STROKE_WIDTH = 4;

/** Stroke inset in pixels, proportional to the grid size (4px at a 70px cell). */
export function computeTokenStrokeWidth(gridSize: number): number {
  return Math.max(1, Math.round((gridSize * REFERENCE_STROKE_WIDTH) / REFERENCE_CELL_SIZE));
}

/** Diameter in cells covered by a token of the given size multiplier. */
export function tokenDiameterInCells(sizeInCells: number): number {
  return 2 * sizeInCells - 1;
}

/** Named footprints offered in menus, stored as the multiplier `tokenDiameterInCells` expects. */
export const TOKEN_SIZE_OPTIONS: ReadonlyArray<{ label: string; size: number }> = [
  { label: t('token.size.medium'), size: 1 },
  { label: t('token.size.large'), size: 1.5 },
  { label: t('token.size.huge'), size: 2 },
  { label: t('token.size.gargantuan'), size: 2.5 },
];

const CREATURE_SIZE_MULTIPLIERS: Record<string, number> = { tiny: 1, small: 1, medium: 1, large: 1.5, huge: 2, gargantuan: 2.5 };

/** Size multiplier for a creature size word from statblock data ("Large", "Huge or larger"); undefined when unknown. */
export function tokenSizeFromCreatureSize(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const word = value.trim().toLowerCase().split(/\s+/)[0] ?? '';
  return CREATURE_SIZE_MULTIPLIERS[word];
}

/** Side in pixels of the cells a token covers: its sprite plus the stroke inset around it. */
export function tokenFootprintSize(gridSize: number, sizeInCells: number): number {
  return gridSize * tokenDiameterInCells(sizeInCells);
}

/** Token sprite diameter in pixels for a token covering `sizeInCells` cells. */
export function computeTokenPixelSize(gridSize: number, sizeInCells: number): number {
  const strokeWidth = computeTokenStrokeWidth(gridSize);
  return (gridSize - 2 * strokeWidth) * tokenDiameterInCells(sizeInCells);
}

/** Sprite diameter the token UI is designed for: a medium token on a 70px grid. */
const TOKEN_UI_REFERENCE_SIZE = computeTokenPixelSize(REFERENCE_CELL_SIZE, 1);

/**
 * Scale of a token's UI (resource bars, nameplate, condition markers, +/- buttons)
 * for a sprite `spriteSize` pixels wide. The UI lives in
 * world space and keeps its proportions to the token, so it zooms with the map and
 * never hides a small token or shrinks to nothing on a large one.
 */
export function tokenUIScale(spriteSize: number): number {
  return spriteSize / TOKEN_UI_REFERENCE_SIZE;
}

/** How far a resource wheel's anchor stands out from the token's ring, before `tokenUIScale`. */
export const WHEEL_ANCHOR_OFFSET = 20;

/** Height of the nameplate, which lies on the token's bottom edge, in UI units. */
export const NAMEPLATE_HEIGHT = 14;

/**
 * Scale of a token's bars, nameplate and condition markers, selected or not: a medium
 * token's on a `gridSize` grid, whatever the token's size, so the bars of huge tokens do
 * not cover the map around them. It lives in world space, so it zooms with the map.
 */
export function restingTokenUIScale(gridSize: number): number {
  return tokenUIScale(computeTokenPixelSize(gridSize, 1));
}

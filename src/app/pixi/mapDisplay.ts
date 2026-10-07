import { Sprite, Texture } from 'pixi.js';
import type { PixiRendererOrchestrator } from '../PixiRendererOrchestrator';
import type { GridOptions } from '../grid/GridSystem';
import type { GridState } from '../services/MapPersistence';
import { parseGridColor } from '../grid/gridContrastColor';
import { cellNumberStyleOfGrid } from '../grid/cellNumbering';

/**
 * Puts the map image `texture` on the canvas and lays the scene's grid over it. The grid starts
 * enabled; a grid the renderer already shows keeps its offset (an alignment in progress).
 */
export function showMapImage(renderer: PixiRendererOrchestrator, texture: Texture, grid: Partial<GridState> | null | undefined): Sprite {
  const sprite = Sprite.from(texture);
  if (texture.width > 0 && texture.height > 0) {
    sprite.width = texture.width;
    sprite.height = texture.height;
  }
  renderer.setBackgroundSprite(sprite);

  const currentGrid = renderer.getGridSystem()?.getOptions();
  const gridOptions: GridOptions = {
    type: grid?.type ?? 'square',
    size: grid?.size ?? 70,
    offsetX: currentGrid ? currentGrid.offsetX ?? 0 : grid?.offsetX ?? 0,
    offsetY: currentGrid ? currentGrid.offsetY ?? 0 : grid?.offsetY ?? 0,
    color: parseGridColor(grid?.color),
    alpha: grid?.opacity ?? 0.7,
    cellNumbers: cellNumberStyleOfGrid(grid),
    enabled: true,
  };
  renderer.initGrid(gridOptions, sprite);
  return sprite;
}

/** Centers the viewport on the map and zooms so the whole map fits, with some room around it. */
export function centerAndFitMap(renderer: PixiRendererOrchestrator, backgroundSprite: Sprite): void {
  const viewport = renderer.getViewportInstance();
  if (!viewport) {
    console.warn('[MapController] Cannot center map: viewport not available');
    return;
  }
  const padding = 0.9; // 90% of viewport size
  const scale = Math.min(
    (viewport.screenWidth * padding) / backgroundSprite.width,
    (viewport.screenHeight * padding) / backgroundSprite.height,
  );
  // Clamp the scale to the viewport's zoom limits
  viewport.setZoom(Math.max(0.1, Math.min(scale, 5)));
  viewport.moveCenter(backgroundSprite.width / 2, backgroundSprite.height / 2);
}

/**
 * Transparent placeholders by grid size, shared by every map without a background.
 * Nothing unloads a placeholder when the scene changes, so a new one per load leaked its canvas.
 */
const placeholderTextures = new Map<number, Texture>();

/** A transparent texture of 20x20 cells of `gridSize`, for maps without a background image. */
export function mapPlaceholderTexture(gridSize: number): Texture {
  const cached = placeholderTextures.get(gridSize);
  if (cached && !cached.destroyed) return cached;
  const canvas = createEl('canvas');
  canvas.width = gridSize * 20;
  canvas.height = gridSize * 20;
  if (!canvas.getContext('2d')) return Texture.EMPTY;
  const texture = Texture.from(canvas);
  placeholderTextures.set(gridSize, texture);
  return texture;
}

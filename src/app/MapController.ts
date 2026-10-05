import { App } from 'obsidian';
import { MapLoader } from './MapLoader';
import type { MapFile } from './services/MapPersistence';
import { PixiRendererOrchestrator } from './PixiRendererOrchestrator';
import { backgroundTextureCache } from './pixi/backgroundTextureCache';
import { centerAndFitMap, showMapImage } from './pixi/mapDisplay';

export interface DisplayedMap {
  mapData: MapFile;
  /** Background texture reference held for this map; release it through `backgroundTextureCache`. */
  backgroundUrl: string | null;
}

/**
 * Load the given map file, create background sprite, initialise grid and
 * return the parsed mapData. Returns null without touching the renderer when
 * `isSuperseded` reports that a newer load took over while the file was read.
 */
async function loadAndDisplay(
  app: App,
  renderer: PixiRendererOrchestrator,
  filePath: string,
  restoreCamera: boolean = true,
  isSuperseded: () => boolean = () => false,
): Promise<DisplayedMap | null> {
  const { mapData, texture, backgroundUrl } = await MapLoader.load(app, filePath);
  if (isSuperseded()) {
    if (backgroundUrl) backgroundTextureCache.release(backgroundUrl);
    return null;
  }

  const sprite = showMapImage(renderer, texture, mapData.grid);

  // Restore camera state if present, otherwise center and fit
  const viewport = renderer.getViewportInstance();
  if (viewport) {
    // Always center and fit on initial load, unless explicitly restoring camera
    // Check if camera has valid values (not just default 0,0,1)
    const hasValidCamera = mapData.camera &&
                         (mapData.camera.x !== 0 || mapData.camera.y !== 0 || mapData.camera.scale !== 1);

    if (restoreCamera && hasValidCamera) {
      // Restore saved camera position
      viewport.moveCenter(mapData.camera.x, mapData.camera.y);
      viewport.setZoom(mapData.camera.scale);
    } else {
      // Center and fit the map in the viewport
      centerAndFitMap(renderer, sprite);
    }
  } else {
    console.warn('[MapController] Viewport not available for camera positioning');
  }

  // Ensure in‑memory map data reflects current grid enabled status so the UI
  // shows the correct state.
  if (mapData.grid) {
    mapData.grid.enabled = true;
  } else {
    const shown = renderer.getGridSystem()?.getOptions();
    mapData.grid = {
      enabled: true,
      size: shown?.size ?? 70,
      offsetX: shown?.offsetX ?? 0,
      offsetY: shown?.offsetY ?? 0,
      opacity: 0.7,
    };
  }

  return { mapData, backgroundUrl };
}

/**
 * Handles loading map resources and initialising renderer state.
 */
export const MapController = { loadAndDisplay };

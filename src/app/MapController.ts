import type { App } from 'obsidian';
import { MapLoader, mapImageSourceFor } from './MapLoader';
import type { MapFile } from './services/MapPersistence';
import { MAP_THUMBNAIL_SIZE } from './services/MapThumbnailService';
import { readMapStretch } from './grid/mapStretch';
import { MapImage } from './pixi/mapImage/MapImage';
import { MapImageService } from './pixi/mapImage/MapImageService';
import { fitMapRect, fitZoomRange } from './pixi/fitMapRect';
import { showCamera, type ViewCamera } from './pixi/viewCamera';
import { showMapGrid, viewMapImageDeps, type MapRenderer } from './pixi/mapDisplay';
import type { ViewAtlasStore } from './storeFactory';

export interface DisplayedMap {
  mapData: MapFile;
}

/** The store background each map image shows, as the load or the store's change that showed it named it. */
const shownBackground = new WeakMap<MapImage, string | null>();

/** The view's map image, made and handed to the renderer on the first load; null without a viewport. */
function viewMapImage(app: App, renderer: MapRenderer): MapImage | null {
  const existing = renderer.getMapImage();
  if (existing) return existing;
  const deps = viewMapImageDeps(renderer, MapImageService.forApp(app), MAP_THUMBNAIL_SIZE);
  if (!deps) return null;
  const mapImage = new MapImage(deps);
  renderer.setMapImage(mapImage);
  return mapImage;
}

/**
 * Load the given map file, show its map image, initialise grid and
 * return the parsed mapData. Returns null without touching the renderer when
 * `isSuperseded` reports that a newer load took over while the file was read.
 * The camera goes to `camera` (a tab's own, kept from when it was last shown), else fits the map.
 */
async function loadAndDisplay(
  app: App,
  renderer: MapRenderer,
  filePath: string,
  camera: ViewCamera | null = null,
  isSuperseded: () => boolean = () => false,
): Promise<DisplayedMap | null> {
  const { mapData, image } = await MapLoader.load(app, filePath);
  if (isSuperseded()) return null;

  const mapImage = viewMapImage(app, renderer);
  if (mapImage) {
    shownBackground.set(mapImage, mapData.background ?? null);
    await mapImage.load(image, readMapStretch(mapData.grid?.mapStretch));
    if (isSuperseded()) return null;
  }

  // The grid always starts enabled, so the user instantly sees it and can toggle it off later.
  const gridOptions = mapImage ? showMapGrid(renderer, mapImage, mapData.grid) : null;

  const viewport = renderer.getViewportInstance();
  const worldRect = mapImage?.worldRect;
  if (!viewport) console.warn('[MapController] Viewport not available for camera positioning');
  else if (camera) {
    if (worldRect) fitZoomRange(viewport, worldRect);
    showCamera(viewport, camera);
  } else if (worldRect) fitMapRect(viewport, worldRect);

  // Ensure in‑memory map data reflects current grid enabled status so the UI
  // shows the correct state.
  if (mapData.grid) {
    mapData.grid.enabled = true;
  } else {
    mapData.grid = {
      enabled: true,
      size: gridOptions?.size ?? 70,
      offsetX: gridOptions?.offsetX ?? 0,
      offsetY: gridOptions?.offsetY ?? 0,
      opacity: 0.7,
    };
  }

  return { mapData };
}

/**
 * Shows the store's background whenever it changes outside a load (undo or redo of a background
 * change, a missing image removed): the image loads into the same map image. Returns the unsubscribe.
 */
function followBackground(app: App, store: ViewAtlasStore, mapImage: MapImage): () => void {
  return store.subscribe((state) => state.background, (background) => {
    const state = store.getState();
    // A load sets the background itself and shows the image of its file.
    if (!state.mapLoaded || state.isMapLoading) return;
    if (shownBackground.get(mapImage) === background) return;
    shownBackground.set(mapImage, background);
    void mapImage.load(mapImageSourceFor(app, background, state.grid?.size));
  });
}

/**
 * Handles loading map resources and initialising renderer state.
 */
export const MapController = { loadAndDisplay, followBackground };

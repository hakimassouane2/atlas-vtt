import type { App } from 'obsidian';
import { MapLoader, mapImageSourceFor } from './MapLoader';
import type { MapFile } from './services/MapPersistence';
import { MAP_THUMBNAIL_SIZE } from './services/MapThumbnailService';
import { sameStretch } from './grid/mapStretch';
import { levelAlignmentsOf, levelImagePlacement, viewedImagePlacement } from './levels/levelAlignment';
import { MapImage } from './pixi/mapImage/MapImage';
import { MapImageService } from './pixi/mapImage/MapImageService';
import { vaultMapVideos } from './pixi/mapImage/video/vaultMapVideos';
import { fitMapRect, fitZoomRange } from './pixi/fitMapRect';
import { showCamera, type ViewCamera } from './pixi/viewCamera';
import { askedBackground, followStretch, onBackgroundLoaded, showBackground, showMapGrid, showsViewedLevel, viewMapImageDeps, type MapRenderer } from './pixi/mapDisplay';
import type { ViewAtlasStore } from './storeFactory';
import { levelBackground } from './levels/levelEdits';
import { viewedLevelId } from './levels/sceneLevels';

export interface DisplayedMap {
  mapData: MapFile;
  /** The level shown (`MapLoader.load`); null for a scene without levels. */
  level: string | null;
}

/** The view's map image, made and handed to the renderer on the first load; null without a viewport. */
function viewMapImage(app: App, renderer: MapRenderer): MapImage | null {
  const existing = renderer.getMapImage();
  if (existing) return existing;
  const service = MapImageService.forApp(app);
  const deps = viewMapImageDeps(renderer, service, MAP_THUMBNAIL_SIZE);
  if (!deps) return null;
  const pixi = renderer.getAppInstance();
  const mapImage = new MapImage({ ...deps, video: vaultMapVideos(app, service, pixi.renderer, pixi.canvas) });
  renderer.setMapImage(mapImage);
  return mapImage;
}

/**
 * Load the given map file, show its map image, initialise grid and
 * return the parsed mapData. Returns null without touching the renderer when
 * `isSuperseded` reports that a newer load took over while the file was read.
 * The camera goes to `camera` (a tab's own, kept from when it was last shown), else fits the map.
 * The level shown is `level`, else the camera's, else the first.
 */
async function loadAndDisplay(
  app: App,
  renderer: MapRenderer,
  filePath: string,
  camera: ViewCamera | null = null,
  isSuperseded: () => boolean = () => false,
  shownLevel?: string,
): Promise<DisplayedMap | null> {
  const { mapData, image, level } = await MapLoader.load(app, filePath, shownLevel ?? camera?.level);
  if (isSuperseded()) return null;

  const mapImage = viewMapImage(app, renderer);
  if (mapImage) {
    const placement = levelImagePlacement({ levels: mapData.levels, grid: mapData.grid, levelAlignments: levelAlignmentsOf(mapData.levels) }, level);
    await showBackground(mapImage, levelBackground(mapData, level), () => mapImage.load(image, placement));
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

  return { mapData, level };
}

/**
 * Shows the background of the level the view shows whenever it changes outside a load (another
 * level shown, undo or redo of a background change, a missing image removed): the image loads into
 * the same map image. Returns the unsubscribe.
 */
function followBackground(app: App, store: ViewAtlasStore, mapImage: MapImage): () => void {
  return store.subscribe((state) => levelBackground(state, viewedLevelId(state)), (background) => {
    const state = store.getState();
    // A load sets the background itself and shows the image of its file.
    if (!state.mapLoaded || state.isMapLoading) return;
    if (askedBackground(mapImage) === background) return;
    // The image comes in drawn as its level is aligned, and follows an alignment changed while it loaded
    void showBackground(mapImage, background, () => mapImage.load(mapImageSourceFor(app, background, state.grid?.size), viewedImagePlacement(state))).then(() => {
      const placement = viewedImagePlacement(store.getState());
      if (askedBackground(mapImage) === background && !sameStretch(placement, mapImage.mapStretch)) mapImage.setStretch(placement);
    });
  });
}

/**
 * Handles loading map resources and initialising renderer state.
 */
export const MapController = { loadAndDisplay, followBackground, followStretch, showsViewedLevel, onBackgroundLoaded };

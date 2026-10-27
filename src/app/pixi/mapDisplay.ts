import { Ticker } from 'pixi.js';
import type { PixiRendererOrchestrator } from '../PixiRendererOrchestrator';
import type { GridOptions } from '../grid/GridSystem';
import type { GridState } from '../types/gridTypes';
import { parseGridColor } from '../grid/gridContrastColor';
import { cellNumberStyleOfGrid } from '../grid/cellNumbering';
import { sameStretch } from '../grid/mapStretch';
import { viewedImagePlacement } from '../levels/levelAlignment';
import { levelBackground } from '../levels/levelEdits';
import { viewedLevelId, type LevelView } from '../levels/sceneLevels';
import type { ViewAtlasStore } from '../storeFactory';
import { prefersReducedMotion } from '../utils/motion';
import type { MapImage } from './mapImage/MapImage';
import type { MapImageDeps, MapImageOpener } from './mapImage/mapImageTypes';
import { requestRender } from './RenderScheduler';

/** The part of the renderer a map is shown through. */
export type MapRenderer = Pick<
  PixiRendererOrchestrator,
  'getMapImage' | 'setMapImage' | 'getAppInstance' | 'getViewportInstance' | 'getGridSystem' | 'initGrid'
>;

/**
 * What the map image of the view `renderer` draws is made with; `service` opens and reads its files
 * (the vault's in Obsidian). The image itself is made by its owner and handed to `setMapImage`.
 */
export function viewMapImageDeps(renderer: MapRenderer, service: MapImageOpener, picture?: { width: number; height: number }): MapImageDeps | null {
  const viewport = renderer.getViewportInstance();
  if (!viewport) return null;
  const pixi = renderer.getAppInstance();
  return {
    service,
    viewport,
    // Not the app's ticker: a load stops that one to hold the last frame (`bindMapLoadingFrameHold`)
    // and waits for the tiles in view, which arrive on this one.
    ticker: Ticker.shared,
    renderer: pixi.renderer,
    requestRender: () => requestRender(pixi),
    // While a load holds the last frame, the crossfade from it shows the tiles, so they do not fade in too.
    drawAtOnce: () => !pixi.ticker.started || prefersReducedMotion(pixi.canvas),
    ...(picture && { picture }),
  };
}

/**
 * The grid a scene's `grid` lays over its map. It starts enabled; a grid the renderer already
 * shows keeps its offset (an alignment in progress).
 */
export function mapGridOptions(renderer: Pick<MapRenderer, 'getGridSystem'>, grid: Partial<GridState> | null | undefined): GridOptions {
  const currentGrid = renderer.getGridSystem()?.getOptions();
  return {
    type: grid?.type ?? 'square',
    size: grid?.size ?? 70,
    offsetX: currentGrid ? currentGrid.offsetX ?? 0 : grid?.offsetX ?? 0,
    offsetY: currentGrid ? currentGrid.offsetY ?? 0 : grid?.offsetY ?? 0,
    color: parseGridColor(grid?.color),
    alpha: grid?.opacity ?? 0.7,
    cellNumbers: cellNumberStyleOfGrid(grid),
    enabled: true,
  };
}

/** Lays the scene's `grid` over `mapImage` (`mapGridOptions`). */
export function showMapGrid(renderer: MapRenderer, mapImage: MapImage, grid: Partial<GridState> | null | undefined): GridOptions {
  const options = mapGridOptions(renderer, grid);
  renderer.initGrid(options, mapImage);
  return options;
}

/** The store background each map image shows, as the load or the store's change that showed it named it. */
const shownBackground = new WeakMap<MapImage, string | null>();
/** The background each map image has finished loading: what it shows on screen. */
const loadedBackground = new WeakMap<MapImage, string | null>();

/** Who hears that a map image has finished loading the background asked of it (`onBackgroundLoaded`). */
const backgroundListeners = new Set<(mapImage: MapImage) => void>();

/** The background `mapImage` was last asked to show (`showBackground`); undefined before any. */
export function askedBackground(mapImage: MapImage): string | null | undefined {
  return shownBackground.get(mapImage);
}

/** Loads `background` into `mapImage` and notes it shown once loaded, unless another was asked for meanwhile. */
export async function showBackground(mapImage: MapImage, background: string | null, load: () => Promise<void>): Promise<void> {
  shownBackground.set(mapImage, background);
  await load();
  if (shownBackground.get(mapImage) !== background) return;
  loadedBackground.set(mapImage, background);
  for (const listener of [...backgroundListeners]) listener(mapImage);
}

/**
 * Calls `listener` whenever a map image has finished loading the background it was last asked
 * for, so whoever waits for `showsViewedLevel` learns when it turns true. Returns the unsubscribe.
 */
export function onBackgroundLoaded(listener: (mapImage: MapImage) => void): () => void {
  backgroundListeners.add(listener);
  return () => { backgroundListeners.delete(listener); };
}

/**
 * Whether `mapImage` shows the background of the level the view's state shows: after a switch of
 * level it does once that level's image has loaded. Players' frames wait for it.
 */
export function showsViewedLevel(mapImage: MapImage | null, state: Parameters<typeof levelBackground>[0] & LevelView): boolean {
  return !mapImage || loadedBackground.get(mapImage) === levelBackground(state, viewedLevelId(state));
}

/** Whether another image is on its way into `mapImage`, which will come in drawn as its level is. */
function loadingAnother(mapImage: MapImage): boolean {
  return shownBackground.get(mapImage) !== loadedBackground.get(mapImage);
}

/**
 * Draws the map image as the level the view shows is aligned (`viewedImagePlacement`) whenever that
 * changes outside a load (an alignment applied, its undo or redo, another level shown), and says so
 * with `onFollowed`. Returns the unsubscribe.
 */
export function followStretch(store: ViewAtlasStore, mapImage: MapImage, onFollowed: () => void): () => void {
  return store.subscribe((state) => viewedImagePlacement(state), (stretch) => {
    const state = store.getState();
    // A load shows its image with the stretch of its file, and another level's image comes in drawn as its level is.
    if (!state.mapLoaded || state.isMapLoading || loadingAnother(mapImage)) return;
    mapImage.setStretch(stretch);
    // The image may have been drawn this way already, as an alignment's preview: nothing changed on it then.
    onFollowed();
  }, { equalityFn: sameStretch });
}

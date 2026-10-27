import type { TFile } from 'obsidian';
import { TileDecoderClient, type OpenedMap } from '../../pixi/mapImage/TileDecoderClient';
import type { MapImageOpener, MapImageSource } from '../../pixi/mapImage/mapImageTypes';
import type { TileRef } from '../../pixi/mapImage/pyramid';
import { workerPort, inThreadPort } from '../../pixi/mapImage/tilePorts';
import TileWorker from '../../pixi/mapImage/tileWorker?worker&inline';
import { sceneImageUrl } from './session';

/** A scene image as the map image opens it on the page: only its vault path, read from the DM's Atlas. */
type PageImageFile = Pick<TFile, 'path' | 'extension'>;

/** Blank maps are this many cells a side, as on the GM's side (`MapLoader.mapImageSourceFor`). */
const EMPTY_MAP_CELLS = 20;

/**
 * The page's map tile worker: what `MapImageService` is for the GM, with the image's bytes fetched
 * from the DM's Atlas (`/image/<path>`) and its tiles kept in memory.
 */
export class PageMapImages implements MapImageOpener {
  private readonly client = new TileDecoderClient({
    appId: null,
    worker: workerPort(() => new TileWorker({ name: 'Atlas map tiles' })),
    inThread: inThreadPort(),
  });

  /** What the map image of a scene with `background` shows. */
  sourceFor(background: string | null | undefined, gridSize: number | undefined): MapImageSource {
    if (!background) {
      const side = (gridSize || 70) * EMPTY_MAP_CELLS;
      return { kind: 'none', width: side, height: side };
    }
    const file: PageImageFile = { path: background, extension: background.split('.').pop() ?? '' };
    // The map image hands the file back to `open` only: a path is all the page has of it, and no vault
    return { kind: 'file', file } as MapImageSource;
  }

  open(file: TFile): Promise<OpenedMap> {
    const url = sceneImageUrl(file.path);
    return this.client.open(async () => {
      const response = await window.fetch(url);
      if (!response.ok) throw new Error(`The map image could not be fetched (${response.status}).`);
      return response.arrayBuffer();
    }, null);
  }

  tile(handle: number, ref: TileRef, signal?: AbortSignal): Promise<ImageBitmap> {
    return this.client.tile(handle, ref, signal);
  }

  overview(handle: number, maxSide: number, signal?: AbortSignal): Promise<ImageBitmap> {
    return this.client.overview(handle, maxSide, signal);
  }

  close(handle: number): void {
    this.client.close(handle);
  }

  onRestart(listener: () => void): () => void {
    return this.client.onRestart(listener);
  }

  reportUnshown(file: TFile, error: unknown): void {
    console.error(`[PageMapImages] The map image ${file.path} cannot be shown:`, error);
  }

  dispose(): void {
    this.client.dispose();
  }
}

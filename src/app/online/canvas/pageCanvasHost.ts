import type { ArtSource, CanvasCollections, CanvasHost, CanvasSettings } from '../../canvas/canvasHost';
import type { CollectionSettings } from '../../types/collectionSettingsTypes';
import { DEFAULT_MAP_HOTKEYS } from '../../keyboard/mapHotkeys';
import { DEFAULT_LASER_POINTER_SETTINGS } from '../../tools/laserPointerSettings';
import { imageMimeTypeOfPath } from '../../utils/imageMimeTypes';
import { sceneImageUrl } from '../client/session';

/** The collection of the presented scene, as the DM's Atlas sends it (`context`). */
export class SentCollection implements CanvasCollections {
  private id: string | null = null;
  private settings: CollectionSettings | null = null;
  private readonly listeners = new Set<(collectionId: string) => void>();
  private markReady!: () => void;
  private readonly isReady = new Promise<void>((resolve) => { this.markReady = resolve; });

  /** The page shows one scene: whatever map is asked about is the presented one. */
  getCollectionForMap(): string | null {
    return this.id;
  }

  getCollectionSettings(): CollectionSettings {
    if (!this.settings) throw new Error('[SentCollection] The scene has no collection');
    return this.settings;
  }

  ready(): Promise<void> {
    return this.isReady;
  }

  onChanged(listener: (collectionId: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  set(id: string | null, settings: CollectionSettings | null): void {
    this.id = id && settings ? id : null;
    this.settings = settings;
    this.markReady();
    if (this.id) this.listeners.forEach((listener) => listener(this.id!));
  }
}

/** Token art from the DM's Atlas, which serves the images of the presented scene. */
const sentArt: ArtSource = {
  read: async (path) => {
    const response = await window.fetch(sceneImageUrl(path));
    if (!response.ok) return null;
    const mimeType = response.headers.get('Content-Type') ?? imageMimeTypeOfPath(path) ?? 'image/png';
    return { bytes: await response.arrayBuffer(), mimeType };
  },
  // The DM's Atlas sends a scene anew rather than single images
  onChanged: () => () => undefined,
};

/** Players have no settings of their own yet: Atlas' defaults. */
const defaultSettings: CanvasSettings = {
  getHotkeys: () => DEFAULT_MAP_HOTKEYS,
  getLaserPointerSettings: () => DEFAULT_LASER_POINTER_SETTINGS,
};

/** The canvas of a player's page: what it reads comes from the DM's Atlas; it has no lighting, audio or menus. */
export function pageCanvasHost(collection: SentCollection): CanvasHost {
  return {
    art: sentArt,
    collections: collection,
    settings: () => defaultSettings,
    prepareToken: async (token) => token,
  };
}

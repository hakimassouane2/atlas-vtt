import type { StoreApi } from 'zustand';
import type { CollectionLookup } from '../resources/collectionResources';
import type { ResourceDefinition } from '../resources/resourceTypes';
import type { ViewAtlasState } from '../storeFactory';
import type { TokenEntity } from '../types';
import type { ConditionDefinition } from '../types/collectionSettingsTypes';
import type { GridSystem } from '../grid/GridSystem';
import type { LightingFeature } from '../pixi/lighting/LightingFeature';
import type { LightingControllerDeps } from '../pixi/lighting/LightingController';
import type { AudioFeature, AudioFeatureDeps } from '../pixi/audio/AudioFeature';
import type { HotkeySettings } from '../keyboard/mapHotkeys';
import type { LaserPointerSettings } from '../tools/laserPointerSettings';

/** The bytes of an image a canvas shows, with their type. */
export interface ArtFile {
  bytes: ArrayBuffer;
  mimeType: string;
}

/** Where a canvas reads the art its tokens show. */
export interface ArtSource {
  /** The image at `path`, or null when there is none. */
  read(path: string): Promise<ArtFile | null>;
  /** Calls `listener` with the path of an image whose content changed; returns what stops it. */
  onChanged(listener: (path: string) => void): () => void;
}

/** The collections a canvas reads its map's rules from (conditions, resources, measurement). */
export interface CanvasCollections extends CollectionLookup {
  /** Settles once the collections can be read; until then a map reads as outside every collection. */
  ready(): Promise<void>;
  /** Calls `listener` with the id of a collection whose settings changed; returns what stops it. */
  onChanged(listener: (collectionId: string) => void): () => void;
}

/** What a token's menu works on. */
export interface TokenMenuCanvas {
  store: StoreApi<ViewAtlasState>;
  gridSystem: GridSystem;
  conditions: () => ConditionDefinition[];
  resources: () => readonly ResourceDefinition[];
}

/** Opens the menu of `token`, right-clicked at a point of the screen. */
export type TokenMenu = (token: TokenEntity, at: { x: number; y: number }) => void;

/** The settings a canvas reads. */
export interface CanvasSettings extends HotkeySettings {
  getLaserPointerSettings(): LaserPointerSettings;
}

/** What a canvas hands its lighting; the host adds what it needs of its own. */
export type CanvasLightingDeps = Omit<LightingControllerDeps, 'obsApp'>;

/** What a canvas hands its ambient audio; the host adds what it needs of its own. */
export type CanvasAudioDeps = Omit<AudioFeatureDeps, 'obsApp'>;

/**
 * What a canvas takes from the application around it: the GM's view in Obsidian or the
 * player client in a browser. The canvas itself knows neither Obsidian nor the GM's UI.
 */
export interface CanvasHost {
  readonly art: ArtSource;
  readonly collections: CanvasCollections;
  /** The settings, looked up anew on every read: a reload of the plugin replaces them. */
  settings(): CanvasSettings | undefined;
  /**
   * The token as its sprite shows it, with what the store does not hold (the GM's statblock
   * data); `resources` are its map's.
   */
  prepareToken(token: TokenEntity, resources: readonly ResourceDefinition[]): Promise<TokenEntity>;
  /** The menu a right-click on a token opens; none where the canvas offers none. */
  readonly tokenMenu?: (canvas: TokenMenuCanvas) => TokenMenu;
  /** Dynamic lighting, for a canvas that has it. */
  readonly lighting?: (deps: CanvasLightingDeps) => LightingFeature;
  /** Ambient audio, for a canvas that has it. */
  readonly audio?: (deps: CanvasAudioDeps) => AudioFeature;
}

import type { StoreApi } from 'zustand';
import type { RulesLookup } from '../gameSystems/mapRules';
import type { ResourceDefinition } from '../resources/resourceTypes';
import type { ViewAtlasState, ViewAtlasStore } from '../storeFactory';
import type { TokenEntity } from '../types';
import type { ConditionDefinition } from '../types/collectionSettingsTypes';
import type { GridSystem } from '../grid/GridSystem';
import type { LightingController, LightingControllerDeps } from '../pixi/lighting/LightingController';
import type { BelowLevelsHostDeps } from '../pixi/lighting/belowLevelsHost';
import type { LightingQualitySource } from '../lighting/lightingQuality';
import type { RoofHost } from '../pixi/lighting/levels/Roof';
import type { SceneLevel } from '../types/sceneLevelTypes';
import type { PinnedScene } from '../services/linkedSceneLevels';
import type { MapVideoPlaybackDeps } from '../pixi/mapImage/video/watchMapVideoPlayback';
import type { Application } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import type { EventEmitter } from 'events';
import type { AudioFeature, AudioFeatureDeps } from '../pixi/audio/AudioFeature';
import type { HotkeySettings } from '../keyboard/mapHotkeys';
import type { LaserPointerSettings } from '../tools/laserPointerSettings';
import type { PlayerTokenUISettings } from '../pixi/token-renderer/playerTokenUISettings';
import type { MapImage } from '../pixi/mapImage/MapImage';

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

/**
 * Where a canvas reads its map's rules (conditions, resources, measurement): the played campaign's
 * system, else the map's collection (`rulesForMap`), and the collections' own settings (rings).
 */
export interface CanvasCollections extends RulesLookup {
  /**
   * Calls `listener` whenever the rules of the map at `mapPath()` may have changed, also once the
   * collections can be read (until then a map reads as outside every collection); returns what stops it.
   */
  onRulesChanged(mapPath: () => string | null | undefined, listener: () => void): () => void;
}

/** What a token's menu works on. */
export interface TokenMenuCanvas {
  store: StoreApi<ViewAtlasState>;
  gridSystem: GridSystem;
  conditions: () => ConditionDefinition[];
  resources: () => readonly ResourceDefinition[];
  /** The canvas element: popovers the menu opens are placed against it. */
  anchorEl: () => HTMLElement;
}

/** Opens the menu of `token`, right-clicked at a point of the screen. */
export type TokenMenu = (token: TokenEntity, at: { x: number; y: number }) => void;

/** The settings a canvas reads. */
export interface CanvasSettings extends HotkeySettings {
  getLaserPointerSettings(): LaserPointerSettings;
  /** The local player window's settings, where the canvas shows the players' view as that window would. */
  getLocalPlayerViewSettings?(): { showInitiative?: boolean } | undefined;
  /** Calls `listener` on every change of the settings; returns what stops it. */
  onChange?(listener: () => void): () => void;
}

/**
 * The player at a canvas that shows them the scene. A GM's canvas has none: the GM acts on every
 * token, and a canvas that only shows players the scene (the local player window) on none.
 */
export interface CanvasPlayer {
  /** Whether the player may move and rotate `token`, and change its resources and conditions. */
  controls(token: TokenEntity): boolean;
  /** What the DM shows players of each token's UI (names); read on every draw. */
  tokenUI(): PlayerTokenUISettings;
}

/** What a canvas hands its lighting; the host adds what it needs of its own. */
export type CanvasLightingDeps = Omit<LightingControllerDeps, 'obsApp' | 'quality' | 'below'> & {
  /** What the levels below the view need of it; the host adds how it reads their images. */
  below: Omit<BelowLevelsHostDeps, 'obsApp'>;
};

/** What decides whether a canvas's animated map plays, besides the canvas and its scene. */
export interface CanvasMapVideo {
  /** Whether a players' picture of `store`'s scene is being shown (the local player window). */
  playersSee(store: ViewAtlasStore): boolean;
  /** Calls `listener` when that may have changed; returns what stops it. */
  onPlayersChange(listener: () => void): () => void;
  /** The setting that switches animated maps off, if the host has one. */
  animate(): MapVideoPlaybackDeps['animate'];
}

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
  /** The player at this canvas, for a canvas where a player acts on the scene. */
  readonly player?: CanvasPlayer;
  /**
   * The menu a right-click on a token opens; none where the canvas offers none. A player's opens
   * when the button is released in place, so a right-drag over a token still pans.
   */
  readonly tokenMenu?: (canvas: TokenMenuCanvas) => TokenMenu;
  /** Dynamic lighting, for a canvas that has it. */
  readonly lighting?: (deps: CanvasLightingDeps) => LightingController;
  /** How much the lighting and the liquids may ask of the device, where the host has a setting for it. */
  readonly lightingQuality?: () => LightingQualitySource | undefined;
  /** How the roofs of a scene's levels are read, for a canvas that draws them. */
  readonly roofHost?: (app: Application, viewport: Viewport) => RoofHost;
  /** The levels of the scene a pin's note links to, for a canvas that offers them. */
  readonly linkedSceneLevels?: (from: PinnedScene, link: string) => Promise<readonly SceneLevel[] | null>;
  /** Calls `stop` when the view `viewId` stops being the one in use (another tab, a closed view); returns what stops it. */
  readonly onLeavingView?: (eventBus: EventEmitter, viewId: string, stop: () => void) => () => void;
  /** When an animated map plays, for a canvas that knows about other pictures of its scene. */
  readonly mapVideo?: CanvasMapVideo;
  /** Ambient audio, for a canvas that has it. */
  readonly audio?: (deps: CanvasAudioDeps) => AudioFeature;
  /**
   * Shows the store's background in `mapImage` whenever it changes outside a load (an undo of a
   * background change), for a canvas that reads its scene's images itself; returns what stops it.
   */
  readonly followBackground?: (store: ViewAtlasStore, mapImage: MapImage) => () => void;
}

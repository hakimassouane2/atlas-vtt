import type { Application, Texture } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { PixiAppManager } from '../../pixi/PixiAppManager';
import { PixiRendererOrchestrator } from '../../PixiRendererOrchestrator';
import { applyNavigationMode } from '../../pixi/viewportNavigation';
import { backgroundTextureCache } from '../../pixi/backgroundTextureCache';
import { centerAndFitMap, mapPlaceholderTexture, showMapImage } from '../../pixi/mapDisplay';
import { createSceneStore, type ViewAtlasStore } from '../../storeFactory';
import { getHistoryStore } from '../../stores/history';
import type { AtlasSettings } from '../../services/SettingsService';
import type { CanvasHost, CanvasPlayer } from '../../canvas/canvasHost';
import type { PlayerCommand } from '../playerCommands';
import { sceneOf, withSceneChanges, type ReplicatedScene, type SceneChange } from '../scene/sceneReplica';
import { sceneImageUrl } from './session';
import { CommandBridge } from './commandBridge';
// `vite/player-client.mts` makes this PIXI's emitter in the browser
import { EventEmitter } from 'events';

type PlayerView = AtlasSettings['localPlayerView'];

/**
 * Atlas' own canvas on a player's page. It shows the scene the DM's Atlas sends as players see
 * it (the store is a player view: hidden tokens left out, the fog's full cover, no pins; the grid
 * only where the DM shows players the grid), and lets the player act on their own tokens as the
 * GM acts on any: what they change goes to the DM's Atlas as commands (`CommandBridge`).
 */
export class PlayerCanvas {
  readonly store: ViewAtlasStore;
  private readonly eventBus = new EventEmitter();
  private readonly manager: PixiAppManager;
  private readonly renderer: PixiRendererOrchestrator;
  private readonly bridge: CommandBridge;
  /** The scene as the DM's Atlas last sent it, kept up to date while a map image loads. */
  private scene: ReplicatedScene | null = null;
  private playerView: PlayerView | null = null;
  /** The map image held for the scene shown. */
  private backgroundUrl: string | null = null;
  /** Bumped by every scene shown: a map image that arrives for an older one is let go. */
  private loads = 0;
  /** The grid last shown, kept while the scene's grid and the player view are the same: renderers redraw on a new one. */
  private shownGrid: { source: ReplicatedScene['grid']; showGrid: boolean; grid: ReplicatedScene['grid'] } | null = null;

  constructor(host: CanvasHost & { player: CanvasPlayer }, send: (command: PlayerCommand) => Promise<boolean>) {
    this.store = createSceneStore('online-player', { isPlayerView: true });
    this.store.getState().setPersistenceEnabled(false);
    // The DM's Atlas decides the scene: nothing here is an undo step
    getHistoryStore(this.store)?.getState().pause();
    this.manager = new PixiAppManager(window.innerWidth, window.innerHeight);
    this.renderer = new PixiRendererOrchestrator(host, this.manager, this.eventBus, this.store, 'online-player');
    this.bridge = new CommandBridge(this.store, (token) => host.player.controls(token), send, () => this.resync());
  }

  async mount(container: HTMLElement): Promise<void> {
    await this.renderer.init(container);
    const viewport = this.renderer.getViewportInstance();
    if (viewport) applyNavigationMode(viewport, 'mouse');
  }

  /** The PIXI application the canvas draws with. */
  get app(): Application {
    return this.renderer.getAppInstance();
  }

  /** The canvas's camera. */
  get viewport(): Viewport | null {
    return this.renderer.getViewportInstance();
  }

  resize(width: number, height: number): void {
    this.renderer.resize(width, height);
  }

  /** What the DM shows players: the grid, names. */
  setPlayerView(settings: PlayerView): void {
    this.playerView = settings;
    if (!this.scene || this.store.getState().isMapLoading) return;
    const { grid, tokenSettings } = this.shown(this.scene);
    // A copy of the token settings redraws every token's UI with the names now shown or hidden
    this.bridge.applyRemote(() => this.store.setState({ grid, tokenSettings: { ...tokenSettings } }));
  }

  /** Shows `scene` whole: a scene presented or loaded anew. */
  async showScene(scene: ReplicatedScene): Promise<void> {
    const isNewMap = scene.mapPath !== this.scene?.mapPath;
    this.scene = scene;
    const load = ++this.loads;
    this.bridge.applyRemote(() => {
      const state = this.store.getState();
      state.setMapLoading(true);
      state.setMapLoaded(false);
      state.clearSelection();
      state.clearMapState();
    });

    const { texture, url } = await this.mapImage(scene);
    if (load !== this.loads) {
      if (url) backgroundTextureCache.release(url);
      return;
    }
    if (this.backgroundUrl) backgroundTextureCache.release(this.backgroundUrl);
    this.backgroundUrl = url;

    const sprite = showMapImage(this.renderer, texture, scene.grid);
    if (isNewMap) centerAndFitMap(this.renderer, sprite);
    this.bridge.applyRemote(() => this.store.setState(this.shown(this.scene!)));
    this.eventBus.emit('map-loaded');
    await new Promise<void>((resolve) => this.eventBus.emit('wait-for-tokens-loaded', resolve));
    if (load !== this.loads) return;
    this.bridge.applyRemote(() => {
      this.store.getState().setMapLoading(false);
      this.store.getState().setMapLoaded(true);
    });
  }

  /** Applies what changed in the scene since it was sent. */
  applyChanges(changes: readonly SceneChange[]): void {
    if (!this.scene) return;
    this.scene = withSceneChanges(this.scene, changes);
    // A map image still loading shows the latest scene once it is there
    this.resync();
  }

  destroy(): void {
    this.bridge.destroy();
    this.renderer.destroy();
    if (this.backgroundUrl) backgroundTextureCache.release(this.backgroundUrl);
  }

  /** Shows the scene as the DM's Atlas sent it last, as after its changes or a refused command. */
  private resync(): void {
    if (this.scene && !this.store.getState().isMapLoading) this.bridge.applyRemote(() => this.store.setState(this.shown(this.scene!)));
  }

  /**
   * The store's state for `scene`: the grid only where the DM shows players the grid, and the
   * tokens the player holds where the pointer has them, not where the DM's Atlas last heard of them.
   */
  private shown(scene: ReplicatedScene): ReplicatedScene {
    const grid = this.playerGrid(scene.grid);
    const { heldTokens, objects } = this.store.getState();
    const held = Object.keys(heldTokens).filter((id) => objects.tokens[id] && scene.objects.tokens[id]);
    if (held.length === 0) return { ...sceneOf(scene), grid };
    const tokens = { ...scene.objects.tokens };
    for (const id of held) tokens[id] = objects.tokens[id]!;
    return { ...sceneOf(scene), grid, objects: { ...scene.objects, tokens } };
  }

  /** The scene's grid, shown only where the DM shows players the grid. */
  private playerGrid(source: ReplicatedScene['grid']): ReplicatedScene['grid'] {
    const showGrid = this.playerView?.showGrid ?? false;
    if (!source) return source;
    if (this.shownGrid?.source !== source || this.shownGrid.showGrid !== showGrid) {
      this.shownGrid = { source, showGrid, grid: { ...source, visible: source.visible !== false && showGrid } };
    }
    return this.shownGrid.grid;
  }

  /** The scene's map image and the URL it is held under, or a placeholder held under none. */
  private async mapImage(scene: ReplicatedScene): Promise<{ texture: Texture; url: string | null }> {
    if (scene.background) {
      const url = sceneImageUrl(scene.background);
      try {
        return { texture: await backgroundTextureCache.acquire(url), url };
      } catch (error) {
        console.error('[PlayerCanvas] Could not load the map image:', error);
      }
    }
    return { texture: mapPlaceholderTexture(scene.grid?.size || 70), url: null };
  }
}

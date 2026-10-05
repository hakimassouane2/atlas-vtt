import type { Application, Texture } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { PixiAppManager } from '../../pixi/PixiAppManager';
import { PixiRendererOrchestrator } from '../../PixiRendererOrchestrator';
import { applyNavigationMode } from '../../pixi/viewportNavigation';
import { backgroundTextureCache } from '../../pixi/backgroundTextureCache';
import { centerAndFitMap, mapPlaceholderTexture, showMapImage } from '../../pixi/mapDisplay';
import { requestRender, setBeforeRender } from '../../pixi/RenderScheduler';
import { setLayerVisibility } from '../../pixi/playerSafeFrame';
import { createSceneStore, type ViewAtlasStore } from '../../storeFactory';
import { getHistoryStore } from '../../stores/history';
import type { AtlasSettings } from '../../services/SettingsService';
import type { CanvasHost } from '../../canvas/canvasHost';
import { sceneOf, withSceneChanges, type ReplicatedScene, type SceneChange } from '../scene/sceneReplica';
import { sceneImageUrl } from '../client/session';
// `vite/player-client.mts` makes this PIXI's emitter in the browser
import { EventEmitter } from 'events';

/**
 * Atlas' own canvas on a player's page, showing the scene the DM's Atlas sends as the players'
 * view of it: the store is a player view (hidden tokens, the fog's full cover, no pins), and the
 * layers players may not see are hidden as in the local player window (`getPlayerViewLayers`).
 */
export class PlayerCanvas {
  readonly store: ViewAtlasStore;
  private readonly eventBus = new EventEmitter();
  private readonly manager: PixiAppManager;
  private readonly renderer: PixiRendererOrchestrator;
  /** The scene as last sent, kept up to date while a map image loads. */
  private scene: ReplicatedScene | null = null;
  private playerView: AtlasSettings['localPlayerView'] | null = null;
  /** The map image held for the scene shown. */
  private backgroundUrl: string | null = null;
  /** Bumped by every scene shown: a map image that arrives for an older one is let go. */
  private loads = 0;
  private stopLayers: () => void = () => undefined;

  constructor(host: CanvasHost) {
    this.store = createSceneStore('online-player', { isPlayerView: true });
    this.store.getState().setPersistenceEnabled(false);
    // The DM's Atlas decides the scene: nothing here is an undo step
    getHistoryStore(this.store)?.getState().pause();
    this.manager = new PixiAppManager(window.innerWidth, window.innerHeight);
    this.renderer = new PixiRendererOrchestrator(host, this.manager, this.eventBus, this.store, 'online-player');
  }

  async mount(container: HTMLElement): Promise<void> {
    await this.renderer.init(container);
    const viewport = this.renderer.getViewportInstance();
    if (viewport) applyNavigationMode(viewport, 'mouse');
    const app = this.renderer.getAppInstance();
    this.stopLayers = setBeforeRender(app, () => {
      if (this.playerView) setLayerVisibility(this.renderer.getPlayerViewLayers(this.playerView));
    });
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
  setPlayerView(settings: AtlasSettings['localPlayerView']): void {
    this.playerView = settings;
    requestRender(this.renderer.getAppInstance());
  }

  /** Shows `scene` whole: a scene presented or loaded anew. */
  async showScene(scene: ReplicatedScene): Promise<void> {
    const isNewMap = scene.mapPath !== this.scene?.mapPath;
    this.scene = scene;
    const load = ++this.loads;
    const state = this.store.getState();
    state.setMapLoading(true);
    state.setMapLoaded(false);
    state.clearMapState();

    const { texture, url } = await this.mapImage(scene);
    if (load !== this.loads) {
      if (url) backgroundTextureCache.release(url);
      return;
    }
    if (this.backgroundUrl) backgroundTextureCache.release(this.backgroundUrl);
    this.backgroundUrl = url;

    const sprite = showMapImage(this.renderer, texture, this.scene.grid);
    if (isNewMap) centerAndFitMap(this.renderer, sprite);
    this.store.setState(sceneOf(this.scene));
    this.eventBus.emit('map-loaded');
    await new Promise<void>((resolve) => this.eventBus.emit('wait-for-tokens-loaded', resolve));
    if (load !== this.loads) return;
    this.store.getState().setMapLoading(false);
    this.store.getState().setMapLoaded(true);
  }

  /** Applies what changed in the scene since it was sent. */
  applyChanges(changes: readonly SceneChange[]): void {
    if (!this.scene) return;
    this.scene = withSceneChanges(this.scene, changes);
    // A map image still loading shows the latest scene once it is there
    if (!this.store.getState().isMapLoading) this.store.setState(sceneOf(this.scene));
  }

  destroy(): void {
    this.stopLayers();
    this.renderer.destroy();
    if (this.backgroundUrl) backgroundTextureCache.release(this.backgroundUrl);
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

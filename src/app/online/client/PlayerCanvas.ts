import type { Application } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { PixiAppManager } from '../../pixi/PixiAppManager';
import { PixiRendererOrchestrator } from '../../PixiRendererOrchestrator';
import { applyNavigationMode } from '../../pixi/viewportNavigation';
import { showMapGrid, viewMapImageDeps } from '../../pixi/mapDisplay';
import { MapImage } from '../../pixi/mapImage/MapImage';
import { fitMapRect } from '../../pixi/fitMapRect';
import { readMapStretch } from '../../grid/mapStretch';
import { captureSceneTransition, type SceneTransition } from '../../pixi/sceneTransition';
import { createSceneStore, type ViewAtlasStore } from '../../storeFactory';
import { getHistoryStore } from '../../stores/history';
import type { AtlasSettings, NavigationInputMode } from '../../services/SettingsService';
import type { CanvasHost, CanvasPlayer } from '../../canvas/canvasHost';
import type { PlayerCommand } from '../playerCommands';
import { sceneOf, withSceneChanges, type ReplicatedScene, type SceneChange } from '../scene/sceneReplica';
import { PageMapImages } from './pageMapImages';
import { CommandBridge } from './commandBridge';
// `vite/player-client.mts` makes this PIXI's emitter in the browser
import { EventEmitter } from 'events';

type PlayerView = AtlasSettings['localPlayerView'];

/**
 * Atlas' own canvas on a player's page. It shows the scene the DM's Atlas sends as players see
 * it (the store is a player view: hidden tokens left out, the fog's full cover, no pins), and lets the player act on their own tokens as the
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
  /** Opens the scenes' map images from the DM's Atlas. */
  private readonly images = new PageMapImages();
  /** The canvas's map image, made on the first scene shown. */
  private mapImage: MapImage | null = null;
  /** Bumped by every scene shown: a map image that arrives for an older one is let go. */
  private loads = 0;
  /** The previous map's last frame, held over the canvas while the next map loads. */
  private pendingTransition: SceneTransition | null = null;
  /** The previous map's frame, still fading out over the next one. */
  private fadingTransition: SceneTransition | null = null;

  constructor(host: CanvasHost & { player: CanvasPlayer }, send: (command: PlayerCommand) => Promise<boolean>) {
    this.store = createSceneStore('online-player', { isPlayerView: true });
    this.store.getState().setPersistenceEnabled(false);
    // The DM's Atlas decides the scene: nothing here is an undo step
    getHistoryStore(this.store)?.getState().pause();
    this.manager = new PixiAppManager(window.innerWidth, window.innerHeight);
    this.renderer = new PixiRendererOrchestrator(host, this.manager, this.eventBus, this.store, 'online-player');
    this.bridge = new CommandBridge(this.store, (token) => host.player.controls(token), send, () => this.resync());
  }

  async mount(container: HTMLElement, inputDevice: NavigationInputMode): Promise<void> {
    await this.renderer.init(container);
    this.setInputDevice(inputDevice);
  }

  /** Zooms and pans as the player's device expects: wheel zoom for a mouse, scroll and pinch for a trackpad. */
  setInputDevice(mode: NavigationInputMode): void {
    const viewport = this.renderer.getViewportInstance();
    if (viewport) applyNavigationMode(viewport, mode);
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

  /** What the DM shows players: names. */
  setPlayerView(settings: PlayerView): void {
    this.playerView = settings;
    if (!this.scene || this.store.getState().isMapLoading) return;
    const { tokenSettings } = this.shown(this.scene);
    // A copy of the token settings redraws every token's UI with the names now shown or hidden
    this.bridge.applyRemote(() => this.store.setState({ tokenSettings: { ...tokenSettings } }));
  }

  /** Redraws every token's UI: the player became another profile, which may see other tokens' resources. */
  refreshTokenUI(): void {
    if (this.playerView) this.setPlayerView(this.playerView);
  }

  /** Shows `scene` whole: a scene the DM opened, or loaded anew. */
  async showScene(scene: ReplicatedScene): Promise<void> {
    const isNewMap = scene.mapPath !== this.scene?.mapPath;
    // Another map: players keep seeing the one they had until it is drawn, then it fades into it
    if (isNewMap && !this.pendingTransition && this.store.getState().mapLoaded) {
      this.pendingTransition = captureSceneTransition(this.app, this.fadingTransition);
      this.fadingTransition = null;
    }
    this.scene = scene;
    const load = ++this.loads;
    this.bridge.applyRemote(() => {
      const state = this.store.getState();
      state.setMapLoading(true);
      state.setMapLoaded(false);
      state.clearSelection();
      state.clearMapState();
    });

    const mapImage = this.viewMapImage();
    if (mapImage) {
      await mapImage.load(this.images.sourceFor(scene.background, scene.grid?.size), readMapStretch(scene.grid?.mapStretch));
      if (load !== this.loads) return;
      showMapGrid(this.renderer, mapImage, scene.grid);
      const viewport = this.renderer.getViewportInstance();
      if (isNewMap && viewport && mapImage.worldRect) fitMapRect(viewport, mapImage.worldRect);
    }
    this.bridge.applyRemote(() => this.store.setState(this.shown(this.scene!)));
    this.eventBus.emit('map-loaded');
    await new Promise<void>((resolve) => this.eventBus.emit('wait-for-tokens-loaded', resolve));
    if (load !== this.loads) return;
    this.bridge.applyRemote(() => {
      this.store.getState().setMapLoading(false);
      this.store.getState().setMapLoaded(true);
    });
    this.pendingTransition?.play();
    this.fadingTransition = this.pendingTransition;
    this.pendingTransition = null;
  }

  /** The DM has no scene open: the canvas shows none until they open one. */
  clearScene(): void {
    this.loads++;
    this.scene = null;
    this.pendingTransition?.cancel();
    this.fadingTransition?.cancel();
    this.pendingTransition = null;
    this.fadingTransition = null;
    this.bridge.applyRemote(() => {
      const state = this.store.getState();
      state.clearSelection();
      state.clearMapState();
      state.setMapLoading(false);
      state.setMapLoaded(false);
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
    this.pendingTransition?.cancel();
    this.fadingTransition?.cancel();
    this.bridge.destroy();
    this.renderer.destroy();
    this.images.dispose();
  }

  /** Shows the scene as the DM's Atlas sent it last, as after its changes or a refused command. */
  private resync(): void {
    if (this.scene && !this.store.getState().isMapLoading) this.bridge.applyRemote(() => this.store.setState(this.shown(this.scene!)));
  }

  /**
   * The store's state for `scene`: the tokens the player holds where the pointer has them, not
   * where the DM's Atlas last heard of them.
   */
  private shown(scene: ReplicatedScene): ReplicatedScene {
    const { heldTokens, objects } = this.store.getState();
    const held = Object.keys(heldTokens).filter((id) => objects.tokens[id] && scene.objects.tokens[id]);
    if (held.length === 0) return sceneOf(scene);
    const tokens = { ...scene.objects.tokens };
    for (const id of held) tokens[id] = objects.tokens[id]!;
    return { ...sceneOf(scene), objects: { ...scene.objects, tokens } };
  }

  /** The canvas's map image, made and handed to the renderer the first time; null without a viewport. */
  private viewMapImage(): MapImage | null {
    if (this.mapImage) return this.mapImage;
    const deps = viewMapImageDeps(this.renderer, this.images);
    if (!deps) return null;
    this.mapImage = new MapImage(deps);
    this.renderer.setMapImage(this.mapImage);
    return this.mapImage;
  }
}

import { App, Notice } from 'obsidian';
import type { ViewAtlasState } from '../storeFactory';
import type { StoreApi } from 'zustand';
import type { SettingsService } from './SettingsService';
import { playerWindowStore, resetPlayerWindowStore } from '../stores/playerWindowStore';
import './player-window.scss';
import { PlayerInitiativePanel } from './PlayerInitiativePanel';
import { mapInitiativeCollection } from './mapInitiativeCollection';
import type { PlayerOverlay } from './PlayerSceneOverlay';
import { PlayerDiceRolls } from './PlayerDiceRolls';
import { PlayerWidgetBar } from './PlayerWidgetBar';
import { LocalPlayerView, LOCAL_PLAYER_VIEW_TYPE, type PlayerCameraState } from '../local-player-view';
import { freezeCanvasFrame, type SceneTransition } from '../pixi/sceneTransition';
import { t } from '../i18n';
import { PlayerFrameMirror, showsScene, type PlayerFrameSource } from './PlayerFrameMirror';

/** Scopes the rules in `player-window.scss` to the popout document. */
const PLAYER_WINDOW_BODY_CLASS = 'atlas-player-window';
/** Set once frames are being mirrored: swaps the loading message for the canvas. */
const PLAYER_WINDOW_LIVE_CLASS = 'atlas-player-window--live';

/** Identifies a stylesheet node so the same sheet is not added to the popout twice. */
function getStyleNodeKey(node: Element): string {
  return node.instanceOf(HTMLLinkElement) ? `link:${node.href}` : `style:${node.textContent ?? ''}`;
}

/**
 * Mirrors a DM map canvas into a popout window for players.
 *
 * The window follows the DM: it shows the scene of the Atlas view's active tab
 * (`followedScene`), holds the last frame while a scene loads and crossfades into the
 * next one. With no scene open it keeps the last frame under the waiting message.
 * A camera freeze only pins the camera: the scene keeps updating (tokens, fog)
 * while the DM pans and zooms their own view.
 */
export class PlayerWindowService {
  private playerWindow: Window | null = null;
  private playerView: LocalPlayerView | null = null;
  private app: App;
  private store: StoreApi<ViewAtlasState>;
  private settingsService: SettingsService;
  private streamSource: PlayerFrameSource | null = null;
  private animationFrame: number | null = null;
  /** Camera the DM froze players on; the presented scene is still rendered live through it. */
  private frozenCamera: PlayerCameraState | null = null;
  /** Last player frame, shown unchanged while no scene is open. */
  private heldFrame: HTMLCanvasElement | null = null;
  /** Crossfade from the previous map, still playing after the DM opened another scene. */
  private mapTransition: SceneTransition | null = null;
  /** The map players see, and what stops watching its store for the next one. */
  private shownMapPath: string | null = null;
  private stopWatchingScene: (() => void) | null = null;
  private static instance: PlayerWindowService | null = null;
  private settingsUnsubscribe: (() => void) | null = null;
  /** Widget bar, initiative panel and dice rolls, drawn over the presented scene. */
  private sceneOverlays: PlayerOverlay[] = [];
  private readonly boundHandleWindowResize = (): void => {
    this.handleWindowResize();
  };
  private readonly boundHandleBeforeUnload = (): void => {
    this.cleanup(false);
  };
  private isCleaningUp = false;
  /** Copies the presented canvas into the window; exists while frames are being mirrored. */
  private mirror: PlayerFrameMirror | null = null;
  /** Identifies the running copy loop; a newer loop ends older ones. */
  private mirrorLoopId = 0;

  constructor(app: App, store: StoreApi<ViewAtlasState>, settingsService: SettingsService) {
    this.app = app;
    this.store = store;
    this.settingsService = settingsService;
    PlayerWindowService.instance = this;
  }

  public static getInstance(): PlayerWindowService | null {
    return PlayerWindowService.instance;
  }

  /** Toggle the DM's camera freeze and return the new frozen state. */
  public toggleCameraFreeze(): boolean {
    if (this.frozenCamera) {
      this.setFrozenCamera(null);
    } else {
      this.freezeCamera();
    }
    new Notice(this.isFrozen() ? t('player.frozen') : t('player.unfrozen'));
    return this.isFrozen();
  }

  /**
   * Keep players on `camera`, by default the camera they currently see. Map
   * changes stay visible; only the DM's panning and zooming no longer reach them.
   */
  public freezeCamera(camera?: PlayerCameraState): void {
    this.setFrozenCamera(camera ?? this.playerView?.getState().camera ?? this.streamSource?.getCamera?.() ?? null);
  }

  public isFrozen(): boolean {
    return this.frozenCamera !== null;
  }

  public isWindowOpen(): boolean {
    return this.playerWindow !== null && !this.playerWindow.closed;
  }

  /** The open popout window, or null when there is none. */
  public getWindow(): Window | null {
    return this.isWindowOpen() ? this.playerWindow : null;
  }

  /**
   * Show the scene players follow, already rendered into `source`; with none, keep the last
   * frame under the waiting message until a scene opens again.
   */
  public follow(source: PlayerFrameSource | null): void {
    if (!this.isWindowOpen() || source === this.streamSource) return;
    if (!source) {
      this.letGoOfScene();
      return;
    }
    this.crossfadeToNextMap();
    this.streamSource = source;
    this.mirror?.markStale();
    this.watchScene();
    this.presentScene();
    this.heldFrame = null;
    this.setFrozenCamera(null);
    this.setLive(true);
    this.followSource();
  }

  /** Keep players on the last frame and let go of the map view, which is closing. */
  private letGoOfScene(): void {
    this.sceneOverlays.forEach((overlay) => overlay.hold());
    this.heldFrame ??= this.snapshotPlayerFrame();
    const heldFrame = this.heldFrame ?? createEl('canvas');
    this.streamSource = { canvas: heldFrame, withPlayerSafeFrame: (capture) => capture() };
    this.watchScene();
    this.setLive(false);
    this.followSource();
  }

  /**
   * Point the mirror at the new `streamSource` now. The window's next display frame, which
   * would do it, never comes while the window is hidden, and the previous view would stay referenced.
   */
  private followSource(): void {
    this.mirror?.frame();
  }

  /**
   * Crossfade into each new map the source's store loads. The mirror holds the last frame while
   * it loads, so the window still shows the previous map when the load ends. A camera frozen on
   * the previous map means nothing on the next one, so it is lifted.
   */
  private watchScene(): void {
    this.stopWatchingScene?.();
    this.stopWatchingScene = null;
    const store = this.streamSource?.store;
    this.shownMapPath = store?.getState().mapPath ?? null;
    if (!store) return;
    this.stopWatchingScene = store.subscribe((state, previous) => {
      if (!showsScene(state) || showsScene(previous) || state.mapPath === this.shownMapPath) return;
      this.shownMapPath = state.mapPath;
      this.crossfadeToNextMap();
      this.setFrozenCamera(null);
    });
  }

  private setLive(live: boolean): void {
    this.playerWindow?.document.body.classList.toggle(PLAYER_WINDOW_LIVE_CLASS, live);
  }

  /** Opens a player window mirroring `source`, the scene players follow. */
  public async openPlayerWindow(source: PlayerFrameSource): Promise<void> {
    const leaf = this.app.workspace.getLeavesOfType(LOCAL_PLAYER_VIEW_TYPE)[0] ?? this.app.workspace.openPopoutLeaf();
    await leaf.setViewState({ type: LOCAL_PLAYER_VIEW_TYPE, state: { frozen: false } });
    if (leaf.view instanceof LocalPlayerView) this.attachToView(leaf.view, source);
  }

  public ownsView(view: LocalPlayerView): boolean {
    return this.playerView === view;
  }

  public attachToView(view: LocalPlayerView, source: PlayerFrameSource): void {
    this.playerView = view;
    this.playerWindow = view.contentEl.win;
    this.streamSource = source;
    this.mirror?.markStale();
    this.watchScene();
    // Bind now: the popout may still be loading, and the DM can switch scenes before it has
    this.destroySceneOverlays();
    this.sceneOverlays = [
      new PlayerWidgetBar(this.settingsService),
      new PlayerInitiativePanel(this.app, this.settingsService, mapInitiativeCollection(this.app)),
      new PlayerDiceRolls(this.app, this.settingsService),
    ];
    this.presentScene();
    this.setupPlayerWindow();
  }

  private setFrozenCamera(camera: PlayerCameraState | null): void {
    this.frozenCamera = camera ? { ...camera } : null;
    this.mirror?.markStale();
    this.updateFreezeIndicator();
    playerWindowStore.setState({ isFrozen: this.isFrozen() });
    this.playerView?.updateSession({ frozen: this.isFrozen(), ...(camera ? { camera: { ...camera } } : {}) });
  }

  private updateFreezeIndicator(): void {
    if (!this.playerWindow || this.playerWindow.closed) return;
    const indicator = this.playerWindow.document.getElementById('atlas-player-freeze-indicator');
    if (indicator) {
      indicator.style.display = this.frozenCamera || this.heldFrame ? 'flex' : 'none';
    }
  }

  /** Fades the frame players see into the next scene, the same transition the DM view plays. */
  private crossfadeToNextMap(): void {
    const targetCanvas = this.playerWindow?.document.getElementById('atlas-player-canvas');
    if (!targetCanvas?.instanceOf(HTMLCanvasElement)) return;
    // A 2D canvas keeps its pixels, so the frame on screen can be copied at any time.
    // The player canvas is drawn with crisp-edges, so players get the crossfade without the scale settle.
    this.mapTransition = freezeCanvasFrame(
      targetCanvas, (context) => context.drawImage(targetCanvas, 0, 0), this.mapTransition, { settle: false },
    );
    this.mapTransition?.play();
  }

  /** Copy the frame players currently see so it can be held while no scene is open. */
  private snapshotPlayerFrame(): HTMLCanvasElement | null {
    if (!this.streamSource || !this.playerWindow || this.playerWindow.closed) return null;

    const targetCanvas = this.playerWindow.document.getElementById('atlas-player-canvas') as HTMLCanvasElement | null;
    if (!targetCanvas) return null;

    // Never attached to a document: it is only a pixel buffer, so it can live in the
    // main window. drawImage works across windows, as the live mirroring relies on.
    const snapshot = createEl('canvas');
    snapshot.width = targetCanvas.width;
    snapshot.height = targetCanvas.height;
    snapshot.getContext('2d')?.drawImage(targetCanvas, 0, 0);
    return snapshot;
  }

  /**
   * Mirrors the main window's stylesheets into the popout by cloning the existing
   * `<link>`/`<style>` nodes, skipping the ones Obsidian already placed there.
   */
  private copyMainWindowStyles(doc: Document): void {
    const existing = new Set(
      Array.from(doc.head.querySelectorAll('link[rel="stylesheet"], style')).map(getStyleNodeKey),
    );
    document.head.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
      if (existing.has(getStyleNodeKey(node))) return;
      doc.head.appendChild(doc.importNode(node, true));
    });
  }

  /**
   * Sets up the player window after it's been opened
   */
  private setupPlayerWindow(): void {
    if (!this.playerWindow) return;

    try {
      const doc = this.playerWindow.document;
      
      // Wait for the popout window to be fully loaded
      if (doc.readyState !== 'complete') {
        this.playerWindow.addEventListener('load', () => {
          this.setupPlayerWindow();
        }, { once: true });
        return;
      }
      
      // Hide all Obsidian UI elements
      const body = doc.body;
      
      // Double-check we have the right window
      if (this.playerWindow === window) {
        console.error('[PlayerWindowService] ERROR: Player window is the same as main window!');
        new Notice(t('player.isMain'));
        return;
      }
      
      const content = this.playerView?.contentEl ?? body;
      content.empty();
      
      this.copyMainWindowStyles(doc);
      body.classList.add(PLAYER_WINDOW_BODY_CLASS);
      body.classList.remove(PLAYER_WINDOW_LIVE_CLASS);

      // Create our UI elements
      const loading = content.createDiv();
      loading.id = 'atlas-player-loading';
      loading.textContent = t('player.connecting');

      const canvas = content.createEl('canvas');
      canvas.id = 'atlas-player-canvas';

      this.sceneOverlays.forEach((overlay) => overlay.mount(content));
      this.settingsUnsubscribe?.();
      // Player view settings decide which layers players see
      // So do the collection's settings: which resources they see
      const collectionChanged = this.app.workspace.on('atlas-vtt:collection-settings-changed', () => {
        this.mirror?.markStale();
        this.sceneOverlays.forEach((overlay) => overlay.refresh?.());
      });
      const unsubscribeSettings = this.settingsService.onChange(() => this.mirror?.markStale());
      this.settingsUnsubscribe = () => {
        unsubscribeSettings();
        this.app.workspace.offref(collectionChanged);
      };

      // Create freeze indicator
      const freezeIndicator = content.createDiv();
      freezeIndicator.id = 'atlas-player-freeze-indicator';
      const freezeIcon = freezeIndicator.createSvg('svg', { attr: {
        width: 16,
        height: 16,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      } });
      freezeIcon.createSvg('line', { attr: { x1: 2, y1: 12, x2: 22, y2: 12 } });
      freezeIcon.createSvg('line', { attr: { x1: 12, y1: 2, x2: 12, y2: 22 } });
      freezeIcon.createSvg('path', { attr: { d: 'M20 16l-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4' } });
      freezeIndicator.createSpan({ text: t('player.paused') });
      freezeIndicator.style.display = this.frozenCamera || this.heldFrame ? 'flex' : 'none';
      
      // Create title bar container
      const titleBarContainer = content.createDiv();
      titleBarContainer.id = 'atlas-player-titlebar-container';
      
      // Create title bar for dragging
      const titleBar = titleBarContainer.createDiv();
      titleBar.id = 'atlas-player-titlebar';
      const titleBarText = titleBar.createDiv();
      titleBarText.id = 'atlas-player-titlebar-text';
      titleBarText.textContent = t('player.title');
      

      // Set window title
      doc.title = t('player.title');

      // Start mirroring
      this.startMirroring();
      playerWindowStore.setState({ isOpen: true });

      // Handle window resize
      this.playerWindow.addEventListener('resize', this.boundHandleWindowResize);

      // Cleanup on close
      this.playerWindow.addEventListener('beforeunload', this.boundHandleBeforeUnload);

    } catch (error) {
      console.error('[PlayerWindowService] Error setting up player window:', error);
      new Notice(t('player.setupFailed'));
    }
  }

  /** Bind the overlays to the view store that now holds the presented scene. */
  private presentScene(): void {
    const store = this.streamSource?.store ?? this.store;
    this.sceneOverlays.forEach((overlay) => overlay.present(store));
  }

  private destroySceneOverlays(): void {
    this.sceneOverlays.forEach((overlay) => overlay.destroy());
    this.sceneOverlays = [];
  }

  /**
   * Handle window resize
   */
  private handleWindowResize(): void {
    // No need to do anything - canvas maintains its aspect ratio with object-fit: contain
  }

  /**
   * Starts mirroring the canvas content
   */
  private startMirroring(): void {
    if (!this.playerWindow || !this.streamSource) return;

    const targetCanvas = this.playerWindow.document.getElementById('atlas-player-canvas') as HTMLCanvasElement;
    
    if (!targetCanvas) return;

    const targetCtx = targetCanvas.getContext('2d');
    if (!targetCtx) return;

    this.playerWindow.document.body.classList.add(PLAYER_WINDOW_LIVE_CLASS);

    const loopId = ++this.mirrorLoopId;
    this.mirror?.stop();
    const mirror = new PlayerFrameMirror(targetCanvas, targetCtx, {
      source: () => this.streamSource,
      heldFrame: () => this.heldFrame,
      frozenCamera: () => this.frozenCamera,
      settings: () => this.settingsService.getLocalPlayerViewSettings(),
      onFrame: (camera) => this.recordPlayerCamera(camera),
    });
    this.mirror = mirror;

    const copyCanvas = (): void => {
      if (loopId !== this.mirrorLoopId) return;
      if (!this.playerWindow || this.playerWindow.closed || !this.streamSource) {
        this.cleanup();
        return;
      }

      this.animationFrame = this.playerWindow.requestAnimationFrame(copyCanvas);
      mirror.frame();
    };

    // Start the copy loop
    copyCanvas();
  }

  /** Persist the camera players see so a restored window reopens on the same framing. */
  private recordPlayerCamera(camera: PlayerCameraState | undefined): void {
    const previous = this.playerView?.getState().camera;
    if (camera && (camera.centerX !== previous?.centerX || camera.centerY !== previous.centerY || camera.scale !== previous.scale)) {
      this.playerView?.updateSession({ camera });
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(closeWindow = true): void {
    if (this.isCleaningUp) {
      return;
    }

    this.isCleaningUp = true;
    this.mirrorLoopId++;
    this.mirror?.stop();
    this.mirror = null;

    if (this.animationFrame) {
      this.playerWindow?.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    this.settingsUnsubscribe?.();
    this.settingsUnsubscribe = null;
    this.stopWatchingScene?.();
    this.stopWatchingScene = null;
    this.destroySceneOverlays();
    this.mapTransition?.cancel();
    this.mapTransition = null;

    if (this.playerWindow) {
      this.playerWindow.removeEventListener('resize', this.boundHandleWindowResize);
      this.playerWindow.removeEventListener('beforeunload', this.boundHandleBeforeUnload);
    }
    
    if (closeWindow && this.playerWindow && !this.playerWindow.closed) {
      this.playerWindow.close();
    }
    
    this.playerWindow = null;
    this.playerView = null;
    this.streamSource = null;
    this.heldFrame = null;
    this.frozenCamera = null;
    resetPlayerWindowStore();
    // The window is gone: drop the singleton so the next present binds to the presenting view's store.
    if (PlayerWindowService.instance === this) {
      PlayerWindowService.instance = null;
    }
    this.isCleaningUp = false;
  }

  /**
   * Destroy the service
   */
  public destroy(closeWindow = true): void {
    this.cleanup(closeWindow);
  }
}

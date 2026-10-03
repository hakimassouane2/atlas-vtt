import { Notice, type App } from 'obsidian';
import playerClient from 'virtual:atlas-player-client';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { AtlasView } from '../atlas-view';
import type { PlayerFrameSource } from '../services/PlayerFrameMirror';
import type { SettingsService } from '../services/SettingsService';
import { OnlineFrameStream, type OnlineFrameSource } from './OnlineFrameStream';
import { OnlineSessionServer } from './OnlineSessionServer';
import { PlayerControls } from './PlayerControls';
import { PlayerDiceFeed } from './PlayerDiceFeed';
import { parseCameraRequest } from './playerStreamRequest';
import { tokenImage } from './tokenImage';
import { pageTheme } from './pageTheme';
import { sceneImagePaths } from './playerScene';
import { AssetService } from '../services/AssetService';
import { mapConditions } from '../services/mapConditions';
import { mapInitiativeRules } from '../services/mapInitiativeRules';
import { mapResources } from '../resources/collectionResources';
import type { Character } from '../types';

export interface OnlineSessionState {
  isRunning: boolean;
  /** Browsers currently connected with the player link. */
  playerCount: number;
  /** Players see through the DM's camera instead of their own. */
  isFollowingDm: boolean;
}

/** Read by the dashboard; one session per plugin, like the player window. */
export const onlineSessionStore: StoreApi<OnlineSessionState> = createStore<OnlineSessionState>(() => ({
  isRunning: false,
  playerCount: 0,
  isFollowingDm: false,
}));

/**
 * Lets players join from a browser with a link. The server runs on this computer;
 * players see the scene the DM presents, as the local player window shows it, through
 * their own camera unless the DM makes them follow theirs, move and heal the tokens the
 * DM gave them, follow the initiative order and roll dice.
 */
export class OnlineSession {
  private static instance: OnlineSession | null = null;
  private server: OnlineSessionServer | null = null;
  private readonly stream: OnlineFrameStream;
  private readonly controls: PlayerControls;
  private readonly diceFeed: PlayerDiceFeed;
  /** The view whose scene players see; its dice engine rolls for them. */
  private presentedView: AtlasView | null = null;
  /** Image files players may load: the artwork they see in the scene and in dice rolls. */
  private readonly visibleImages = new Set<string>();
  private stopWatchingTab: (() => void) | null = null;
  /** The presented scene tab; presenting another one recenters every player. */
  private presentedTabId: string | null = null;
  /** Views that already release the stream when they close. */
  private readonly viewsReleasingOnClose = new WeakSet<AtlasView>();

  constructor(private readonly app: App, private readonly settingsService: SettingsService) {
    this.stream = new OnlineFrameStream(settingsService, {
      isReady: (playerId) => this.server?.isReady(playerId) ?? false,
      send: (playerId, image, view, isDmCamera) => this.server?.sendFrame(playerId, image, view, isDmCamera),
    });
    this.controls = new PlayerControls(
      settingsService,
      (state) => {
        this.visibleImages.clear();
        sceneImagePaths(state.scene).forEach((path) => this.visibleImages.add(path));
        this.server?.share('state', state);
      },
      (formula, token) => this.rollForPlayer(formula, token),
    );
    this.diceFeed = new PlayerDiceFeed(
      settingsService,
      () => this.presentedView?.atlasStore.getState().objects.tokens,
      (roll) => {
        if (roll.source?.tokenImagePath) this.visibleImages.add(roll.source.tokenImagePath);
        this.server?.broadcast('roll', roll);
      },
    );
    OnlineSession.instance = this;
  }

  static getInstance(): OnlineSession | null {
    return OnlineSession.instance;
  }

  isRunning(): boolean {
    return this.server !== null;
  }

  /** Starts the server if needed and copies the player link. */
  async startAndCopyLink(): Promise<void> {
    if (!this.isRunning() && !(await this.start())) return;
    await navigator.clipboard.writeText(this.playerLink());
    const { publicHost } = this.settingsService.getOnlineSessionSettings();
    new Notice(publicHost
      ? 'Player link copied'
      : 'Player link copied. It only works on this computer until you set your public address in the Atlas settings.');
  }

  /** Makes every player see through the DM's camera, or lets them move their own again. */
  toggleFollowingDm(): void {
    const isFollowingDm = !onlineSessionStore.getState().isFollowingDm;
    onlineSessionStore.setState({ isFollowingDm });
    this.stream.setFollowingDm(isFollowingDm);
    this.server?.share('mode', { isFollowingDm });
    new Notice(isFollowingDm ? 'Online players follow your camera' : 'Online players move their own camera');
  }

  stop(): void {
    this.stopWatchingTab?.();
    this.presentedTabId = null;
    this.stream.setFollowingDm(false);
    this.stream.stop();
    this.controls.setSource(null);
    this.diceFeed.stop();
    this.presentedView = null;
    this.server?.close();
    this.server = null;
    onlineSessionStore.setState({ isRunning: false, playerCount: 0, isFollowingDm: false });
  }

  /**
   * Shows the scene tab `tabId` of `view`, already rendered into `source`, to online
   * players. They keep the last frame while the DM works on another tab.
   */
  present(view: AtlasView, tabId: string, source: PlayerFrameSource, resolveSource: () => Promise<PlayerFrameSource | null>): void {
    this.setSource(view, source);
    if (tabId !== this.presentedTabId) this.recenterAll();
    this.presentedTabId = tabId;
    this.presentedView = view;
    this.stopWatchingTab?.();
    const stopWatching = view.tabMetaStore.subscribe((state, previous) => {
      if (state.activeTabId === previous.activeTabId) return;
      if (state.activeTabId !== tabId) {
        this.hold();
        return;
      }
      void resolveSource().then((resumed) => {
        if (resumed && view.tabMetaStore.getState().activeTabId === tabId) this.setSource(view, resumed);
      });
    });
    this.stopWatchingTab = (): void => {
      stopWatching();
      this.stopWatchingTab = null;
    };
    if (!this.viewsReleasingOnClose.has(view)) {
      this.viewsReleasingOnClose.add(view);
      // Closing the presented map must not leave its renderer reachable from the stream
      view.register(() => {
        this.stopWatchingTab?.();
        this.stream.releaseSource(view.atlasStore);
        this.controls.releaseSource(view.atlasStore);
        if (this.presentedView === view) this.presentedView = null;
      });
    }
  }

  /** Streams the scene `source` shows, rendered by the map renderer of `view`. */
  private setSource(view: AtlasView, source: PlayerFrameSource): void {
    const renderer = view.serviceManager.getRendererService().getRenderer();
    if (!renderer || !source.store) return;
    const onlineSource: OnlineFrameSource = {
      store: source.store,
      renderer,
      getCamera: () => source.getCamera?.(),
      getConditions: () => mapConditions(AssetService.getInstance(view.app), source.store?.getState().mapPath),
      getResources: () => mapResources(AssetService.getInstance(view.app), source.store?.getState().mapPath),
      getInitiativeRules: () => mapInitiativeRules(view.app, source.store?.getState().mapPath),
    };
    this.stream.setSource(onlineSource);
    this.controls.setSource(onlineSource);
  }

  private rollForPlayer(formula: string, token: Character | undefined): boolean {
    const diceTool = this.presentedView?.serviceManager.getToolController().getDiceTool();
    if (!diceTool) return false;
    this.diceFeed.rollForPlayer(diceTool, formula, token);
    return true;
  }

  /** Players see the DM's framing again: their camera from another scene means nothing here. */
  private recenterAll(): void {
    this.stream.recenterAll();
    this.server?.broadcast('recenter', {});
  }

  /** Players keep the last frame and cannot act until the scene is live again. */
  private hold(): void {
    this.stream.hold();
    this.controls.setSource(null);
  }

  private async start(): Promise<boolean> {
    let settings = this.settingsService.getOnlineSessionSettings();
    if (!settings.secret) {
      this.settingsService.setOnlineSessionSettings({ secret: crypto.randomUUID().replace(/-/g, '') });
      settings = this.settingsService.getOnlineSessionSettings();
    }
    const server = new OnlineSessionServer(settings.secret, {
      onJoin: (playerId, request) => {
        this.stream.addViewer(playerId, request);
        onlineSessionStore.setState({ playerCount: server.playerCount });
      },
      onLeave: (playerId) => {
        this.stream.removeViewer(playerId);
        onlineSessionStore.setState({ playerCount: server.playerCount });
      },
      onCamera: (playerId, body) => {
        const camera = parseCameraRequest(body);
        if (camera) this.stream.setViewerCamera(playerId, camera === 'recenter' ? null : camera);
      },
      onCommand: (body) => this.controls.apply(body),
      onImage: (path) => (this.visibleImages.has(path) ? tokenImage(this.app, path) : Promise.resolve(null)),
      pageTheme: () => pageTheme(document),
    }, playerClient);
    server.share('mode', { isFollowingDm: onlineSessionStore.getState().isFollowingDm });
    try {
      await server.listen(settings.port);
    } catch (error) {
      console.error('[OnlineSession] Could not start the player server:', error);
      new Notice(`Could not open port ${settings.port} for players. Is another program using it?`);
      server.close();
      return false;
    }
    this.server = server;
    this.diceFeed.start();
    onlineSessionStore.setState({ isRunning: true, playerCount: 0 });
    return true;
  }

  private playerLink(): string {
    const { port, publicHost, secret } = this.settingsService.getOnlineSessionSettings();
    return `http://${publicHost.trim() || 'localhost'}:${port}/?k=${secret}`;
  }
}

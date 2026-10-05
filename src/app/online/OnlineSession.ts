import { Notice, type App } from 'obsidian';
import playerClient from 'virtual:atlas-player-client';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { AtlasView } from '../atlas-view';
import type { PlayerFrameSource } from '../services/PlayerFrameMirror';
import type { SettingsService } from '../services/SettingsService';
import type { ViewAtlasState } from '../storeFactory';
import { OnlineSessionServer } from './OnlineSessionServer';
import { PlayerControls, type CommandSource } from './PlayerControls';
import { PlayerDiceFeed } from './PlayerDiceFeed';
import { tokenImage } from './tokenImage';
import { pageTheme } from './pageTheme';
import { lanAddress } from './lanAddress';
import { AssetService } from '../services/AssetService';
import { mapConditions } from '../services/mapConditions';
import { mapInitiativeRules } from '../services/mapInitiativeRules';
import { mapResources } from '../resources/collectionResources';
import type { Character } from '../types';
import { SceneReplicator, type ReplicatedSource } from './scene/SceneReplicator';

export interface OnlineSessionState {
  isRunning: boolean;
  /** Browsers currently connected with the player link. */
  playerCount: number;
}

/** Read by the dashboard; one session per plugin, like the player window. */
export const onlineSessionStore: StoreApi<OnlineSessionState> = createStore<OnlineSessionState>(() => ({
  isRunning: false,
  playerCount: 0,
}));

/**
 * Lets players join from a browser with a link. The server runs on this computer; the player's
 * browser runs Atlas' own canvas on the scene the DM presents (ADR 0001), through their own camera.
 * Players move, turn and change the tokens the DM gave them, follow
 * the initiative order and roll dice.
 */
export class OnlineSession {
  private static instance: OnlineSession | null = null;
  private server: OnlineSessionServer | null = null;
  private readonly controls: PlayerControls;
  private readonly diceFeed: PlayerDiceFeed;
  /** Keeps the players' scenes in step with the presented one. */
  private readonly replicator: SceneReplicator;
  /** The view whose scene players see; its dice engine rolls for them. */
  private presentedView: AtlasView | null = null;
  /** Artwork of the rolls players were sent, which their pages load. */
  private readonly rollImages = new Set<string>();
  private stopWatchingTab: (() => void) | null = null;
  /** Views that already release the session when they close. */
  private readonly viewsReleasingOnClose = new WeakSet<AtlasView>();

  constructor(private readonly app: App, private readonly settingsService: SettingsService) {
    this.controls = new PlayerControls((formula, token) => this.rollForPlayer(formula, token));
    this.diceFeed = new PlayerDiceFeed(
      settingsService,
      () => this.presentedView?.atlasStore.getState().objects.tokens,
      (roll) => {
        if (roll.source?.tokenImagePath) this.rollImages.add(roll.source.tokenImagePath);
        this.server?.broadcast('roll', roll);
      },
    );
    this.replicator = new SceneReplicator(settingsService, {
      toAll: (event, data) => this.server?.broadcast(event, data),
      toPlayer: (playerId, event, data) => this.server?.sendTo(playerId, event, data),
    });
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
      : 'Player link copied. It works on your local network (same Wi-Fi); set your public address in the Atlas settings for players elsewhere.');
  }

  stop(): void {
    this.stopWatchingTab?.();
    this.setSource(null);
    this.diceFeed.stop();
    this.presentedView = null;
    this.server?.close();
    this.server = null;
    this.rollImages.clear();
    onlineSessionStore.setState({ isRunning: false, playerCount: 0 });
  }

  /**
   * Shows the scene tab `tabId` of `view`, whose canvas `source` draws, to online players. They
   * keep the scene they have while the DM works on another tab.
   */
  present(view: AtlasView, tabId: string, source: PlayerFrameSource, resolveSource: () => Promise<PlayerFrameSource | null>): void {
    this.setSource({ view, source });
    this.presentedView = view;
    this.stopWatchingTab?.();
    const stopWatching = view.tabMetaStore.subscribe((state, previous) => {
      if (state.activeTabId === previous.activeTabId) return;
      if (state.activeTabId !== tabId) {
        this.setSource(null);
        return;
      }
      void resolveSource().then((resumed) => {
        if (resumed && view.tabMetaStore.getState().activeTabId === tabId) this.setSource({ view, source: resumed });
      });
    });
    this.stopWatchingTab = (): void => {
      stopWatching();
      this.stopWatchingTab = null;
    };
    if (!this.viewsReleasingOnClose.has(view)) {
      this.viewsReleasingOnClose.add(view);
      // Closing the presented map must not leave its store reachable from the session
      view.register(() => {
        this.stopWatchingTab?.();
        this.controls.releaseSource(view.atlasStore);
        this.replicator.releaseSource(view.atlasStore);
        if (this.presentedView === view) this.presentedView = null;
      });
    }
  }

  /** Players act on and see the scene of `presented`; none while the DM works on another tab. */
  private setSource(presented: { view: AtlasView; source: PlayerFrameSource } | null): void {
    const store = presented?.source.store;
    if (!presented || !store) {
      this.controls.setSource(null);
      this.replicator.setSource(null);
      return;
    }
    const { view } = presented;
    this.controls.setSource(this.commandSource(view, store));
    this.replicator.setSource(this.replicatedSource(view, store));
  }

  private commandSource(view: AtlasView, store: StoreApi<ViewAtlasState>): CommandSource {
    const assets = AssetService.getInstance(view.app);
    return {
      store,
      grid: () => view.serviceManager.getRendererService().getRenderer()?.getGridSystem() ?? null,
      conditions: () => mapConditions(assets, store.getState().mapPath),
      resources: () => mapResources(assets, store.getState().mapPath),
    };
  }

  /** The scene of `store` for players' pages, with the collection whose rules it follows. */
  private replicatedSource(view: AtlasView, store: StoreApi<ViewAtlasState>): ReplicatedSource {
    const assets = AssetService.getInstance(view.app);
    return {
      store,
      collection: () => {
        const mapPath = store.getState().mapPath;
        const id = mapPath ? assets.getCollectionForMap(mapPath) : null;
        return id ? { id, settings: assets.getCollectionSettings(id) } : null;
      },
      initiativeRules: () => mapInitiativeRules(view.app, store.getState().mapPath),
      onCollectionChanged: (listener) => {
        const ref = view.app.workspace.on('atlas-vtt:collection-settings-changed', listener);
        return () => view.app.workspace.offref(ref);
      },
    };
  }

  private rollForPlayer(formula: string, token: Character | undefined): boolean {
    const diceTool = this.presentedView?.serviceManager.getToolController().getDiceTool();
    if (!diceTool) return false;
    this.diceFeed.rollForPlayer(diceTool, formula, token);
    return true;
  }

  private async start(): Promise<boolean> {
    let settings = this.settingsService.getOnlineSessionSettings();
    if (!settings.secret) {
      this.settingsService.setOnlineSessionSettings({ secret: crypto.randomUUID().replace(/-/g, '') });
      settings = this.settingsService.getOnlineSessionSettings();
    }
    const server = new OnlineSessionServer(settings.secret, {
      onJoin: (playerId) => {
        this.replicator.sendTo(playerId);
        onlineSessionStore.setState({ playerCount: server.playerCount });
      },
      onLeave: (playerId) => {
        this.controls.playerLeft(playerId);
        onlineSessionStore.setState({ playerCount: server.playerCount });
      },
      onCommand: (body, playerId) => this.controls.apply(body, playerId),
      onImage: (path) => (this.mayLoadImage(path) ? tokenImage(this.app, path) : Promise.resolve(null)),
      pageTheme: () => pageTheme(document),
    }, playerClient);
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

  /** Images players may load: those of the scene they were sent, and of the rolls they saw. */
  private mayLoadImage(path: string): boolean {
    return this.rollImages.has(path) || this.replicator.sentImages().has(path);
  }

  private playerLink(): string {
    const { port, publicHost, secret } = this.settingsService.getOnlineSessionSettings();
    // Without a public address, the link works on the local network, so a phone or tablet at the table can join
    return `http://${publicHost.trim() || lanAddress() || 'localhost'}:${port}/?k=${secret}`;
  }
}

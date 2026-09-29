import { Notice } from 'obsidian';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { AtlasView } from '../atlas-view';
import type { PlayerFrameSource } from '../services/PlayerWindowService';
import type { SettingsService } from '../services/SettingsService';
import { OnlineFrameStream, type OnlineFrameSource } from './OnlineFrameStream';
import { OnlineSessionServer } from './OnlineSessionServer';
import { PlayerControls } from './PlayerControls';

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
 * Lets players join from a browser with a link. The server runs on this computer;
 * players see the scene the DM presents, exactly as the local player window shows it,
 * and move and heal the tokens the DM gave them.
 */
export class OnlineSession {
  private static instance: OnlineSession | null = null;
  private server: OnlineSessionServer | null = null;
  private readonly stream: OnlineFrameStream;
  private readonly controls: PlayerControls;
  private stopWatchingTab: (() => void) | null = null;
  /** Views that already release the stream when they close. */
  private readonly viewsReleasingOnClose = new WeakSet<AtlasView>();

  constructor(private readonly settingsService: SettingsService) {
    this.stream = new OnlineFrameStream(settingsService, (image, view) => this.server?.publishFrame(image, view));
    this.controls = new PlayerControls((state) => this.server?.publishState(state));
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

  stop(): void {
    this.stopWatchingTab?.();
    this.stream.stop();
    this.controls.destroy();
    this.server?.close();
    this.server = null;
    onlineSessionStore.setState({ isRunning: false, playerCount: 0 });
  }

  /**
   * Shows the scene tab `tabId` of `view`, already rendered into `source`, to online
   * players. They keep the last frame while the DM works on another tab.
   */
  present(view: AtlasView, tabId: string, source: PlayerFrameSource, resolveSource: () => Promise<PlayerFrameSource | null>): void {
    this.setSource(view, source);
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
      getRenderedFrames: () => source.getRenderedFrames?.(),
    };
    this.stream.setSource(onlineSource);
    this.controls.setSource(onlineSource);
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
    const server = new OnlineSessionServer(settings.secret, (request, playerCount) => {
      onlineSessionStore.setState({ playerCount });
      this.stream.setRequest(request);
    }, (command) => this.controls.apply(command));
    try {
      await server.listen(settings.port);
    } catch (error) {
      console.error('[OnlineSession] Could not start the player server:', error);
      new Notice(`Could not open port ${settings.port} for players. Is another program using it?`);
      server.close();
      return false;
    }
    this.server = server;
    onlineSessionStore.setState({ isRunning: true, playerCount: 0 });
    return true;
  }

  private playerLink(): string {
    const { port, publicHost, secret } = this.settingsService.getOnlineSessionSettings();
    return `http://${publicHost.trim() || 'localhost'}:${port}/?k=${secret}`;
  }
}

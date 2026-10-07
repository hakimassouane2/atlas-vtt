import { Notice, type App, type EventRef } from 'obsidian';
import playerClient from 'virtual:atlas-player-client';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { AtlasView } from '../atlas-view';
import { followedScene, onFollowedScene, type FollowedScene } from '../services/followedScene';
import type { SettingsService } from '../services/SettingsService';
import type { ViewAtlasState } from '../storeFactory';
import { OnlineSessionServer } from './OnlineSessionServer';
import { PlayerControls, type CommandSource } from './PlayerControls';
import { PlayerDiceFeed } from './PlayerDiceFeed';
import { PlayerDiceLog } from './PlayerDiceLog';
import { tokenImage } from './tokenImage';
import { pageTheme } from './pageTheme';
import { lanAddress } from './lanAddress';
import { AssetService } from '../services/AssetService';
import { mapConditions } from '../services/mapConditions';
import { mapInitiativeRules } from '../services/mapInitiativeRules';
import { mapResources } from '../resources/collectionResources';
import type { TokenEntity } from '../types';
import type { PlayerProfile } from '../types/collectionSettingsTypes';
import { mapPlayers } from '../players/playerProfiles';
import { ConnectedPlayers, parseProfileChoice } from './connectedPlayers';
import { SceneReplicator, type ReplicatedSource } from './scene/SceneReplicator';

export interface OnlineSessionState {
  isRunning: boolean;
  /** Browsers currently connected with the player link. */
  playerCount: number;
  /** The profiles of the presented scene's collection that someone is connected as. */
  players: PlayerProfile[];
}

/** Read by the dashboard; one session per plugin, like the player window. */
export const onlineSessionStore: StoreApi<OnlineSessionState> = createStore<OnlineSessionState>(() => ({
  isRunning: false,
  playerCount: 0,
  players: [],
}));

/**
 * Lets players join from a browser with a link. The server runs on this computer; the player's
 * browser runs Atlas' own canvas on the scene the DM has open (ADR 0001), through their own camera.
 * Players move, turn and change the tokens the DM gave them, follow
 * the initiative order and roll dice.
 */
export class OnlineSession {
  private static instance: OnlineSession | null = null;
  private server: OnlineSessionServer | null = null;
  private readonly controls: PlayerControls;
  private readonly diceFeed: PlayerDiceFeed;
  private readonly diceLog: PlayerDiceLog;
  /** Keeps the players' scenes in step with the DM's. */
  private readonly replicator: SceneReplicator;
  /** The view whose scene players see; its dice engine rolls for them. */
  private presentedView: AtlasView | null = null;
  /** Artwork of the rolls players were sent, which their pages load. */
  private readonly rollImages = new Set<string>();
  /** The connected pages and the profile each one's player chose. */
  private readonly connected = new ConnectedPlayers();
  private collectionSettingsRef: EventRef | null = null;

  constructor(private readonly app: App, private readonly settingsService: SettingsService) {
    this.controls = new PlayerControls((formula, token, profile) => this.rollForPlayer(formula, token, profile));
    this.diceFeed = new PlayerDiceFeed(
      () => this.presentedView?.atlasStore.getState().objects.tokens,
      (roll) => {
        if (roll.source?.tokenImagePath) this.rollImages.add(roll.source.tokenImagePath);
        this.server?.broadcast('roll', roll);
      },
    );
    this.diceLog = new PlayerDiceLog({
      toAll: (event, data) => this.server?.broadcast(event, data),
      toPlayer: (playerId, event, data) => this.server?.sendTo(playerId, event, data),
    }, (roll) => {
      if (roll.source?.tokenImagePath) this.rollImages.add(roll.source.tokenImagePath);
    });
    this.replicator = new SceneReplicator(settingsService, {
      toAll: (event, data) => this.server?.broadcast(event, data),
      toPlayer: (playerId, event, data) => this.server?.sendTo(playerId, event, data),
    });
    // Released with the other listeners when the plugin unloads (`registerFollowedScene`)
    onFollowedScene((scene) => this.follow(scene));
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
    this.setSource(null);
    this.diceFeed.stop();
    this.presentedView = null;
    this.server?.close();
    this.server = null;
    this.rollImages.clear();
    this.connected.clear();
    if (this.collectionSettingsRef) this.app.workspace.offref(this.collectionSettingsRef);
    this.collectionSettingsRef = null;
    onlineSessionStore.setState({ isRunning: false, playerCount: 0, players: [] });
  }

  /**
   * Players follow the DM: they see the scene the Atlas view has open, a new one once it has
   * loaded, and the waiting message while none is open.
   */
  private follow(scene: FollowedScene | null): void {
    this.presentedView = scene?.view ?? null;
    if (!this.isRunning()) return;
    this.setSource(scene);
    if (!scene) this.server?.broadcast('noScene', null);
    this.showConnected();
  }

  /** Players act on and see the scene of `presented`; none while no scene is open. */
  private setSource(presented: FollowedScene | null): void {
    const store = presented?.source.store;
    // The log follows the scene while the DM browses other tabs, as the rolls do
    this.diceLog.setStore(store ?? null);
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
      players: () => mapPlayers(assets, store.getState().mapPath),
      updateProfile: (profileId, changes) => {
        const mapPath = store.getState().mapPath;
        const collectionId = mapPath ? assets.getCollectionForMap(mapPath) : null;
        if (!collectionId) return;
        const players = mapPlayers(assets, mapPath).map((player) => (player.id === profileId ? { ...player, ...changes } : player));
        void assets.updateCollectionSettings(collectionId, { players }).catch((error) => console.error('[OnlineSession] Could not save what a player changed of their profile:', error));
      },
    };
  }

  /** Tells the dashboard who is connected, by the profiles of the presented scene's collection. */
  private showConnected(): void {
    const mapPath = this.presentedView?.atlasStore.getState().mapPath;
    const players = mapPlayers(AssetService.getInstance(this.app), mapPath);
    onlineSessionStore.setState({ playerCount: this.connected.count, players: this.connected.connectedProfiles(players) });
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

  private rollForPlayer(formula: string, token: TokenEntity | undefined, profile: PlayerProfile | null): boolean {
    const diceTool = this.presentedView?.serviceManager.getToolController().getDiceTool();
    if (!diceTool) return false;
    this.diceFeed.rollForPlayer(diceTool, formula, token, profile);
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
        this.connected.join(playerId);
        this.replicator.sendTo(playerId);
        this.diceLog.sendTo(playerId);
        this.showConnected();
      },
      onLeave: (playerId) => {
        this.controls.playerLeft(playerId);
        this.connected.leave(playerId);
        this.showConnected();
      },
      onCommand: (body, playerId) => this.controls.apply(body, playerId, this.connected.profileOf(playerId)),
      onProfile: (body, playerId) => {
        const profile = parseProfileChoice(body);
        if (profile === undefined || !this.connected.choose(playerId, profile)) return false;
        this.showConnected();
        return true;
      },
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
    this.follow(followedScene());
    // A renamed or recoloured player shows so on the dashboard at once
    this.collectionSettingsRef = this.app.workspace.on('atlas-vtt:collection-settings-changed', () => this.showConnected());
    onlineSessionStore.setState({ isRunning: true, playerCount: 0, players: [] });
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

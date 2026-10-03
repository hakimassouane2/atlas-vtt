import type { StoreApi } from 'zustand';
import type { PlayerCameraState } from '../local-player-view';
import type { PixiRendererOrchestrator } from '../PixiRendererOrchestrator';
import type { SettingsService } from '../services/SettingsService';
import type { ViewAtlasState } from '../storeFactory';
import type { ResourceDefinition } from '../resources/resourceTypes';
import type { ConditionDefinition } from '../types/collectionSettingsTypes';
import type { InitiativeRules } from '../types/initiativeRulesTypes';
import { CanvasRenders } from './CanvasRenders';
import { PlayerFrameRenderer, type FrameView, type PlayerFrame } from './PlayerFrameRenderer';
import { FRAME_QUALITIES, type PlayerStreamRequest } from './playerStreamRequest';

/** The presented scene and its renderer. */
export interface OnlineFrameSource {
  store: StoreApi<ViewAtlasState>;
  renderer: PixiRendererOrchestrator;
  getCamera(): PlayerCameraState | undefined;
  /** The conditions the scene's collection defines. */
  getConditions(): ConditionDefinition[];
  /** The resources the scene's collection gives tokens. */
  getResources(): ResourceDefinition[];
  getInitiativeRules(): InitiativeRules;
}

/** Where frames go: `isReady` says whether a player's connection takes one now. */
export interface FrameSink {
  isReady(playerId: string): boolean;
  /** `isDmCamera`: the frame shows the DM's framing, which a recentering player adopts. */
  send(playerId: string, image: Uint8Array, view: FrameView, isDmCamera: boolean): void;
}

interface Viewer {
  request: PlayerStreamRequest;
  /** The player's own camera; null shows the DM's until the player moves. */
  camera: PlayerCameraState | null;
  renderer: PlayerFrameRenderer;
  isStale: boolean;
  isEncoding: boolean;
  lastRenderedFrames: number;
  lastSentAt: number;
}

/**
 * Renders the player-safe frame of the presented scene for each player: at their
 * screen size, through their own camera (or the DM's when they follow it), at most
 * at their frame rate, and only when the scene or their camera changed. While the
 * DM works on another tab, players keep their last frame.
 */
export class OnlineFrameStream {
  private source: OnlineFrameSource | null = null;
  /** Renders of the source's canvas: when their count changes, so did the scene. */
  private renders: CanvasRenders | null = null;
  private readonly viewers = new Map<string, Viewer>();
  private isHeld = false;
  private isFollowingDm = false;
  private animationFrame: number | null = null;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly sink: FrameSink,
  ) {}

  addViewer(playerId: string, request: PlayerStreamRequest): void {
    this.viewers.set(playerId, {
      request, camera: null, renderer: new PlayerFrameRenderer(),
      isStale: true, isEncoding: false, lastRenderedFrames: 0, lastSentAt: 0,
    });
    if (this.animationFrame === null) this.tick();
  }

  removeViewer(playerId: string): void {
    this.viewers.get(playerId)?.renderer.destroy();
    this.viewers.delete(playerId);
    if (this.viewers.size === 0) this.pause();
  }

  /** The player moved their camera; null goes back to the DM's framing. */
  setViewerCamera(playerId: string, camera: PlayerCameraState | null): void {
    const viewer = this.viewers.get(playerId);
    if (!viewer) return;
    viewer.camera = camera;
    viewer.isStale = true;
  }

  /** Every player sees through the DM's camera while this is on. */
  setFollowingDm(isFollowing: boolean): void {
    this.isFollowingDm = isFollowing;
    this.recenterAll();
  }

  /** Back to the DM's framing for everyone, e.g. when another scene is presented. */
  recenterAll(): void {
    this.viewers.forEach((viewer) => {
      viewer.camera = null;
      viewer.isStale = true;
    });
  }

  stop(): void {
    this.pause();
    this.setRenders(null);
    this.source = null;
    [...this.viewers.keys()].forEach((playerId) => this.removeViewer(playerId));
  }

  /** Stream `source` live from now on. */
  setSource(source: OnlineFrameSource): void {
    this.source = source;
    this.setRenders(new CanvasRenders(source.renderer.getAppInstance()));
    this.isHeld = false;
    this.viewers.forEach((viewer) => { viewer.isStale = true; });
  }

  /** Keep players on their last frame. */
  hold(): void {
    this.isHeld = true;
  }

  /** The map view owning `store` is closing: keep the last frames and forget the view. */
  releaseSource(store: StoreApi<ViewAtlasState>): void {
    if (this.source?.store !== store) return;
    this.hold();
    this.setRenders(null);
    this.source = null;
  }

  private setRenders(renders: CanvasRenders | null): void {
    this.renders?.destroy();
    this.renders = renders;
  }

  private pause(): void {
    if (this.animationFrame !== null) window.cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }

  private readonly tick = (): void => {
    this.animationFrame = window.requestAnimationFrame(this.tick);
    const { source, renders } = this;
    if (!source || !renders || this.isHeld) return;
    const renderedFrames = renders.frames;
    const now = performance.now();
    for (const [playerId, viewer] of this.viewers) {
      if (viewer.isEncoding || now - viewer.lastSentAt < 1000 / viewer.request.fps || !this.sink.isReady(playerId)) continue;
      // A frame only changes when the DM canvas rendered something new or the player's camera moved
      const sceneChanged = renderedFrames !== viewer.lastRenderedFrames;
      if (!viewer.isStale && !sceneChanged) continue;
      const isDmCamera = this.isFollowingDm || !viewer.camera;
      const camera = isDmCamera ? source.getCamera() : viewer.camera;
      if (!camera) continue;
      viewer.isStale = false;
      viewer.lastRenderedFrames = renderedFrames;
      viewer.lastSentAt = now;
      this.render(playerId, viewer, source, renders, camera, isDmCamera);
    }
  };

  private render(playerId: string, viewer: Viewer, source: OnlineFrameSource, renders: CanvasRenders, camera: PlayerCameraState, isDmCamera: boolean): void {
    let frame: PlayerFrame | null = null;
    try {
      const settings = this.settingsService.getLocalPlayerViewSettings();
      frame = renders.ignoring(() => viewer.renderer.render(source.renderer, settings, camera, viewer.request.screen));
    } catch (error) {
      console.error('[OnlineFrameStream] Could not render a player frame:', error);
    }
    if (!frame) return;
    const { view } = frame;
    viewer.isEncoding = true;
    frame.canvas.toBlob((blob) => {
      if (!blob) {
        viewer.isEncoding = false;
        return;
      }
      blob.arrayBuffer()
        .then((buffer) => this.sink.send(playerId, new Uint8Array(buffer), view, isDmCamera))
        .catch((error: unknown) => console.error('[OnlineFrameStream] Could not encode a player frame:', error))
        .finally(() => { viewer.isEncoding = false; });
    }, 'image/jpeg', FRAME_QUALITIES[viewer.request.quality]);
  }
}

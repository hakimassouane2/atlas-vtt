import type { StoreApi } from 'zustand';
import type { PlayerCameraState } from '../local-player-view';
import type { PixiRendererOrchestrator } from '../PixiRendererOrchestrator';
import type { SettingsService } from '../services/SettingsService';
import type { ViewAtlasState } from '../storeFactory';
import { PlayerFrameRenderer, type FrameView, type PlayerFrame } from './PlayerFrameRenderer';
import { FRAME_QUALITIES, type PlayerStreamRequest } from './playerStreamRequest';

/** The presented scene: its renderer, and what tells when it changed. */
export interface OnlineFrameSource {
  store: StoreApi<ViewAtlasState>;
  renderer: PixiRendererOrchestrator;
  getRenderedFrames(): number | undefined;
  getCamera(): PlayerCameraState | undefined;
}

/**
 * Renders the player-safe frame of the presented scene at the players' screen size
 * whenever the DM canvas renders, at most at the rate players asked for, and hands
 * it to `publish` as JPEG. While the DM works on another tab the last frame stays.
 */
export class OnlineFrameStream {
  private source: OnlineFrameSource | null = null;
  private request: PlayerStreamRequest | null = null;
  private isHeld = false;
  private isStale = true;
  private isEncoding = false;
  private lastRenderedFrames: number | undefined;
  private lastSentAt = 0;
  private animationFrame: number | null = null;
  private readonly frameRenderer = new PlayerFrameRenderer();

  constructor(
    private readonly settingsService: SettingsService,
    private readonly publish: (image: Uint8Array, view: FrameView) => void,
  ) {}

  /** What connected players ask for; null pauses the stream, since nobody watches. */
  setRequest(request: PlayerStreamRequest | null): void {
    this.request = request;
    this.isStale = true;
    if (!request) {
      this.pause();
    } else if (this.animationFrame === null) {
      this.tick();
    }
  }

  stop(): void {
    this.pause();
    this.source = null;
    this.frameRenderer.destroy();
  }

  /** Stream `source` live from now on. */
  setSource(source: OnlineFrameSource): void {
    this.source = source;
    this.isHeld = false;
    this.isStale = true;
  }

  /** Keep players on the last frame. */
  hold(): void {
    this.isHeld = true;
  }

  /** The map view owning `store` is closing: keep the last frame and forget the view. */
  releaseSource(store: StoreApi<ViewAtlasState>): void {
    if (this.source?.store !== store) return;
    this.hold();
    this.source = null;
  }

  private pause(): void {
    if (this.animationFrame !== null) window.cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }

  private readonly tick = (): void => {
    this.animationFrame = window.requestAnimationFrame(this.tick);
    const { source, request } = this;
    if (!source || !request || this.isHeld || this.isEncoding) return;
    const now = performance.now();
    if (now - this.lastSentAt < 1000 / request.fps) return;

    // A frame only changes when the DM canvas rendered something new
    const renderedFrames = source.getRenderedFrames();
    if (!this.isStale && renderedFrames !== undefined && renderedFrames === this.lastRenderedFrames) return;
    const camera = source.getCamera();
    if (!camera) return;
    this.isStale = false;
    this.lastRenderedFrames = renderedFrames;
    this.lastSentAt = now;

    let frame: PlayerFrame | null = null;
    try {
      frame = this.frameRenderer.render(source.renderer, this.settingsService.getLocalPlayerViewSettings(), camera, request.screen);
    } catch (error) {
      console.error('[OnlineFrameStream] Could not render the player frame:', error);
    }
    if (frame) this.encode(frame, FRAME_QUALITIES[request.quality]);
  };

  private encode({ canvas, view }: PlayerFrame, quality: number): void {
    this.isEncoding = true;
    canvas.toBlob((blob) => {
      if (!blob) {
        this.isEncoding = false;
        return;
      }
      blob.arrayBuffer()
        .then((buffer) => this.publish(new Uint8Array(buffer), view))
        .catch((error: unknown) => console.error('[OnlineFrameStream] Could not encode the player frame:', error))
        .finally(() => { this.isEncoding = false; });
    }, 'image/jpeg', quality);
  }
}

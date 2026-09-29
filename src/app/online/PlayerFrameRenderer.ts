import { RenderTexture } from 'pixi.js';
import type { PlayerCameraState } from '../local-player-view';
import type { PixiRendererOrchestrator } from '../PixiRendererOrchestrator';
import { captureWithLayerVisibility } from '../pixi/playerSafeFrame';
import type { AtlasSettings } from '../services/SettingsService';

/** A player's screen: the frame in device pixels and its width in CSS pixels. */
export interface PlayerScreen {
  width: number;
  height: number;
  cssWidth: number;
}

/**
 * Renders the presented scene for players at the size of their screen, so the map
 * fills their browser at full sharpness whatever the size of the DM's view.
 * The DM canvas is rendered again right after, before the browser composites.
 */
export class PlayerFrameRenderer {
  private texture: RenderTexture | null = null;

  render(
    renderer: PixiRendererOrchestrator,
    settings: AtlasSettings['localPlayerView'],
    camera: PlayerCameraState,
    screen: PlayerScreen,
  ): HTMLCanvasElement | null {
    const app = renderer.getAppInstance();
    const viewport = renderer.getViewportInstance();
    if (!app?.renderer || !viewport) return null;
    const texture = this.textureOfSize(screen.width, screen.height);

    // The camera keeps the DM's zoom per CSS pixel, so a larger screen shows more of the map
    const target = { screenWidth: screen.width, screenHeight: screen.height, position: viewport.position, scale: viewport.scale };
    const frameCamera = { ...camera, scale: camera.scale * (screen.width / screen.cssWidth) };
    let renderTarget: RenderTexture | null = texture;
    let frame: HTMLCanvasElement | null = null;
    captureWithLayerVisibility(
      renderer.getPlayerViewLayers(settings),
      () => {
        // First the player frame into the texture, then the DM frame back onto the canvas
        if (renderTarget) {
          app.renderer.render({ container: app.stage, target: renderTarget, clear: true, clearColor: app.renderer.background.color });
        } else {
          app.renderer.render(app.stage);
        }
      },
      () => {
        frame = app.renderer.extract.canvas(texture) as HTMLCanvasElement;
        renderTarget = null;
      },
      { target, camera: frameCamera },
    );
    return frame;
  }

  destroy(): void {
    this.texture?.destroy(true);
    this.texture = null;
  }

  private textureOfSize(width: number, height: number): RenderTexture {
    if (!this.texture) {
      this.texture = RenderTexture.create({ width, height, resolution: 1 });
    } else if (this.texture.width !== width || this.texture.height !== height) {
      this.texture.resize(width, height, 1);
    }
    return this.texture;
  }
}

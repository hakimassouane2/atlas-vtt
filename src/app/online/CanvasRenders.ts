import type { Application } from 'pixi.js';

/**
 * Counts the renders of a map's canvas, which tell the online stream that the DM's scene
 * changed. Renders into a texture (thumbnails, player frames) do not count, nor do the
 * renders made inside `ignoring`, such as the one that puts the DM's frame back after a
 * player frame.
 */
export class CanvasRenders {
  private count = 0;
  private isIgnoring = false;
  private readonly listener = {
    postrender: ({ target }: { target?: unknown }): void => {
      if (!this.isIgnoring && target === this.app.renderer.view.renderTarget) this.count++;
    },
  };

  constructor(private readonly app: Application) {
    app.renderer.runners.postrender.add(this.listener);
  }

  get frames(): number {
    return this.count;
  }

  ignoring<T>(run: () => T): T {
    this.isIgnoring = true;
    try {
      return run();
    } finally {
      this.isIgnoring = false;
    }
  }

  destroy(): void {
    this.app.renderer?.runners.postrender.remove(this.listener);
  }
}

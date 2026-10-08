import { ImageSource, Texture } from 'pixi.js';
import type { ArtSource, CanvasCollections } from '../../canvas/canvasHost';
import type { TokenEntity } from '../../types';
import { detectTintable } from '../../tokenRings/ringTint';
import { readTokenRingSettings, ringChoiceOf, ringTints } from '../../tokenRings/tokenRingChoice';
import { isTokenRingPath, tokenRingPath } from '../../tokenRings/tokenRingFiles';

/** How a token's ring is drawn: a texture (null is Atlas' own ring) tinted in a colour (white leaves it as drawn). */
export interface TokenRingLook {
  texture: Texture | null;
  color: string;
}

/** Whether going from `previous` to `token` changes the ring it is drawn with. */
export function ringChanged(previous: TokenEntity, token: TokenEntity): boolean {
  return previous.ringColor !== token.ringColor || previous.showRing !== token.showRing
    || previous.role !== token.role || previous.ringStyle !== token.ringStyle;
}

interface LoadedRing {
  texture: Texture;
  bitmap: ImageBitmap;
  tintable: boolean;
}

/** A ring file that could not be read: its tokens show Atlas' ring. */
const MISSING = 'missing';
const LOADING = 'loading';

/**
 * The rings of a canvas's tokens. A token's ring is chosen from its own fields and its map's
 * collection (`ringChoiceOf`); ring files are read through the canvas's art source, so the
 * players' page reads them from the GM's Atlas as it reads token art. Each file is decoded once
 * and looked at for its tint; until it is there its tokens show Atlas' ring, and `onLoaded`
 * asks for the rings to be drawn again.
 */
export class TokenRingLooks {
  private readonly rings = new Map<string, LoadedRing | typeof MISSING | typeof LOADING>();
  private readonly stopArtChanges: () => void;
  private destroyed = false;

  constructor(
    private readonly art: ArtSource,
    private readonly collections: CanvasCollections,
    private readonly mapPath: () => string | null | undefined,
    private readonly onLoaded: () => void,
  ) {
    this.stopArtChanges = art.onChanged((path) => {
      if (!isTokenRingPath(path) || !this.rings.has(path)) return;
      this.forget(path);
      this.onLoaded();
    });
  }

  lookOf(token: TokenEntity): TokenRingLook {
    const mapPath = this.mapPath();
    const collectionId = mapPath ? this.collections.getCollectionForMap(mapPath) : null;
    const settings = readTokenRingSettings(collectionId ? this.collections.getCollectionSettings(collectionId) : null);
    const choice = ringChoiceOf(token, settings);
    const ring = choice.style && collectionId ? this.ring(tokenRingPath(collectionId, choice.style)) : null;
    // A ring file that is not there (yet) gives way to Atlas' own ring, which tints
    const tints = ring ? ringTints(choice.style, ring.tintable, settings) : true;
    return { texture: ring?.texture ?? null, color: tints ? choice.color ?? '#ffffff' : '#ffffff' };
  }

  destroy(): void {
    this.destroyed = true;
    this.stopArtChanges();
    for (const path of [...this.rings.keys()]) this.forget(path);
  }

  private ring(path: string): LoadedRing | null {
    const entry = this.rings.get(path);
    if (entry === undefined) {
      this.rings.set(path, LOADING);
      void this.load(path);
      return null;
    }
    return typeof entry === 'object' ? entry : null;
  }

  private async load(path: string): Promise<void> {
    let loaded: LoadedRing | typeof MISSING = MISSING;
    try {
      const file = await this.art.read(path);
      if (file) {
        const blob = new Blob([file.bytes], { type: file.mimeType });
        const [bitmap, tintable] = await Promise.all([createImageBitmap(blob), detectTintable(blob)]);
        const source = new ImageSource({ resource: bitmap, autoGenerateMipmaps: true, scaleMode: 'linear', label: path });
        loaded = { texture: new Texture({ source, label: path }), bitmap, tintable };
      }
    } catch (error) {
      console.warn(`[TokenRingLooks] Could not read the ring ${path}:`, error);
    }
    // A change of the file or the end of the canvas meanwhile drops what was read
    if (this.destroyed || this.rings.get(path) !== LOADING) {
      if (typeof loaded === 'object') this.release(loaded);
      return;
    }
    this.rings.set(path, loaded);
    if (typeof loaded === 'object') this.onLoaded();
  }

  private forget(path: string): void {
    const entry = this.rings.get(path);
    this.rings.delete(path);
    if (typeof entry === 'object') this.release(entry);
  }

  private release({ texture, bitmap }: LoadedRing): void {
    texture.destroy(true);
    bitmap.close();
  }
}

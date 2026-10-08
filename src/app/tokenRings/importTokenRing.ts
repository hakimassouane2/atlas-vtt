import type { App } from 'obsidian';
import { IMAGE_PRESETS, optimizeImage } from '../imageProcessing/imageProcessing';
import { imageDimensions } from '../imageProcessing/imageDimensions';
import { freePathIn } from '../services/collectionBundle/pathRemap';
import { tokenRingFolder, tokenRingStyleOfPath } from './tokenRingFiles';

/** Sides may differ by this share and the image still counts as square (a crop off by a pixel or two). */
const SQUARE_TOLERANCE = 0.02;

export type RingImport = { style: string } | { problem: 'not-square' | 'failed' };

/**
 * Converts `file` into a ring of `collectionId` (WebP, at most the size of Atlas' ring) under a
 * name no other ring has, and returns its style. A ring frames a round token, so the image must be
 * square; one whose size cannot be read is converted all the same.
 */
export async function importTokenRing(app: App, collectionId: string, file: File): Promise<RingImport> {
  try {
    const size = await imageDimensions(file);
    if (size && Math.abs(size.width - size.height) > SQUARE_TOLERANCE * Math.max(size.width, size.height)) return { problem: 'not-square' };
    const { image } = await optimizeImage(file, IMAGE_PRESETS.ring);
    const folder = tokenRingFolder(collectionId);
    if (!app.vault.getFolderByPath(folder)) await app.vault.createFolder(folder);
    const stem = file.name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|#^[\]]+/g, '-').trim() || 'ring';
    const path = freePathIn(folder, `${stem}.webp`, (candidate) => app.vault.getAbstractFileByPath(candidate) !== null);
    await app.vault.createBinary(path, await image.arrayBuffer());
    const style = tokenRingStyleOfPath(path);
    return style ? { style } : { problem: 'failed' };
  } catch (error) {
    console.error('[importTokenRing] Could not import the ring:', error);
    return { problem: 'failed' };
  }
}

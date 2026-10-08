import { COLLECTIONS_DIR, collectionFolderPath } from '../services/assetPaths';
import { imageMimeTypeOfPath } from '../utils/imageMimeTypes';

/**
 * A collection's ring files lie in this folder at its root, outside every tab folder, so they
 * travel with the collection (renames, bundles) and never become assets. A ring is named by
 * its file name; it is drawn over a 1024 px square stretched to the ring's outer diameter, the
 * art showing through its transparent middle as through Atlas' own ring (`token-ring.webp`).
 */
export const TOKEN_RINGS_FOLDER = 'token-rings';

/** The vault folder of `collectionId`'s ring files. */
export const tokenRingFolder = (collectionId: string): string => `${collectionFolderPath(collectionId)}/${TOKEN_RINGS_FOLDER}`;

/** The vault path of the ring `style` of `collectionId`. */
export const tokenRingPath = (collectionId: string, style: string): string => `${tokenRingFolder(collectionId)}/${style}`;

const RING_FILE = new RegExp(`^${COLLECTIONS_DIR}/[^/]+/${TOKEN_RINGS_FOLDER}/([^/]+)$`);

/** The ring a vault path names (`…/goblins/token-rings/gold.webp` → `gold.webp`): an image right inside a ring folder. */
export function tokenRingStyleOfPath(path: string): string | null {
  const name = RING_FILE.exec(path)?.[1];
  return name && imageMimeTypeOfPath(name) && imageMimeTypeOfPath(name) !== 'image/svg+xml' ? name : null;
}

/** Whether `path` is a ring file of some collection. */
export const isTokenRingPath = (path: string): boolean => tokenRingStyleOfPath(path) !== null;

/** What the GM sees of a ring file: its name without extension. */
export function ringDisplayName(style: string): string {
  const dot = style.lastIndexOf('.');
  return dot > 0 ? style.slice(0, dot) : style;
}

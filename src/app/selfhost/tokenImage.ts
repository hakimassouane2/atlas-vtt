import type { App } from 'obsidian';
import type { TokenImage } from './OnlineSessionServer';
import { imageMimeTypeOfPath } from '../utils/imageMimeTypes';

/**
 * The image at `path` for players' pages: a web image by its URL, a vault image by its
 * bytes. The caller decides which paths players may load; only image files are read.
 */
export async function tokenImage(app: App, path: string): Promise<TokenImage | null> {
  if (/^https?:/i.test(path)) return { url: path };
  const contentType = imageMimeTypeOfPath(path);
  if (!contentType || !(await app.vault.adapter.exists(path))) return null;
  return { data: new Uint8Array(await app.vault.adapter.readBinary(path)), contentType };
}

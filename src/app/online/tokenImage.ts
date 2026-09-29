import type { App } from 'obsidian';
import type { TokenImage } from './OnlineSessionServer';

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
};

/**
 * The image at `path` for players' pages: a web image by its URL, a vault image by its
 * bytes. The caller decides which paths players may load; only image files are read.
 */
export async function tokenImage(app: App, path: string): Promise<TokenImage | null> {
  if (/^https?:/i.test(path)) return { url: path };
  const contentType = IMAGE_TYPES[path.split('.').pop()?.toLowerCase() ?? ''];
  if (!contentType || !(await app.vault.adapter.exists(path))) return null;
  return { data: new Uint8Array(await app.vault.adapter.readBinary(path)), contentType };
}

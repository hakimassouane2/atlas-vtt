import type { App } from 'obsidian';
import type { TokenEntity } from '../types';
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
 * The artwork of `token` for players' pages, only when players may see the token:
 * a web image by its URL, a vault image by its bytes. Never any other vault file.
 */
export async function tokenImage(app: App, token: TokenEntity | undefined): Promise<TokenImage | null> {
  if (!token || token.isHidden || !token.imagePath) return null;
  const path = token.imagePath;
  if (/^https?:/i.test(path)) return { url: path };
  const contentType = IMAGE_TYPES[path.split('.').pop()?.toLowerCase() ?? ''];
  if (!contentType || !(await app.vault.adapter.exists(path))) return null;
  return { data: new Uint8Array(await app.vault.adapter.readBinary(path)), contentType };
}

import { setStatus } from './dom';

/** The session key from the player link; every request to the DM's Atlas carries it. */
const key = new URLSearchParams(location.search).get('k') ?? '';
/** Given by the DM's Atlas when the event stream opens; camera updates name it. */
let playerId: string | null = null;

export function setPlayerId(id: string): void {
  playerId = id;
}

/** `path` on the DM's Atlas, with the session key and `params`. */
export function sessionUrl(path: string, params: Record<string, string> = {}): string {
  return `${path}?${new URLSearchParams({ k: key, ...params }).toString()}`;
}

/** Where the page loads an image file of the scene (token artwork). */
export function imageUrl(path: string): string {
  return sessionUrl('/image', { path });
}

/**
 * Where the canvas page loads an image file of the scene: the vault path is part of the URL's
 * path, so it ends with the file's extension, by which PIXI picks its image loader.
 */
export function sceneImageUrl(path: string): string {
  return sessionUrl(`/image/${path.split('/').map(encodeURIComponent).join('/')}`);
}

/**
 * Sends `body` to the DM's Atlas. A refused command usually means the DM is on
 * another scene tab, where players cannot act.
 */
export function post(path: '/camera' | '/command', body: unknown): void {
  window.fetch(sessionUrl(path, playerId ? { id: playerId } : {}), { method: 'POST', body: JSON.stringify(body) })
    .then((response) => {
      if (response.status === 409 && path === '/command') setStatus('Action refusée : le MJ est peut-être sur une autre scène.');
    })
    .catch(() => setStatus('Action non envoyée, connexion perdue.'));
}

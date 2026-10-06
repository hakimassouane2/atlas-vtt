// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { get, type IncomingMessage } from 'http';
import { OnlineSessionServer, type OnlineSessionHandlers } from '../../src/app/online/OnlineSessionServer';

// A new port per test: fetch would otherwise reuse a keep-alive socket of the previous server
let port = 39_517;
let base = '';

/** A player's event stream: wait for text to arrive, then close it. */
interface EventStream {
  waitFor(text: string): Promise<string>;
  close(): void;
}

function openEvents(): EventStream {
  let body = '';
  let waiters: Array<{ text: string; resolve: (body: string) => void }> = [];
  let response: IncomingMessage | null = null;
  get(`${base}/events?k=secret`, (incoming: IncomingMessage) => {
    response = incoming;
    incoming.on('data', (chunk: Buffer) => {
      body += chunk.toString();
      waiters = waiters.filter((waiter) => !(body.includes(waiter.text) && (waiter.resolve(body), true)));
    });
  });
  return {
    waitFor: (text) => new Promise((resolve) => {
      if (body.includes(text)) resolve(body);
      else waiters.push({ text, resolve });
    }),
    close: () => response?.destroy(),
  };
}

function playerIdIn(body: string): string {
  return (JSON.parse(/event: hello\ndata: (.*)\n/.exec(body)![1]!) as { id: string }).id;
}

describe('OnlineSessionServer', () => {
  let server: OnlineSessionServer;
  let handlers: { [K in keyof OnlineSessionHandlers]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.stubGlobal('window', globalThis);
    handlers = {
      onJoin: vi.fn(),
      onLeave: vi.fn(),
      onCommand: vi.fn((body: unknown) => (body as { ok?: boolean }).ok === true),
      onProfile: vi.fn(() => true),
      onImage: vi.fn((path: string) => Promise.resolve(path === 'tokens/hero.png' ? { data: new Uint8Array([7]), contentType: 'image/png' } : null)),
      pageTheme: vi.fn(() => ({ css: 'body { color: red; }', bodyClass: 'theme-dark atlas-player-window' })),
    };
    port++;
    base = `http://127.0.0.1:${port}`;
    server = new OnlineSessionServer('secret', handlers as unknown as OnlineSessionHandlers, { script: 'draw();', styles: '#content {}' });
    await server.listen(port);
  });

  afterEach(() => {
    server.close();
    vi.unstubAllGlobals();
  });

  test('rejects requests without the session key', async () => {
    expect((await fetch(`${base}/`)).status).toBe(403);
    expect((await fetch(`${base}/events?k=wrong`)).status).toBe(403);
  });

  test('serves the player page, its script and the DM theme with the key', async () => {
    const page = await (await fetch(`${base}/?k=secret`)).text();
    expect(page).toContain('<body class="theme-dark atlas-player-window atlas-vtt-plugin">');
    expect(page).toContain('/client.js?k=secret');
    expect(await (await fetch(`${base}/client.js?k=secret`)).text()).toBe('draw();');
    expect(await (await fetch(`${base}/styles.css?k=secret`)).text()).toBe('body { color: red; }\n#content {}');
  });

  test('serves only the images the session allows, named in the path so the URL ends with the extension', async () => {
    const image = await fetch(`${base}/image/tokens/hero.png?k=secret`);
    expect(image.headers.get('content-type')).toBe('image/png');
    expect([...new Uint8Array(await image.arrayBuffer())]).toEqual([7]);
    expect((await fetch(`${base}/image/secret-notes.md?k=secret`)).status).toBe(404);
  });

  test('greets a player with their id, and sends one player alone what is for them', async () => {
    const events = openEvents();
    const playerId = playerIdIn(await events.waitFor('event: hello'));
    expect(handlers.onJoin).toHaveBeenCalledWith(playerId);
    expect(server.playerCount).toBe(1);
    server.sendTo(playerId, 'scene', { mapPath: 'cave' });
    expect(await events.waitFor('event: scene')).toContain('data: {"mapPath":"cave"}');
    events.close();
  });

  test('shares state with every player, including those who connect later', async () => {
    server.share('mode', { isFollowingDm: true });
    const events = openEvents();
    expect(await events.waitFor('event: mode')).toContain('data: {"isFollowingDm":true}');
    events.close();
  });

  test('reports players who leave', async () => {
    const events = openEvents();
    const playerId = playerIdIn(await events.waitFor('event: hello'));
    events.close();
    await vi.waitFor(() => expect(handlers.onLeave).toHaveBeenCalledWith(playerId));
    expect(server.playerCount).toBe(0);
  });

  test('passes player commands on, with the id of a connected player, and reports whether they were applied', async () => {
    const accepted = await fetch(`${base}/command?k=secret`, { method: 'POST', body: '{"ok":true}' });
    expect(accepted.status).toBe(204);
    expect(handlers.onCommand).toHaveBeenCalledWith({ ok: true }, null);
    const events = openEvents();
    const playerId = playerIdIn(await events.waitFor('event: hello'));
    await fetch(`${base}/command?k=secret&id=${playerId}`, { method: 'POST', body: '{"ok":true}' });
    expect(handlers.onCommand).toHaveBeenLastCalledWith({ ok: true }, playerId);
    await fetch(`${base}/command?k=secret&id=stranger`, { method: 'POST', body: '{"ok":true}' });
    expect(handlers.onCommand).toHaveBeenLastCalledWith({ ok: true }, null);
    events.close();
    expect((await fetch(`${base}/command?k=secret`, { method: 'POST', body: '{}' })).status).toBe(409);
    expect((await fetch(`${base}/command?k=secret`, { method: 'POST', body: 'not json' })).status).toBe(409);
    expect((await fetch(`${base}/command?k=wrong`, { method: 'POST', body: '{"ok":true}' })).status).toBe(403);
  });

  test('passes on the profile a connected player chose, and refuses a page that is not connected', async () => {
    const events = openEvents();
    const playerId = playerIdIn(await events.waitFor('event: hello'));
    const chosen = await fetch(`${base}/profile?k=secret&id=${playerId}`, { method: 'POST', body: '{"profile":"alice"}' });
    expect(chosen.status).toBe(204);
    expect(handlers.onProfile).toHaveBeenCalledWith({ profile: 'alice' }, playerId);
    expect((await fetch(`${base}/profile?k=secret&id=stranger`, { method: 'POST', body: '{"profile":"alice"}' })).status).toBe(409);
    expect((await fetch(`${base}/profile?k=secret`, { method: 'POST', body: '{"profile":"alice"}' })).status).toBe(409);
    expect(handlers.onProfile).toHaveBeenCalledTimes(1);
    events.close();
  });
});

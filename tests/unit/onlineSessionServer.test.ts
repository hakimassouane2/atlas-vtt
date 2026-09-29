// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { get, type IncomingMessage } from 'http';
import { OnlineSessionServer, type OnlineSessionHandlers } from '../../src/app/online/OnlineSessionServer';

// A new port per test: fetch would otherwise reuse a keep-alive socket of the previous server
let port = 39_517;
let base = '';
const view = { centerX: 1, centerY: 2, zoom: 3, cssWidth: 800, cssHeight: 600 };

/** A player's event stream: wait for text to arrive, then close it. */
interface EventStream {
  waitFor(text: string): Promise<string>;
  close(): void;
}

function openEvents(query = ''): EventStream {
  let body = '';
  let waiters: Array<{ text: string; resolve: (body: string) => void }> = [];
  let response: IncomingMessage | null = null;
  get(`${base}/events?k=secret&${query}`, (incoming: IncomingMessage) => {
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
      onCamera: vi.fn(),
      onCommand: vi.fn((body: unknown) => (body as { ok?: boolean }).ok === true),
    };
    port++;
    base = `http://127.0.0.1:${port}`;
    server = new OnlineSessionServer('secret', handlers as unknown as OnlineSessionHandlers);
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

  test('serves the player page with the key', async () => {
    const response = await fetch(`${base}/?k=secret`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('EventSource');
  });

  test('greets a player with their id and reports what they ask for', async () => {
    const events = openEvents('w=800&h=600&cw=400&fps=10&q=low');
    const playerId = playerIdIn(await events.waitFor('event: hello'));
    expect(handlers.onJoin).toHaveBeenCalledWith(playerId, { screen: { width: 800, height: 600, cssWidth: 400 }, fps: 10, quality: 'low' });
    expect(server.playerCount).toBe(1);
    events.close();
  });

  test('sends a player their frames with the view they show', async () => {
    const events = openEvents();
    const playerId = playerIdIn(await events.waitFor('event: hello'));
    expect(server.isReady(playerId)).toBe(true);
    server.sendFrame(playerId, new Uint8Array([1, 2, 3]), view, true);
    const body = await events.waitFor('data: AQID');
    expect(body).toContain(`event: frame\ndata: ${JSON.stringify({ ...view, isDmCamera: true })}\ndata: AQID`);
    events.close();
  });

  test('shares state with every player, including those who connect later', async () => {
    server.share('state', { tokens: [] });
    const events = openEvents();
    expect(await events.waitFor('event: state')).toContain('data: {"tokens":[]}');
    events.close();
  });

  test('passes a connected player camera on, and refuses unknown players', async () => {
    const events = openEvents();
    const playerId = playerIdIn(await events.waitFor('event: hello'));
    const moved = await fetch(`${base}/camera?k=secret&id=${playerId}`, { method: 'POST', body: '{"recenter":true}' });
    expect(moved.status).toBe(204);
    expect(handlers.onCamera).toHaveBeenCalledWith(playerId, { recenter: true });
    expect((await fetch(`${base}/camera?k=secret&id=nobody`, { method: 'POST', body: '{}' })).status).toBe(409);
    events.close();
  });

  test('reports players who leave', async () => {
    const events = openEvents();
    const playerId = playerIdIn(await events.waitFor('event: hello'));
    events.close();
    await vi.waitFor(() => expect(handlers.onLeave).toHaveBeenCalledWith(playerId));
    expect(server.playerCount).toBe(0);
  });

  test('passes player commands on and reports whether they were applied', async () => {
    const accepted = await fetch(`${base}/command?k=secret`, { method: 'POST', body: '{"ok":true}' });
    expect(accepted.status).toBe(204);
    expect(handlers.onCommand).toHaveBeenCalledWith({ ok: true });
    expect((await fetch(`${base}/command?k=secret`, { method: 'POST', body: '{}' })).status).toBe(409);
    expect((await fetch(`${base}/command?k=secret`, { method: 'POST', body: 'not json' })).status).toBe(409);
    expect((await fetch(`${base}/command?k=wrong`, { method: 'POST', body: '{"ok":true}' })).status).toBe(403);
  });
});

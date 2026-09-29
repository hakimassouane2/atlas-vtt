// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { get, type IncomingMessage } from 'http';
import { OnlineSessionServer } from '../../src/app/online/OnlineSessionServer';

// A new port per test: fetch would otherwise reuse a keep-alive socket of the previous server
let port = 39_517;
let base = '';

/** Opens an event stream and resolves with its text once `until` appears. */
function readEvents(query: string, until: string): Promise<string> {
  return new Promise((resolve) => {
    get(`${base}/events?k=secret&${query}`, (response: IncomingMessage) => {
      let body = '';
      response.on('data', (chunk: Buffer) => {
        body += chunk.toString();
        if (body.includes(until)) {
          response.destroy();
          resolve(body);
        }
      });
    });
  });
}

describe('OnlineSessionServer', () => {
  let server: OnlineSessionServer;
  const onRequestChange = vi.fn();
  const onCommand = vi.fn((command: unknown) => (command as { ok?: boolean }).ok === true);

  beforeEach(async () => {
    vi.stubGlobal('window', globalThis);
    onRequestChange.mockClear();
    onCommand.mockClear();
    port++;
    base = `http://127.0.0.1:${port}`;
    server = new OnlineSessionServer('secret', onRequestChange, onCommand);
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

  test('sends the latest frame and its view to a player as soon as it connects', async () => {
    const view = { centerX: 1, centerY: 2, scale: 3, width: 800, height: 600 };
    server.publishFrame(new Uint8Array([1, 2, 3]), view);
    const body = await readEvents('w=800&h=600', 'data: AQID');
    expect(body).toContain(`event: frame\ndata: ${JSON.stringify(view)}\ndata: AQID`);
  });

  test('sends the latest state to a player as soon as it connects', async () => {
    server.publishState({ tokens: [] });
    expect(await readEvents('', 'event: state')).toContain('data: {"tokens":[]}');
  });

  test('passes player commands on and reports whether they were applied', async () => {
    const accepted = await fetch(`${base}/command?k=secret`, { method: 'POST', body: '{"ok":true}' });
    expect(accepted.status).toBe(204);
    expect(onCommand).toHaveBeenCalledWith({ ok: true });
    expect((await fetch(`${base}/command?k=secret`, { method: 'POST', body: '{}' })).status).toBe(409);
    expect((await fetch(`${base}/command?k=secret`, { method: 'POST', body: 'not json' })).status).toBe(409);
    expect((await fetch(`${base}/command?k=wrong`, { method: 'POST', body: '{"ok":true}' })).status).toBe(403);
  });

  test('reports what connected players ask for', async () => {
    server.publishFrame(new Uint8Array([1]), { centerX: 0, centerY: 0, scale: 1, width: 800, height: 600 });
    await readEvents('w=800&h=600&cw=400&fps=10&q=low', 'event: frame');
    expect(onRequestChange).toHaveBeenCalledWith(
      { screen: { width: 800, height: 600, cssWidth: 400 }, fps: 10, quality: 'low' }, 1,
    );
  });
});

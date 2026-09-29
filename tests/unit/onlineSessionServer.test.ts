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

  beforeEach(async () => {
    vi.stubGlobal('window', globalThis);
    onRequestChange.mockClear();
    port++;
    base = `http://127.0.0.1:${port}`;
    server = new OnlineSessionServer('secret', onRequestChange);
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

  test('sends the latest frame to a player as soon as it connects', async () => {
    server.publishFrame(new Uint8Array([1, 2, 3]));
    const body = await readEvents('w=800&h=600', 'data: AQID');
    expect(body).toContain('event: frame');
  });

  test('reports what connected players ask for', async () => {
    server.publishFrame(new Uint8Array([1]));
    await readEvents('w=800&h=600&cw=400&fps=10&q=low', 'event: frame');
    expect(onRequestChange).toHaveBeenCalledWith(
      { screen: { width: 800, height: 600, cssWidth: 400 }, fps: 10, quality: 'low' }, 1,
    );
  });
});

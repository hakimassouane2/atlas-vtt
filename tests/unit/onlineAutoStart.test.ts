import { afterEach, describe, expect, test, vi } from 'vitest';
import { createServer, type Server } from 'net';
import { Notice, Platform, type App } from 'obsidian';
import { OnlineSession, onlineSessionStore } from '../../src/app/online/OnlineSession';
import type { OnlineSessionSettings, SettingsService } from '../../src/app/services/SettingsService';

vi.mock('obsidian', async (original) => ({ ...(await original<typeof import('obsidian')>()), Notice: vi.fn() }));

// A new port per test, like the server's own tests
let port = 39_617;
let session: OnlineSession | null = null;
let blocker: Server | null = null;

function sessionWith(changes: Partial<OnlineSessionSettings>): OnlineSession {
  let settings: OnlineSessionSettings = { port: ++port, publicHost: '', secret: 'key', autoStart: true, ...changes };
  const settingsService = {
    getOnlineSessionSettings: () => ({ ...settings }),
    setOnlineSessionSettings: (next: Partial<OnlineSessionSettings>) => { settings = { ...settings, ...next }; },
    getLaserPointerSettings: () => ({}),
  } as unknown as SettingsService;
  const app = { workspace: { on: () => ({}), offref: () => undefined } } as unknown as App;
  session = new OnlineSession(app, settingsService);
  return session;
}

afterEach(async () => {
  session?.stop();
  session = null;
  await new Promise<void>((resolve) => (blocker ? blocker.close(() => resolve()) : resolve()));
  blocker = null;
  Platform.isMobile = false;
  vi.mocked(Notice).mockClear();
});

describe('starting the online session when Atlas loads', () => {
  test('starts the server without a word when the GM wants it', async () => {
    const online = sessionWith({});
    await online.startAutomatically();
    expect(online.isRunning()).toBe(true);
    expect(onlineSessionStore.getState()).toMatchObject({ isRunning: true, failed: false });
    expect(Notice).not.toHaveBeenCalled();
  });

  test('leaves the server off when the GM switched it off, and on a phone or tablet', async () => {
    const off = sessionWith({ autoStart: false });
    await off.startAutomatically();
    expect(off.isRunning()).toBe(false);
    off.stop();

    Platform.isMobile = true;
    const mobile = sessionWith({});
    await mobile.startAutomatically();
    expect(mobile.isRunning()).toBe(false);
  });

  test('shows a taken port on the toolbar instead of a notice, and a later start tries again', async () => {
    const online = sessionWith({});
    const taken = port;
    blocker = createServer();
    await new Promise<void>((resolve) => blocker!.listen(taken, '0.0.0.0', resolve));
    await online.startAutomatically();
    expect(online.isRunning()).toBe(false);
    expect(onlineSessionStore.getState().failed).toBe(true);
    expect(Notice).not.toHaveBeenCalled();

    online.stop();
    expect(onlineSessionStore.getState().failed).toBe(false);
  });
});

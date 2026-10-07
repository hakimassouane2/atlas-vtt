import type { App, Plugin } from 'obsidian';
import type { LocalPlayerView } from '../../src/app/local-player-view';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { PlayerFrameSource } from '../../src/app/services/PlayerFrameMirror';
import type { FollowedScene } from '../../src/app/services/followedScene';

const followed = vi.hoisted(() => ({
  scene: null as FollowedScene | null,
  listeners: [] as Array<(scene: FollowedScene | null) => void>,
}));
vi.mock('../../src/app/services/followedScene', () => ({
  followedScene: () => followed.scene,
  nextFollowedScene: () => new Promise((resolve) => {
    if (followed.scene) resolve(followed.scene);
    else followed.listeners.push((scene) => { if (scene) resolve(scene); });
  }),
  onFollowedScene: (listener: (scene: FollowedScene | null) => void) => {
    followed.listeners.push(listener);
    return () => {};
  },
}));

const serviceMock = vi.hoisted(() => ({
  isWindowOpen: vi.fn(() => false),
  openPlayerWindow: vi.fn(),
  attachToView: vi.fn(),
  freezeCamera: vi.fn(),
  follow: vi.fn(),
}));
vi.mock('../../src/app/services/PlayerWindowService', () => {
  class PlayerWindowService {
    static getInstance(): PlayerWindowService {
      return new PlayerWindowService();
    }
    isWindowOpen = serviceMock.isWindowOpen;
    openPlayerWindow = serviceMock.openPlayerWindow;
    attachToView = serviceMock.attachToView;
    freezeCamera = serviceMock.freezeCamera;
    follow = serviceMock.follow;
    ownsView = (): boolean => false;
  }
  return { PlayerWindowService };
});

import { presentActiveTabInPlayerWindow, registerPlayerWindowFollow, restorePlayerWindow } from '../../src/app/services/PlayerWindowPresenter';

function scene(): FollowedScene {
  const source: PlayerFrameSource = { canvas: document.createElement('canvas'), withPlayerSafeFrame: vi.fn() };
  const view = {
    atlasStore: {},
    serviceManager: { getSettingsService: vi.fn(), getRendererService: () => ({ getViewport: () => undefined }) },
  };
  return { view, source } as unknown as FollowedScene;
}

const announce = (next: FollowedScene | null): void => {
  followed.scene = next;
  followed.listeners.forEach((listener) => listener(next));
};

describe('PlayerWindowPresenter', () => {
  beforeEach(() => {
    followed.scene = null;
    followed.listeners.length = 0;
    serviceMock.isWindowOpen.mockReturnValue(false);
    Object.values(serviceMock).forEach((fn) => fn.mockClear());
  });

  test('opens the player window on the scene the DM has open', async () => {
    followed.scene = scene();
    await presentActiveTabInPlayerWindow({} as App);
    expect(serviceMock.openPlayerWindow).toHaveBeenCalledWith(followed.scene.source);
  });

  test('opens nothing while no scene is open, nor a second window', async () => {
    await presentActiveTabInPlayerWindow({} as App);
    expect(serviceMock.openPlayerWindow).not.toHaveBeenCalled();

    followed.scene = scene();
    serviceMock.isWindowOpen.mockReturnValue(true);
    await presentActiveTabInPlayerWindow({} as App);
    expect(serviceMock.openPlayerWindow).not.toHaveBeenCalled();
  });

  test('restores a saved window onto the scene the DM opens, on the camera it was frozen on', async () => {
    const player = {
      getState: () => ({ frozen: true, camera: { centerX: 10, centerY: 20, scale: 2 } }),
      contentEl: document.createElement('div'),
      isClosed: false,
    };
    const restoring = restorePlayerWindow({} as App, player as unknown as LocalPlayerView);
    expect(serviceMock.attachToView).not.toHaveBeenCalled();

    const next = scene();
    announce(next);
    await restoring;

    expect(serviceMock.openPlayerWindow).not.toHaveBeenCalled();
    expect(serviceMock.attachToView).toHaveBeenCalledWith(player, next.source);
    expect(serviceMock.freezeCamera).toHaveBeenCalledWith({ centerX: 10, centerY: 20, scale: 2 });
  });

  test('the open window follows each scene, and none', () => {
    registerPlayerWindowFollow({ register: vi.fn() } as unknown as Plugin);
    const next = scene();
    announce(next);
    expect(serviceMock.follow).toHaveBeenLastCalledWith(next.source);
    announce(null);
    expect(serviceMock.follow).toHaveBeenLastCalledWith(null);
  });
});

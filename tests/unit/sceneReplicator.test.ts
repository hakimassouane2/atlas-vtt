import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSceneStore, type ViewAtlasStore } from '../../src/app/storeFactory';
import { SceneReplicator, type ReplicatedSource } from '../../src/app/online/scene/SceneReplicator';
import type { SettingsService } from '../../src/app/services/SettingsService';
import { DEFAULT_INITIATIVE_RULES } from '../../src/app/gameSystems/initiativeRules';

interface Sent {
  to: string;
  event: string;
  data: unknown;
}

const PLAYER_VIEW = { showGrid: true, showTokenNameplates: false };

function setup(): {
  replicator: SceneReplicator;
  store: ViewAtlasStore;
  source: ReplicatedSource;
  sent: Sent[];
  changeSettings: () => void;
  changeCollection: () => void;
} {
  const store = createSceneStore(`replicator-${Math.random()}`);
  store.getState().setPersistenceEnabled(false);
  store.getState().setMapPath('maps/cave.atlasmap');
  const settingsListeners = new Set<() => void>();
  const collectionListeners = new Set<() => void>();
  const settings = {
    getLocalPlayerViewSettings: () => PLAYER_VIEW,
    onChange: (listener: () => void) => {
      settingsListeners.add(listener);
      return () => settingsListeners.delete(listener);
    },
  } as unknown as SettingsService;
  const sent: Sent[] = [];
  const replicator = new SceneReplicator(settings, {
    toAll: (event, data) => sent.push({ to: 'all', event, data }),
    toPlayer: (to, event, data) => sent.push({ to, event, data }),
  });
  const source: ReplicatedSource = {
    store,
    collection: () => null,
    initiativeRules: () => ({ ...DEFAULT_INITIATIVE_RULES }),
    onCollectionChanged: (listener) => {
      collectionListeners.add(listener);
      return () => collectionListeners.delete(listener);
    },
  };
  return {
    replicator, store, source, sent,
    changeSettings: () => settingsListeners.forEach((listener) => listener()),
    changeCollection: () => collectionListeners.forEach((listener) => listener()),
  };
}

/** Runs the animation frame the replicator waits for. */
const nextFrame = async (): Promise<void> => { vi.advanceTimersToNextFrame(); };

describe('SceneReplicator', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends the context and the whole scene when a scene is presented', () => {
    const { replicator, source, sent } = setup();
    replicator.setSource(source);
    expect(sent.map(({ to, event }) => `${to}:${event}`)).toEqual(['all:context', 'all:scene']);
    expect(sent[0]!.data).toMatchObject({ collectionId: null, playerView: PLAYER_VIEW });
    expect(sent[1]!.data).toMatchObject({ mapPath: 'maps/cave.atlasmap' });
  });

  it('sends what changed once per frame, however many edits it held', async () => {
    const { replicator, source, sent, store } = setup();
    replicator.setSource(source);
    sent.length = 0;
    const [a, b] = store.getState().addTokens([{ kind: 'token', imagePath: 'a.png', x: 0, y: 0 }, { kind: 'token', imagePath: 'b.png', x: 70, y: 0 }] as never);
    store.getState().moveToken(a!, 140, 0);
    expect(sent).toEqual([]);

    await nextFrame();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'all', event: 'changes' });
    expect((sent[0]!.data as Array<{ id: string }>).map(({ id }) => id).sort()).toEqual([a, b].sort());
  });

  it('sends nothing while a map loads, and the scene whole once it has', async () => {
    const { replicator, source, sent, store } = setup();
    replicator.setSource(source);
    sent.length = 0;
    store.getState().setMapLoading(true);
    store.getState().clearMapState();
    await nextFrame();
    expect(sent).toEqual([]);

    store.getState().setMapLoading(false);
    await nextFrame();

    expect(sent.map(({ event }) => event)).toEqual(['context', 'scene']);
  });

  it('sends the context again when the player view settings or the collection change', () => {
    const { replicator, source, sent, changeSettings, changeCollection } = setup();
    replicator.setSource(source);
    sent.length = 0;
    changeSettings();
    changeCollection();
    expect(sent.map(({ event }) => event)).toEqual(['context', 'context']);
  });

  it('gives a player who joins the scene as it is now', () => {
    const { replicator, source, sent } = setup();
    replicator.setSource(source);
    sent.length = 0;
    replicator.sendTo('player-1');
    expect(sent.map(({ to, event }) => `${to}:${event}`)).toEqual(['player-1:context', 'player-1:scene']);
  });

  it('sends nothing more once the scene is held, and keeps no images', async () => {
    const { replicator, source, sent, store } = setup();
    replicator.setSource(source);
    replicator.setSource(null);
    sent.length = 0;
    store.getState().addTokens([{ kind: 'token', imagePath: 'a.png', x: 0, y: 0 }] as never);
    await nextFrame();
    replicator.sendTo('player-1');
    expect(sent).toEqual([]);
    expect(replicator.sentImages().size).toBe(0);
  });
});

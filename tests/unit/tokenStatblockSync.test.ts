import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import { createViewAtlasStore } from '../../src/app/storeFactory';
import { AssetService } from '../../src/app/services/AssetService';
import { TokenStatblockLinkService } from '../../src/app/services/TokenStatblockLinkService';
import { TokenStatblockSync } from '../../src/app/services/TokenStatblockSync';
import type { Character } from '../../src/app/types';
import { createInMemoryApp } from '../mocks/inMemoryVault';

const fillMissingResources = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../../src/app/resources/statblockResourceSync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/app/resources/statblockResourceSync')>()),
  fillMissingResources,
}));

const goblin: Character = {
  id: 'goblin', kind: 'character', imagePath: 'tokens/goblin.png', x: 0, y: 0,
  name: 'Gob', statblockPath: 'bestiary/goblin.md', difficulty: 2,
};

function setup(isPlayerView = false): { sync: TokenStatblockSync; store: ReturnType<typeof createViewAtlasStore>; eventBus: EventEmitter; app: ReturnType<typeof createInMemoryApp>['app'] } {
  const { app } = createInMemoryApp();
  const store = createViewAtlasStore(app, `statblock-sync-${Math.random()}`, undefined, isPlayerView);
  store.setState({ persistenceEnabled: false, objects: { ...store.getState().objects, tokens: { goblin } } });
  const eventBus = new EventEmitter();
  return { sync: new TokenStatblockSync(app, store, eventBus), store, eventBus, app };
}

describe('TokenStatblockSync', () => {
  beforeEach(() => {
    (AssetService as unknown as { instance: AssetService | null }).instance = null;
    fillMissingResources.mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('starts missing resources once the asset index is read and whenever a map loads', async () => {
    const { sync, eventBus } = setup();
    await vi.waitFor(() => expect(fillMissingResources).toHaveBeenCalledTimes(1));
    eventBus.emit('map-loaded');
    expect(fillMissingResources).toHaveBeenCalledTimes(2);
    sync.destroy();
  });

  it('leaves a player view\'s tokens alone', async () => {
    const { sync, eventBus } = setup(true);
    eventBus.emit('map-loaded');
    await Promise.resolve();
    expect(fillMissingResources).not.toHaveBeenCalled();
    sync.destroy();
  });

  it('clears the statblock data of every token with the artwork that was unlinked', () => {
    const { sync, store, app } = setup();
    TokenStatblockLinkService.getInstance(app).emit('link-changed', { type: 'unlinked', tokenImagePath: goblin.imagePath });
    const token = store.getState().objects.tokens.goblin as Character;
    expect(token.statblockPath).toBeUndefined();
    sync.destroy();
  });

  it('stops listening once destroyed', () => {
    const { sync, eventBus, app } = setup();
    sync.destroy();
    fillMissingResources.mockClear();
    eventBus.emit('map-loaded');
    expect(fillMissingResources).not.toHaveBeenCalled();
    expect(app.metadataCache.offref).toHaveBeenCalled();
    expect(app.workspace.offref).toHaveBeenCalled();
  });
});

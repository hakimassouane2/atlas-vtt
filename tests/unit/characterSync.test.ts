import { EventEmitter } from 'events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { createSceneStore, type ViewAtlasStore } from '../../src/app/storeFactory';
import { getHistoryStore } from '../../src/app/stores/history';
import { AssetService, type TokenAsset } from '../../src/app/services/AssetService';
import { CharacterSync } from '../../src/app/characters/CharacterSync';
import type { CharacterRecord, LibraryLook } from '../../src/app/characters/characterRecord';
import type { Character } from '../../src/app/types';
import { createInMemoryApp } from '../mocks/inMemoryVault';

const placement = (id: string, changes: Partial<Character> = {}): Character => ({
  id, kind: 'character', name: 'Hero', x: 0, y: 0, imagePath: 'hero.png', resources: { hp: { current: 20, max: 20 } }, ...changes,
});

/** Two open maps of one vault, whose library has the hero; records reach the other map as Atlas' event does. */
function setup(tokensA: Character[], tokensB: Character[]) {
  const { app } = createInMemoryApp();
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  app.workspace = {
    ...app.workspace,
    on: (name: string, listener: (...args: unknown[]) => void) => {
      listeners.set(name, [...(listeners.get(name) ?? []), listener]);
      return { name, listener };
    },
    offref: vi.fn(),
    trigger: (name: string, ...args: unknown[]) => listeners.get(name)?.forEach((listener) => listener(...args)),
  } as never;
  AssetService.resetInstance();
  const assets = AssetService.getInstance(app as App);
  const hero: TokenAsset = { id: 'hero', type: 'token', name: 'Hero', tags: [], collection: 'c', imagePath: 'hero.png', createdAt: 0, modifiedAt: 0 };
  vi.spyOn(assets, 'initialize').mockResolvedValue();
  vi.spyOn(assets, 'findTokenAssetByImagePath').mockImplementation((path) => (path === hero.imagePath ? hero : null));
  vi.spyOn(assets, 'setCharacter').mockImplementation((_id: string, record: CharacterRecord, { size, role, ringStyle }: LibraryLook) => {
    hero.character = record;
    if (size !== undefined) hero.size = size;
    if (role) hero.role = role;
    else delete hero.role;
    if (ringStyle) hero.ringStyle = ringStyle;
    else delete hero.ringStyle;
    app.workspace.trigger('atlas-vtt:character-changed', hero.imagePath);
  });
  const map = (tokens: Character[]): ViewAtlasStore => {
    const store = createSceneStore(`characters-${Math.random()}`);
    store.getState().setPersistenceEnabled(false);
    store.setState({ objects: { ...store.getState().objects, tokens: Object.fromEntries(tokens.map((token) => [token.id, token])) } });
    return store;
  };
  const a = map(tokensA);
  const b = map(tokensB);
  const syncs = [new CharacterSync(app as App, a, new EventEmitter()), new CharacterSync(app as App, b, new EventEmitter())];
  return { a, b, hero, syncs };
}

const settle = async (): Promise<void> => { await Promise.resolve(); await Promise.resolve(); };
const tokenOf = (store: ViewAtlasStore, id: string): Character => store.getState().objects.tokens[id] as Character;

afterEach(() => vi.restoreAllMocks());

describe('CharacterSync', () => {
  it('gives every placement on every open map what one of them is given', async () => {
    const { a, b, syncs } = setup([placement('a1'), placement('a2')], [placement('b1')]);
    a.getState().updateToken('a1', { controlledBy: ['alice'], ringColor: '#f00' });
    await settle();
    expect(tokenOf(a, 'a2')).toMatchObject({ controlledBy: ['alice'], ringColor: '#f00' });
    expect(tokenOf(b, 'b1')).toMatchObject({ controlledBy: ['alice'], ringColor: '#f00' });
    syncs.forEach((sync) => sync.destroy());
  });

  it('keeps hit points per placement unless the character is linked', async () => {
    const { a, b, syncs } = setup([placement('a1')], [placement('b1')]);
    a.getState().updateToken('a1', { resources: { hp: { current: 5, max: 20 } } });
    await settle();
    expect(tokenOf(b, 'b1').resources?.hp?.current).toBe(20);

    a.getState().updateToken('a1', { linked: true });
    await settle();
    expect(tokenOf(b, 'b1')).toMatchObject({ linked: true, resources: { hp: { current: 5, max: 20 } } });
    b.getState().updateToken('b1', { resources: { hp: { current: 2, max: 20 } }, conditions: ['prone'] });
    await settle();
    expect(tokenOf(a, 'a1')).toMatchObject({ resources: { hp: { current: 2, max: 20 } }, conditions: ['prone'] });
    syncs.forEach((sync) => sync.destroy());
  });

  it('gives a placement that appears what the character records, and leaves a character without a record alone', async () => {
    const { a, b, syncs } = setup([placement('a1', { ringColor: '#0f0' })], [placement('b1')]);
    await settle();
    expect(tokenOf(b, 'b1').ringColor).toBeUndefined();
    a.getState().updateToken('a1', { showNameplate: true });
    await settle();
    b.setState({ objects: { ...b.getState().objects, tokens: { ...b.getState().objects.tokens, b2: placement('b2') } } });
    await settle();
    expect(tokenOf(b, 'b2')).toMatchObject({ ringColor: '#0f0', showNameplate: true });
    syncs.forEach((sync) => sync.destroy());
  });

  it('gives every placement the role a placement is given, and records it on the library token', async () => {
    const { a, b, hero, syncs } = setup([placement('a1')], [placement('b1')]);
    a.getState().updateToken('a1', { role: 'pc' });
    await settle();
    expect(hero.role).toBe('pc');
    expect(tokenOf(b, 'b1').role).toBe('pc');
    syncs.forEach((sync) => sync.destroy());
  });

  it('gives a placement that appears its library token\'s role and ring, even without a record', async () => {
    const { b, hero, syncs } = setup([], [placement('b1')]);
    hero.role = 'npc';
    hero.ringStyle = 'gold.webp';
    b.setState({ objects: { ...b.getState().objects, tokens: { ...b.getState().objects.tokens, b2: placement('b2') } } });
    await settle();
    expect(tokenOf(b, 'b2')).toMatchObject({ role: 'npc', ringStyle: 'gold.webp' });
    expect(hero.character).toBeUndefined();
    syncs.forEach((sync) => sync.destroy());
  });

  it('follows the GM\'s undo everywhere, and adds no step of its own', async () => {
    const { a, b, syncs } = setup([placement('a1')], [placement('b1')]);
    const steps = getHistoryStore(b)!.getState().pastStates.length;
    a.getState().updateToken('a1', { ringColor: '#f00' });
    await settle();
    expect(tokenOf(b, 'b1').ringColor).toBe('#f00');
    expect(getHistoryStore(b)!.getState().pastStates).toHaveLength(steps);
    getHistoryStore(a)!.getState().undo();
    await settle();
    expect(tokenOf(b, 'b1').ringColor).toBeUndefined();
    syncs.forEach((sync) => sync.destroy());
  });
});

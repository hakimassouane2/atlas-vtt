import { describe, expect, it } from 'vitest';
import { assetFingerprint, fieldFingerprint } from '../../src/app/services/collectionBundle/fingerprints';
import { settingsFromBundle, withoutPlayers, withoutTableState } from '../../src/app/services/collectionBundle/bundleSettings';
import type { CollectionMetadata } from '../../src/app/services/AssetService';
import { HP, STR, STRESS } from '../mocks/resourceFixtures';

const collection = (settings: CollectionMetadata['settings']): CollectionMetadata => ({ id: 'Own', name: 'Own', settings } as CollectionMetadata);
const daggerheart = { conditions: [], systemPresetId: 'builtin:daggerheart', defaultWidgets: { hpBar: true, stressBar: true } };

describe('a collection\'s settings in a bundle', () => {
  it('count as unchanged when Atlas only stored the resources they already read as', async () => {
    const before = await fieldFingerprint(collection(daggerheart), 'settings');
    expect(await fieldFingerprint(collection({ ...daggerheart, resources: [HP, STRESS] }), 'settings')).toBe(before);
    // What players see is the table's choice, as the old player switch was
    expect(await fieldFingerprint(collection({ ...daggerheart, resources: [{ ...HP, visibleToPlayers: true }, STRESS] }), 'settings')).toBe(before);
  });

  it('count as changed when the GM changed the resources', async () => {
    const before = await fieldFingerprint(collection(daggerheart), 'settings');
    expect(await fieldFingerprint(collection({ ...daggerheart, resources: [HP, STRESS, STR] }), 'settings')).not.toBe(before);
    expect(await fieldFingerprint(collection({ ...daggerheart, resources: [HP] }), 'settings')).not.toBe(before);
  });

  it('keep the vault\'s resources when the bundle, written by an older Atlas, names none', () => {
    const mine = { ...daggerheart, resources: [{ ...HP, visibleToPlayers: true }, STRESS] };
    expect(settingsFromBundle({ ...daggerheart, lootCurrency: 'gp' }, mine)).toEqual({ ...daggerheart, lootCurrency: 'gp', resources: mine.resources });
    expect(settingsFromBundle({ ...daggerheart, resources: [HP] }, mine).resources).toEqual([HP]);
    expect(settingsFromBundle(daggerheart, undefined)).toEqual(daggerheart);
  });

  it('never carry the table\'s players: the vault keeps its own, and they are no edit', async () => {
    const players = [{ id: 'alice', name: 'Alice', color: '#3b82f6' }];
    expect(withoutPlayers({ ...daggerheart, players })).toEqual(daggerheart);
    expect(await fieldFingerprint(collection({ ...daggerheart, players }), 'settings'))
      .toBe(await fieldFingerprint(collection(daggerheart), 'settings'));
    expect(settingsFromBundle({ ...daggerheart, players: [{ id: 'bob', name: 'Bob', color: '#dc2626' }] }, { ...daggerheart, players }).players).toEqual(players);
    expect(settingsFromBundle({ ...daggerheart, players }, daggerheart).players).toBeUndefined();
  });

  it('never carry what the table\'s maps made of a character, and count it as no edit', async () => {
    const hero = { id: 'hero', type: 'token', name: 'Hero', tags: [], collection: 'Own', imagePath: 'hero.png', createdAt: 0, modifiedAt: 0 } as const;
    const played = { ...hero, character: { config: { controlledBy: ['alice'], linked: true }, state: { conditions: ['prone'] } } };
    expect(withoutTableState(played)).toEqual(hero);
    expect(await assetFingerprint(played)).toBe(await assetFingerprint(hero));
  });
});

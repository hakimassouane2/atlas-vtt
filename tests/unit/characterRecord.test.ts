import { describe, expect, it } from 'vitest';
import type { Character } from '../../src/app/types';
import { followRecord, recordOf } from '../../src/app/characters/characterRecord';
import { visibleResources } from '../../src/app/resources/visibleResources';
import { HP } from '../mocks/resourceFixtures';

const hero: Character = {
  id: 'h', kind: 'character', name: 'Hero', x: 0, y: 0, imagePath: 'hero.png',
  ringColor: '#f00', controlledBy: ['alice'], resources: { hp: { current: 7, max: 20 } }, conditions: ['prone'],
};

describe('a character\'s record', () => {
  it('holds its settings, and its state only while it is linked', () => {
    expect(recordOf(hero)).toEqual({ config: { ringColor: '#f00', controlledBy: ['alice'] } });
    expect(recordOf({ ...hero, linked: true })).toEqual({
      config: { ringColor: '#f00', controlledBy: ['alice'], linked: true },
      state: { resources: { hp: { current: 7, max: 20 } }, conditions: ['prone'] },
    });
  });

  it('keeps a maximum set by hand as a setting', () => {
    expect(recordOf({ ...hero, overriddenMax: ['hp'] }).config.maxima).toEqual({ hp: 20 });
  });

  it('brings a placement in line with its settings, leaving where it stands on its map', () => {
    const goblin: Character = { ...hero, ringColor: undefined, controlledBy: undefined, resources: { hp: { current: 3, max: 20 } } };
    expect(followRecord(goblin, recordOf(hero), undefined)).toEqual({ ringColor: '#f00', controlledBy: ['alice'] });
    expect(followRecord(hero, recordOf(hero), undefined)).toBeNull();
    expect(followRecord(hero, recordOf(hero), 2)).toEqual({ size: 2 });
  });

  it('gives a linked placement the character\'s resources and conditions', () => {
    const elsewhere: Character = { ...hero, linked: true, resources: { hp: { current: 20, max: 20 } }, conditions: undefined };
    expect(followRecord(elsewhere, recordOf({ ...hero, linked: true }), undefined))
      .toEqual({ resources: { hp: { current: 7, max: 20 } }, conditions: ['prone'] });
  });

  it('applies a maximum set by hand to an unlinked placement, within which its current value stays', () => {
    const record = recordOf({ ...hero, overriddenMax: ['hp'], resources: { hp: { current: 5, max: 5 } } });
    expect(followRecord(hero, record, undefined)).toEqual({ overriddenMax: ['hp'], resources: { hp: { current: 5, max: 5 } } });
  });
});

describe('which players see a token\'s bars', () => {
  const shown = [{ ...HP, visibleToPlayers: true }];
  it('shows them to every player, to the token\'s players only, or to none', () => {
    expect(visibleResources(hero, shown, 'player')).toHaveLength(1);
    expect(visibleResources({ ...hero, barsShownTo: 'controllers' }, shown, 'player')).toHaveLength(0);
    expect(visibleResources({ ...hero, barsShownTo: 'controllers' }, shown, 'controller')).toHaveLength(1);
    expect(visibleResources({ ...hero, barsShownTo: 'nobody' }, shown, 'controller')).toHaveLength(0);
    expect(visibleResources({ ...hero, barsShownTo: 'nobody' }, shown, 'dm')).toHaveLength(1);
  });
});

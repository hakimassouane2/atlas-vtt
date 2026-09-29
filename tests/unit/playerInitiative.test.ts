import { describe, expect, test } from 'vitest';
import type { AtlasSettings } from '../../src/app/services/SettingsService';
import type { ViewAtlasState } from '../../src/app/storeFactory';
import type { InitiativeEntry } from '../../src/app/types/initiativeTypes';
import { playerInitiative } from '../../src/app/online/playerInitiative';

const settings = { showInitiative: true, showTokenNameplates: true, showTokenHP: true } as AtlasSettings['localPlayerView'];

function entry(tokenId: string, order: number, isActive = false): InitiativeEntry {
  return {
    id: `entry-${tokenId}`, tokenId, name: tokenId, initiative: 20 - order, initiativeModifier: 0, hp: { current: 5, max: 10 },
    imagePath: `${tokenId}.png`, isActive, isDefeated: false, isNPC: false, order,
  } as InitiativeEntry;
}

function scene(overrides: Partial<ViewAtlasState> = {}): ViewAtlasState {
  return {
    initiativeTrackerOpen: true,
    initiative: { isActive: true, round: 2, entries: [entry('orc', 1, true), entry('hero', 0), entry('spy', 2)] },
    objects: { tokens: { hero: { id: 'hero' }, orc: { id: 'orc' }, spy: { id: 'spy', isHidden: true } } },
    ...overrides,
  } as unknown as ViewAtlasState;
}

describe('playerInitiative', () => {
  test('lists visible turns in order, with the active one', () => {
    expect(playerInitiative(scene(), settings)).toEqual({
      round: 2,
      isActive: true,
      entries: [
        { tokenId: 'hero', name: 'hero', initiative: 20, isActive: false, hp: { current: 5, max: 10 } },
        { tokenId: 'orc', name: 'orc', initiative: 19, isActive: true, hp: { current: 5, max: 10 } },
      ],
    });
  });

  test('leaves out names and hit points the player view hides', () => {
    const hidden = { ...settings, showTokenNameplates: false, showTokenHP: false };
    expect(playerInitiative(scene(), hidden)?.entries[0]).toMatchObject({ name: null, hp: null });
  });

  test('is null while the tracker is closed or hidden from players', () => {
    expect(playerInitiative(scene({ initiativeTrackerOpen: false }), settings)).toBeNull();
    expect(playerInitiative(scene(), { ...settings, showInitiative: false })).toBeNull();
  });
});

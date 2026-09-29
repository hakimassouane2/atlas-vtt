import { describe, expect, test } from 'vitest';
import type { AtlasSettings } from '../../src/app/services/SettingsService';
import type { ViewAtlasState } from '../../src/app/storeFactory';
import type { InitiativeEntry } from '../../src/app/types/initiativeTypes';
import { playerScene, sceneImagePaths } from '../../src/app/online/playerScene';

const settings = { showInitiative: true, showTokenNameplates: true, showTokenHP: true } as AtlasSettings['localPlayerView'];

function entry(tokenId: string, order: number): InitiativeEntry {
  return {
    id: `entry-${tokenId}`, tokenId, name: tokenId, initiative: 20 - order, initiativeModifier: 0, hp: { current: 5, max: 10 },
    imagePath: `${tokenId}.png`, statblockPath: `${tokenId}.md`, isActive: false, isDefeated: false, isNPC: false, order,
  } as InitiativeEntry;
}

const state = {
  initiativeTrackerOpen: true,
  initiative: { isActive: true, round: 2, entries: [entry('orc', 1), entry('hero', 0), entry('spy', 2)] },
  objects: {
    tokens: {
      hero: { id: 'hero', kind: 'character', imagePath: 'hero.png', showRing: false, x: 0, y: 0 },
      orc: { id: 'orc', kind: 'token', imagePath: 'orc.png', x: 0, y: 0 },
      spy: { id: 'spy', kind: 'token', imagePath: 'spy.png', isHidden: true, x: 0, y: 0 },
    },
  },
} as unknown as ViewAtlasState;

describe('playerScene', () => {
  test('keeps only the tokens and turns players can see', () => {
    const scene = playerScene(state, settings);
    expect(Object.keys(scene.objects.tokens)).toEqual(['hero', 'orc']);
    expect(scene.objects.tokens.hero).toEqual({ id: 'hero', kind: 'character', imagePath: 'hero.png', showRing: false });
    expect(scene.initiative?.entries.map((turn) => turn.tokenId)).toEqual(['hero', 'orc']);
    expect(scene.initiative?.entries[0]?.statblockPath).toBeUndefined();
  });

  test('leaves out the names and hit points the player view hides', () => {
    const scene = playerScene(state, { ...settings, showTokenNameplates: false, showTokenHP: false });
    expect(scene.initiative?.entries[0]).toMatchObject({ name: '', hp: { current: 0, max: 0 } });
  });

  test('lists the artwork players may load', () => {
    expect([...sceneImagePaths(playerScene(state, settings))].sort()).toEqual(['hero.png', 'orc.png']);
  });
});

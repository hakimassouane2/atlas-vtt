import { describe, expect, test } from 'vitest';
import { playerTokenUISettings } from '../../src/app/pixi/token-renderer/playerTokenUISettings';
import type { Character } from '../../src/app/types';

const hidden = { showTokenHP: false, showTokenStress: false, showTokenNameplates: false };
const hero = { id: 'hero', kind: 'character', name: 'Hero', x: 0, y: 0, imagePath: 'hero.png', playerLinked: true } as Character;
const orc = { ...hero, id: 'orc', playerLinked: false };

describe('playerTokenUISettings', () => {
  test('shows the bars of tokens players control', () => {
    expect(playerTokenUISettings(hero, hidden)).toMatchObject({ showTokenHP: true, showTokenStress: true });
  });

  test('leaves other tokens to the player view settings', () => {
    expect(playerTokenUISettings(orc, hidden)).toEqual(hidden);
    expect(playerTokenUISettings(orc, { ...hidden, showTokenHP: true }).showTokenHP).toBe(true);
  });

  test('shows the nameplates the DM shows', () => {
    expect(playerTokenUISettings({ ...orc, showNameplate: true }, hidden).showTokenNameplates).toBe(true);
    expect(playerTokenUISettings(orc, hidden).showTokenNameplates).toBe(false);
  });
});

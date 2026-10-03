import { describe, expect, test } from 'vitest';
import { playerTokenUISettings } from '../../src/app/pixi/token-renderer/playerTokenUISettings';
import type { Character } from '../../src/app/types';

const orc = { id: 'orc', kind: 'character', name: 'Orc', x: 0, y: 0, imagePath: 'orc.png' } as Character;

describe('playerTokenUISettings', () => {
  test('shows the nameplates the DM shows', () => {
    expect(playerTokenUISettings({ ...orc, showNameplate: true }, { showTokenNameplates: false }).showTokenNameplates).toBe(true);
    expect(playerTokenUISettings(orc, { showTokenNameplates: false }).showTokenNameplates).toBe(false);
  });

  test('follows the player view setting otherwise', () => {
    expect(playerTokenUISettings(orc, { showTokenNameplates: true }).showTokenNameplates).toBe(true);
  });
});

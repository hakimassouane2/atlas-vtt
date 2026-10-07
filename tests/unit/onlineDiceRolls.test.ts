import { describe, expect, test, vi } from 'vitest';
import { EventEmitter } from 'events';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { ViewAtlasState } from '../../src/app/storeFactory';
import { DiceTool, type DiceRollResult } from '../../src/app/tools/DiceTool';
import { rollAuthor } from '../../src/app/tools/rollAuthor';
import { playerRollStamp } from '../../src/app/online/rollStamps';
import { parsePlayerCommand } from '../../src/app/online/playerCommands';
import { PlayerDiceLog } from '../../src/app/online/PlayerDiceLog';
import { PlayerControls, type CommandSource } from '../../src/app/online/PlayerControls';
import type { PlayerProfile } from '../../src/app/types/collectionSettingsTypes';
import { RESOURCE_COLORS } from '../../src/app/resources/resourceColors';

const alice: PlayerProfile = { id: 'alice', name: 'Alice', color: '#3b82f6', diceLook: { colour: 'accent', font: 'scifi' } };
const bob: PlayerProfile = { id: 'bob', name: 'Bob', color: RESOURCE_COLORS[0]!.value };

function roll(fields: Partial<DiceRollResult>): DiceRollResult {
  return { id: 'r', timestamp: 0, formula: '1d20', rolls: [], modifiers: 0, total: 1, ...fields };
}

describe('who rolled', () => {
  test("a player's roll is signed with their profile and thrown in its look, accent dice in its colour", () => {
    const stamp = playerRollStamp(alice);
    expect(stamp).toEqual({
      roller: { profileId: 'alice', name: 'Alice', color: '#3b82f6' },
      look: { colour: 'accent', font: 'scifi', accent: '#3b82f6' },
      shownToPlayers: true,
    });
    expect(playerRollStamp(null).roller).toEqual({ name: 'Player' });
  });

  test('the DM engine stamps its own rolls and takes a player\'s stamp as given', () => {
    const tool = new DiceTool(new EventEmitter(), undefined, () => ({ look: { colour: 'dark', font: 'medieval' }, shownToPlayers: false }));
    expect(tool.rollDice('1d6')).toMatchObject({ look: { colour: 'dark' }, shownToPlayers: false });
    expect(tool.rollDice('1d6').roller).toBeUndefined();
    expect(tool.rollDice('1d6', undefined, playerRollStamp(alice))).toMatchObject({ roller: { name: 'Alice' }, shownToPlayers: true });
  });

  test('a roll is shown as its character, else its player, else the DM; older rolls name nobody', () => {
    const roller = { profileId: 'alice', name: 'Alice', color: '#3b82f6' };
    expect(rollAuthor(roll({ roller, shownToPlayers: true, source: { type: 'statblock', tokenName: 'Thorin' } })))
      .toEqual({ name: 'Thorin', color: '#3b82f6' });
    expect(rollAuthor(roll({ roller, shownToPlayers: true }))).toEqual({ name: 'Alice', color: '#3b82f6' });
    expect(rollAuthor(roll({ shownToPlayers: false, source: { type: 'statblock', tokenName: 'Goblin' } }))).toEqual({ name: 'Goblin' });
    expect(rollAuthor(roll({ shownToPlayers: false }))).toEqual({ name: 'GM' });
    expect(rollAuthor(roll({}))).toBeNull();
  });
});

describe('dice the player chooses', () => {
  test('a well-formed look is a command; anything else is not', () => {
    expect(parsePlayerCommand({ type: 'diceLook', look: { colour: 'dark', font: 'scifi' } })).toEqual({ type: 'diceLook', look: { colour: 'dark', font: 'scifi' } });
    expect(parsePlayerCommand({ type: 'diceLook', look: { colour: 'gold', font: 'scifi' } })).toBeNull();
    expect(parsePlayerCommand({ type: 'diceLook' })).toBeNull();
  });

  function source(updateProfile = vi.fn()): CommandSource {
    return {
      store: createStore(() => ({ isMapLoading: false, objects: { tokens: {} } })) as unknown as StoreApi<ViewAtlasState>,
      grid: () => null,
      conditions: () => [],
      resources: () => [],
      players: () => [alice, bob],
      updateProfile,
    };
  }

  test("is kept in the player's profile, and only for a player who chose one", () => {
    const save = vi.fn();
    const controls = new PlayerControls(() => true);
    controls.setSource(source(save));
    const command = { type: 'diceLook', look: { colour: 'dark', font: 'medieval' } };
    expect(controls.apply(command, 'page', null)).toBe(false);
    expect(controls.apply(command, 'page', 'alice')).toBe(true);
    expect(save).toHaveBeenCalledWith('alice', { diceLook: { colour: 'dark', font: 'medieval' } });
  });

  test("a player takes a colour of the palette that no other player has", () => {
    const save = vi.fn();
    const controls = new PlayerControls(() => true);
    controls.setSource(source(save));
    expect(parsePlayerCommand({ type: 'color', color: '#123456' })).toBeNull();
    expect(controls.apply({ type: 'color', color: bob.color }, 'page', 'alice')).toBe(false);
    const free = RESOURCE_COLORS.find(({ value }) => value !== bob.color && value !== alice.color)!.value;
    expect(controls.apply({ type: 'color', color: free }, 'page', 'alice')).toBe(true);
    expect(save).toHaveBeenCalledWith('alice', { color: free });
  });

  test('a roll reaches the engine with the profile of the player who made it', () => {
    const rollDice = vi.fn(() => true);
    const controls = new PlayerControls(rollDice);
    controls.setSource(source());
    controls.apply({ type: 'roll', formula: '1d20' }, 'page', 'alice');
    expect(rollDice).toHaveBeenCalledWith('1d20', undefined, alice);
  });
});

describe('the dice log players see', () => {
  function sceneStore(diceLog: DiceRollResult[]): StoreApi<ViewAtlasState> {
    return createStore(() => ({ diceLog, objects: { tokens: { orc: { id: 'orc', isHidden: true } } } })) as unknown as StoreApi<ViewAtlasState>;
  }

  test('holds the rolls players were shown, masked, and follows the log as it changes', () => {
    const toAll = vi.fn();
    const log = new PlayerDiceLog({ toAll, toPlayer: vi.fn() }, () => undefined);
    const shown = roll({ id: 'a', shownToPlayers: true, source: { type: 'statblock', tokenId: 'orc', tokenName: 'Orc' } });
    const secret = roll({ id: 'b', shownToPlayers: false });
    const store = sceneStore([shown, secret]);
    log.setStore(store);
    expect(toAll).toHaveBeenLastCalledWith('diceLog', [{ ...shown, source: { type: 'statblock' } }]);
    store.setState({ diceLog: [] });
    expect(toAll).toHaveBeenLastCalledWith('diceLog', []);
    log.setStore(null);
    store.setState({ diceLog: [shown] });
    expect(toAll).toHaveBeenLastCalledWith('diceLog', []);
  });

  test('is sent to a page that joins', () => {
    const toPlayer = vi.fn();
    const log = new PlayerDiceLog({ toAll: vi.fn(), toPlayer }, () => undefined);
    log.setStore(sceneStore([roll({ shownToPlayers: true })]));
    log.sendTo('page');
    expect(toPlayer).toHaveBeenCalledWith('page', 'diceLog', [roll({ shownToPlayers: true })]);
  });
});

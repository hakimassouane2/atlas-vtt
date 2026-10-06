import { describe, expect, it, vi } from 'vitest';
import { createSceneStore } from '../../src/app/storeFactory';
import { CommandBridge, commandsFor } from '../../src/app/online/client/commandBridge';
import type { Character, TokenEntity } from '../../src/app/types';

const hero: Character = {
  id: 'hero', kind: 'character', name: 'Hero', x: 35, y: 35, imagePath: 'hero.png', controlledBy: ['alice'],
  resources: { hp: { current: 10, max: 20 } }, conditions: ['frightened'], conditionValues: { frightened: 2 },
};
const goblin: TokenEntity = { id: 'goblin', kind: 'token', imagePath: 'goblin.png', x: 105, y: 35 };

describe('commandsFor', () => {
  it('asks for a drag while the pointer holds the token, and for a drop once it lets go', () => {
    expect(commandsFor(hero, { ...hero, x: 50 }, true)).toEqual([{ type: 'drag', id: 'hero', x: 50, y: 35 }]);
    expect(commandsFor(hero, { ...hero, x: 50 }, false)).toEqual([{ type: 'move', id: 'hero', x: 50, y: 35 }]);
  });

  it('asks for the rotation, resources and conditions that changed', () => {
    const changed: Character = {
      ...hero, rotation: 45, resources: { hp: { current: 7, max: 20 } },
      conditions: ['frightened', 'prone'], conditionValues: { frightened: 1 },
    };
    expect(commandsFor(hero, changed, false)).toEqual([
      { type: 'rotate', id: 'hero', rotation: 45 },
      { type: 'resource', id: 'hero', key: 'hp', current: 7 },
      { type: 'condition', id: 'hero', conditionId: 'prone', active: true },
      { type: 'conditionValue', id: 'hero', conditionId: 'frightened', delta: -1 },
    ]);
    expect(commandsFor(changed, { ...changed, conditions: ['prone'] }, false)).toEqual([
      { type: 'condition', id: 'hero', conditionId: 'frightened', active: false },
    ]);
  });
});

function setup(accepted = true) {
  const store = createSceneStore(`bridge-${Math.random()}`, { isPlayerView: true });
  store.getState().setPersistenceEnabled(false);
  const send = vi.fn(async () => accepted);
  const resync = vi.fn();
  const bridge = new CommandBridge(store, (token) => token.controlledBy?.includes('alice') === true, send, resync);
  bridge.applyRemote(() => store.setState({ objects: { ...store.getState().objects, tokens: { hero, goblin } } }));
  return { store, send, resync, bridge };
}

describe('CommandBridge', () => {
  it('sends the player edits on their tokens, and nothing the DM sent', () => {
    const { store, send } = setup();
    expect(send).not.toHaveBeenCalled();
    store.getState().updateToken('hero', { rotation: 90 });
    expect(send).toHaveBeenCalledWith({ type: 'rotate', id: 'hero', rotation: 90 });
  });

  it('sends nothing for a token the player does not control', () => {
    const { store, send } = setup();
    store.getState().moveToken('goblin', 175, 35);
    expect(send).not.toHaveBeenCalled();
  });

  it('puts the scene back as the DM sent it when a command is refused', async () => {
    const { store, resync } = setup(false);
    store.getState().updateToken('hero', { rotation: 90 });
    await vi.waitFor(() => expect(resync).toHaveBeenCalledOnce());
  });
});

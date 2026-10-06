import { beforeEach, describe, expect, it } from 'vitest';
import { ProfileChoice } from '../../src/app/online/client/profileChoice';

const alice = { id: 'alice', name: 'Alice', color: '#3b82f6' };
const bob = { id: 'bob', name: 'Bob', color: '#f59e0b' };

describe('the player page\'s profile', () => {
  beforeEach(() => window.localStorage.clear());

  it('asks until the player chooses, and remembers the choice per collection', () => {
    const choice = new ProfileChoice();
    expect(choice.getState().players).toBeNull();
    choice.setCollection('campaign', [alice, bob]);
    expect(choice.profileId()).toBeNull();
    choice.choose('bob');
    expect(choice.profileId()).toBe('bob');

    const later = new ProfileChoice();
    later.setCollection('campaign', [alice, bob]);
    expect(later.profileId()).toBe('bob');
    later.setCollection('other', [alice]);
    expect(later.profileId()).toBeNull();
    later.setCollection('campaign', [alice, bob]);
    expect(later.profileId()).toBe('bob');
  });

  it('asks again when the collection no longer has the profile, and follows a rename', () => {
    const choice = new ProfileChoice();
    choice.setCollection('campaign', [alice, bob]);
    choice.choose('alice');
    choice.setCollection('campaign', [{ ...alice, name: 'Alicia' }, bob]);
    expect(choice.getState().chosen?.name).toBe('Alicia');
    choice.setCollection('campaign', [bob]);
    expect(choice.profileId()).toBeNull();
  });

  it('opens the choice again from the menu and keeps the profile when closed', () => {
    const choice = new ProfileChoice();
    choice.setCollection('campaign', [alice, bob]);
    choice.choose('alice');
    choice.chooseAgain();
    expect(choice.getState().choosing).toBe(true);
    choice.keep();
    expect(choice.getState()).toMatchObject({ choosing: false, chosen: alice });
  });
});

import { describe, expect, it } from 'vitest';
import { collectionPlayers, controllersOf, newPlayerProfile, withController } from '../../src/app/players/playerProfiles';
import { ConnectedPlayers, parseProfileChoice } from '../../src/app/online/connectedPlayers';

const alice = { id: 'alice', name: 'Alice', color: '#3b82f6' };
const bob = { id: 'bob', name: 'Bob', color: '#f59e0b' };

describe('player profiles', () => {
  it('reads only the stored entries that are profiles', () => {
    expect(collectionPlayers({ players: [alice, { id: 3 }, null, bob] as never })).toEqual([alice, bob]);
    expect(collectionPlayers({})).toEqual([]);
    expect(collectionPlayers(null)).toEqual([]);
  });

  it('gives a new player the first colour no other player has', () => {
    expect(newPlayerProfile([]).color).toBe('#3b82f6');
    expect(newPlayerProfile([alice]).color).toBe('#f59e0b');
    expect(newPlayerProfile([alice, bob]).id).not.toBe(newPlayerProfile([alice, bob]).id);
  });

  it('gives a token to players and takes it back, leaving no empty list', () => {
    const token = { controlledBy: ['alice'] };
    expect(withController(token, 'bob', true)).toEqual(['alice', 'bob']);
    expect(withController(token, 'alice', true)).toEqual(['alice']);
    expect(withController(token, 'alice', false)).toBeUndefined();
    expect(controllersOf({ controlledBy: 'alice' as never })).toEqual([]);
  });
});

describe('connected players', () => {
  it('reads a page\'s choice: a profile id or none', () => {
    expect(parseProfileChoice({ profile: 'alice' })).toBe('alice');
    expect(parseProfileChoice({ profile: null })).toBeNull();
    expect(parseProfileChoice({ profile: '' })).toBeUndefined();
    expect(parseProfileChoice({ profile: 'x'.repeat(101) })).toBeUndefined();
    expect(parseProfileChoice('alice')).toBeUndefined();
  });

  it('keeps each page\'s profile and lists the profiles someone plays, once each', () => {
    const connected = new ConnectedPlayers();
    connected.join('page-1');
    connected.join('page-2');
    connected.join('page-3');
    expect(connected.choose('page-1', 'bob')).toBe(true);
    expect(connected.choose('page-2', 'bob')).toBe(true);
    expect(connected.choose('stranger', 'alice')).toBe(false);
    expect(connected.profileOf('page-1')).toBe('bob');
    expect(connected.profileOf('page-3')).toBeNull();
    expect(connected.connectedProfiles([alice, bob])).toEqual([bob]);
    connected.leave('page-1');
    connected.leave('page-2');
    expect(connected.connectedProfiles([alice, bob])).toEqual([]);
    expect(connected.count).toBe(1);
  });
});

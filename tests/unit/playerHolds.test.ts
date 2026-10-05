import { describe, expect, it } from 'vitest';
import { HOLD_MS, PlayerHolds } from '../../src/app/online/playerHolds';

describe('PlayerHolds', () => {
  it('keeps a dragged token for the player who drags it until they drop it', () => {
    const holds = new PlayerHolds();
    holds.take('wolf', 'alice', 0);
    expect(holds.allows('wolf', 'alice', 10)).toBe(true);
    expect(holds.allows('wolf', 'bob', 10)).toBe(false);
    holds.release('wolf');
    expect(holds.allows('wolf', 'bob', 20)).toBe(true);
  });

  it('lets go of a token whose player stopped moving it or left', () => {
    const holds = new PlayerHolds();
    holds.take('wolf', 'alice', 0);
    expect(holds.allows('wolf', 'bob', HOLD_MS + 1)).toBe(true);
    holds.take('wolf', 'alice', 0);
    holds.releasePlayer('alice');
    expect(holds.allows('wolf', 'bob', 1)).toBe(true);
  });

  it('holds nothing for a page without an id', () => {
    const holds = new PlayerHolds();
    holds.take('wolf', null, 0);
    expect(holds.allows('wolf', 'bob', 1)).toBe(true);
  });
});

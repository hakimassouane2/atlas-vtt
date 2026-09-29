import { EventEmitter } from 'events';
import { describe, expect, test, vi } from 'vitest';
import { DiceTool } from '../../src/app/tools/DiceTool';

describe('DiceTool modifiers', () => {
  test.each([
    ['2d6+1d8', 0],
    ['1d20+5', 5],
    ['1d20 - 2', -2],
    ['2d6+12d4+3', 3],
  ])('%s has a modifier of %i', (formula, modifiers) => {
    vi.spyOn(document, 'dispatchEvent').mockReturnValue(true);
    expect(new DiceTool(new EventEmitter()).rollDice(formula).modifiers).toBe(modifiers);
  });
});

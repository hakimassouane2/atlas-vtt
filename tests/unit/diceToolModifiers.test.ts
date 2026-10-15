import { EventEmitter } from 'events';
import { describe, expect, test } from 'vitest';
import { DiceTool } from '../../src/app/tools/DiceTool';
import { DEFAULT_DICE_RULES } from '../../src/app/gameSystems/diceRules';

const inputs = { random: Math.random, rollId: (): string => 'test-roll', roller: (): string => 'Player', onFormulaError: (): void => {} };

describe('DiceTool modifiers', () => {
  test.each([
    ['2d6+1d8', 0],
    ['1d20+5', 5],
    ['1d20 - 2', -2],
    ['2d6+12d4+3', 3],
  ])('%s has a modifier of %i', (formula, modifiers) => {
    expect(new DiceTool(new EventEmitter(), () => DEFAULT_DICE_RULES, inputs).rollDice(formula)?.modifiers).toBe(modifiers);
  });
});

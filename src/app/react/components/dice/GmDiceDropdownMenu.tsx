import React from 'react';
import type { DiceTool } from '../../../tools/DiceTool';
import { advantageSidesFor, ruledSides } from '../../../tools/diceAdvantage';
import { useShareRolls } from '../../hooks/useShareRolls';
import { DiceDropdownMenu, type DiceDropdownMenuProps } from './DiceDropdownMenu';
import type { TrayAdvantage } from './DiceTray';

type GmDiceDropdownMenuProps = Omit<DiceDropdownMenuProps, 'roll' | 'advantage' | 'shareRolls'> & { diceTool: DiceTool };

/** What advantage the collection's dice set offers the tray; undefined where it has no rule. */
function trayAdvantage(diceTool: DiceTool): TrayAdvantage | undefined {
  const rules = diceTool.rollingDice();
  const sides = ruledSides(rules);
  return sides.length > 0 ? { sides, applies: (formula) => advantageSidesFor(formula, rules).length > 0 } : undefined;
}

/** The GM's dice tray: rolls with the view's dice tool, offers its set's advantage and the public-rolls switch. */
export function GmDiceDropdownMenu({ diceTool, ...menu }: GmDiceDropdownMenuProps): React.ReactElement | null {
  const shareRolls = useShareRolls();
  return (
    <DiceDropdownMenu
      {...menu}
      roll={(formula, side) => (side ? diceTool.rollDice(formula, undefined, undefined, { advantage: side }) : diceTool.rollDice(formula)) !== null}
      advantage={() => trayAdvantage(diceTool)}
      shareRolls={shareRolls}
    />
  );
}

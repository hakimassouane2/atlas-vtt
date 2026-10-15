import React, { useEffect, useRef } from 'react';
import { cn } from 'src/utils/cn';
import { useKeepInView } from '../../../packages/components/primitives/useKeepInView';
import type { AdvantageSide } from '../../../types/diceSetTypes';
import { DiceTray, type ShareRolls, type TrayAdvantage } from './DiceTray';
import { useDiceEnvironment } from './diceEnvironment';
import { diceFontClass, useDiceLook } from '../../hooks/useDiceLook';

export interface DiceDropdownMenuProps {
  /**
   * Rolls the tray's formula, with the side of advantage chosen for it: the GM's dice engine,
   * or a player's request to the DM's Atlas. False when nothing was rolled (a formula refused).
   */
  roll: (formula: string, advantage: AdvantageSide | null) => boolean | void;
  isOpen: boolean;
  onToggle: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  /** What advantage the dice set offers, read as the tray opens; left out where it has no rule. */
  advantage?: (() => TrayAdvantage | undefined) | undefined;
  /** The GM's switch for whether players see their rolls; left out where nobody else watches. */
  shareRolls?: ShareRolls | null | undefined;
}

export function DiceDropdownMenu({ roll, isOpen, onToggle, triggerRef, advantage: readAdvantage, shareRolls }: DiceDropdownMenuProps): React.ReactElement | null {
  const trayRef = useRef<HTMLDivElement>(null);
  const look = useDiceLook(useDiceEnvironment().settings);
  const keepInView = useKeepInView(trayRef, isOpen, 'top');
  // Read as the tray opens: it unmounts when closed, so a set changed meanwhile is read anew.
  const advantage = isOpen ? readAdvantage?.() : undefined;

  // ── Click-outside ────────────────────────────

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as HTMLElement;
      if (triggerRef?.current?.contains(target)) return;
      if (target.closest('.atlas-dice-tray')) return;
      onToggle();
    };

    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onToggle, triggerRef]);

  // Hangs from its toolbar button inside the map view, like the other toolbar
  // dropdowns: it stays in the view's stacking order, so the DM dashboard and
  // the asset manager cover it. Closed, the tray unmounts and forgets its dice.
  if (!isOpen) return null;
  return (
    <div
      ref={trayRef}
      className={cn('atlas-dice-tray', diceFontClass(look), keepInView.capped && 'atlas-keep-in-view--capped')}
      style={keepInView.style}
    >
      <div className="atlas-dice-panel">
        <DiceTray
          onRoll={(formula, side) => {
            if (roll(formula, side) === false) return false;
            onToggle();
            return true;
          }}
          advantage={advantage}
          {...(shareRolls && { shareRolls })}
        />
      </div>
    </div>
  );
}

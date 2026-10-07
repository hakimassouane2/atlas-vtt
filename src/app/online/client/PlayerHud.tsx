import React, { useRef, useState } from 'react';
import { Dices } from 'lucide-react';
import type { ViewAtlasStore } from '../../storeFactory';
import type { NavigationInputMode } from '../../services/SettingsService';
import type { TokenEntity } from '../../types';
import { TooltipProvider } from '../../packages/components/primitives/tooltip';
import { ToolButton } from '../../packages/components/primitives/ToolButton';
import { ResponsiveToolbar } from '../../packages/components/toolbar/ResponsiveToolbar';
import type { ResponsiveToolbarItem } from '../../packages/components/toolbar/toolbarTypes';
import { BottomToolbarRow } from '../../react/components/BottomToolbarRow';
import { DiceDropdownMenu } from '../../react/components/dice/DiceDropdownMenu';
import { PlayerSettingsMenu } from './PlayerSettingsMenu';
import { storeInputDevice, storedInputDevice } from './inputDevice';
import type { ProfileChoice } from './profileChoice';

interface PlayerHudProps {
  store: ViewAtlasStore;
  /** Who the player is; the settings menu lets them choose again. */
  choice: ProfileChoice;
  controls: (token: TokenEntity) => boolean;
  /** Rolls `formula` with the DM's dice engine, for the token `tokenId` when given. */
  roll: (formula: string, tokenId: string | undefined) => void;
  /** Makes the map's zoom and pan follow `mode`. */
  setInputDevice: (mode: NavigationInputMode) => void;
}

/** The player's toolbar over the canvas page, in the shape of the GM's: the dice tray and their settings. */
export function PlayerHud({ store, choice, controls, roll, setInputDevice }: PlayerHudProps): React.ReactElement {
  const [diceOpen, setDiceOpen] = useState(false);
  const [inputDevice, setInputDeviceState] = useState(storedInputDevice);
  const diceButtonRef = useRef<HTMLDivElement>(null);

  /** A roll is the selected token's when the player selected one of theirs. */
  const rollerId = (): string | undefined => {
    const { selectedIds, objects } = store.getState();
    return selectedIds.map((id) => objects.tokens[id]).find((token) => token && controls(token))?.id;
  };
  const toggleDice = (): void => setDiceOpen((open) => !open);
  const changeInputDevice = (mode: NavigationInputMode): void => {
    storeInputDevice(mode);
    setInputDeviceState(mode);
    setInputDevice(mode);
  };

  const items: ResponsiveToolbarItem[] = [
    {
      id: 'dice',
      kind: 'button',
      // The dice tray hangs from this button
      pinned: diceOpen,
      active: diceOpen,
      element: (
        <div ref={diceButtonRef} className="relative flex items-center">
          <ToolButton icon={Dices} label="Roll Dice" isActive={diceOpen} onClick={toggleDice} />
          <DiceDropdownMenu roll={(formula) => roll(formula, rollerId())} isOpen={diceOpen} onToggle={toggleDice} triggerRef={diceButtonRef} />
        </div>
      ),
      menuEntry: { icon: Dices, label: 'Roll Dice', isActive: diceOpen, onSelect: toggleDice },
    },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <BottomToolbarRow>
        <ResponsiveToolbar items={items} end={<PlayerSettingsMenu choice={choice} inputDevice={inputDevice} onInputDeviceChange={changeInputDevice} />} />
      </BottomToolbarRow>
    </TooltipProvider>
  );
}

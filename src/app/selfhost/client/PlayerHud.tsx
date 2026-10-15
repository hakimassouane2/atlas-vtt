import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Dices, Flashlight, ScrollText } from 'lucide-react';
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
import type { PageDiceLog } from './pageDiceLog';
import type { DiceLook } from '../../dice3d/diceLook';
import { t } from '../../i18n';
import { DEFAULT_MAP_HOTKEYS, formatHotkey, matchesHotkey } from '../../keyboard/mapHotkeys';
import { isTyping } from './dom';

interface PlayerHudProps {
  store: ViewAtlasStore;
  /** Who the player is; the settings menu lets them choose again. */
  choice: ProfileChoice;
  controls: (token: TokenEntity) => boolean;
  /** Rolls `formula` with the DM's dice engine, for the token `tokenId` when given. */
  roll: (formula: string, tokenId: string | undefined) => void;
  /** The table's dice log, which a button opens. */
  diceLog: PageDiceLog;
  /** Keeps the dice the player chose in their profile. */
  setDiceLook: (look: DiceLook) => void;
  /** Keeps the colour the player chose in their profile. */
  setColor: (color: string) => void;
  /** Makes the map's zoom and pan follow `mode`. */
  setInputDevice: (mode: NavigationInputMode) => void;
}

/**
 * The laser pointer is on for the player who chose who they play: everyone else at the table sees it,
 * named by their profile. The move key switches it on and off, as on the GM's map.
 */
function useLaserPointer(store: ViewAtlasStore, choice: ProfileChoice): { on: boolean; mayPoint: boolean; toggle: () => void } {
  const on = useSyncExternalStore(store.subscribe, () => store.getState().activeTool === 'laser-pointer');
  const mayPoint = useSyncExternalStore(choice.subscribe, () => choice.getState().chosen !== null);
  const toggle = (): void => {
    const { activeTool, setActiveTool } = store.getState();
    setActiveTool(activeTool === 'laser-pointer' || !mayPoint ? 'move' : 'laser-pointer');
  };

  // A player who is no one any more has nobody to point as
  useEffect(() => {
    if (!mayPoint && store.getState().activeTool === 'laser-pointer') store.getState().setActiveTool('move');
  }, [mayPoint, store]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!matchesHotkey(event, DEFAULT_MAP_HOTKEYS.move) || isTyping(event)) return;
      event.preventDefault();
      toggle();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  return { on, mayPoint, toggle };
}

/** The player's toolbar over the canvas page, in the shape of the GM's: the laser, the dice tray, the dice log and their settings. */
export function PlayerHud({ store, choice, controls, roll, diceLog, setDiceLook, setColor, setInputDevice }: PlayerHudProps): React.ReactElement {
  const [diceOpen, setDiceOpen] = useState(false);
  const logOpen = useSyncExternalStore(diceLog.subscribe, () => diceLog.getState().open);
  const diceButtonRef = useRef<HTMLDivElement>(null);
  const laser = useLaserPointer(store, choice);
  const laserLabel = t('toolbar.laser');
  const laserKey = formatHotkey(DEFAULT_MAP_HOTKEYS.move);

  /** A roll is the selected token's when the player selected one of theirs. */
  const rollerId = (): string | undefined => {
    const { selectedIds, objects } = store.getState();
    return selectedIds.map((id) => objects.tokens[id]).find((token) => token && controls(token))?.id;
  };
  const toggleDice = (): void => setDiceOpen((open) => !open);
  const changeInputDevice = (mode: NavigationInputMode): void => {
    storeInputDevice(mode);
    setInputDevice(mode);
  };

  const items: ResponsiveToolbarItem[] = [
    {
      id: 'laser',
      kind: 'button',
      pinned: false,
      active: laser.on,
      element: (
        <ToolButton
          icon={Flashlight}
          label={laserLabel}
          shortcut={laserKey}
          subtitle={laser.mayPoint ? 'Everyone sees it. Holding the middle mouse button points too.' : 'Choose who you play to point.'}
          isActive={laser.on}
          disabled={!laser.mayPoint}
          onClick={laser.toggle}
        />
      ),
      menuEntry: { icon: Flashlight, label: laserLabel, shortcut: laserKey, isActive: laser.on, onSelect: laser.toggle },
    },
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
    {
      id: 'diceLog',
      kind: 'button',
      pinned: false,
      active: logOpen,
      element: <ToolButton icon={ScrollText} label="Dice roll log" shortcut="Enter" isActive={logOpen} onClick={diceLog.toggle} />,
      menuEntry: { icon: ScrollText, label: 'Dice roll log', isActive: logOpen, onSelect: diceLog.toggle },
    },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <BottomToolbarRow>
        <ResponsiveToolbar items={items} end={<PlayerSettingsMenu choice={choice} inputDevice={storedInputDevice} onInputDeviceChange={changeInputDevice} onDiceLookChange={setDiceLook} onColorChange={setColor} />} />
      </BottomToolbarRow>
    </TooltipProvider>
  );
}

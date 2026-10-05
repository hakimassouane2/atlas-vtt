import React, { useRef, useState, useSyncExternalStore } from 'react';
import { Crosshair, Dices, Users } from 'lucide-react';
import type { ViewAtlasStore } from '../../storeFactory';
import type { ResourceDefinition } from '../../resources/resourceTypes';
import type { TokenEntity } from '../../types';
import { TooltipProvider } from '../../packages/components/primitives/tooltip';
import { ToolButton } from '../../packages/components/primitives/ToolButton';
import { ResponsiveToolbar } from '../../packages/components/toolbar/ResponsiveToolbar';
import type { ResponsiveToolbarItem } from '../../packages/components/toolbar/toolbarTypes';
import { BottomToolbarRow } from '../../react/components/BottomToolbarRow';
import { DiceDropdownMenu } from '../../react/components/dice/DiceDropdownMenu';
import type { PageCamera } from './pageCamera';
import { PartyPanel } from './PartyPanel';

interface PlayerHudProps {
  store: ViewAtlasStore;
  camera: PageCamera;
  controls: (token: TokenEntity) => boolean;
  resources: () => readonly ResourceDefinition[];
  /** Rolls `formula` with the DM's dice engine, for the token `tokenId` when given. */
  roll: (formula: string, tokenId: string | undefined) => void;
  /** Selects the token and brings it into view. */
  focus: (token: TokenEntity) => void;
}

/**
 * The player's controls over the canvas page, in the shape of the GM's: the toolbar along the
 * bottom (recenter on the DM's view, the party, the dice tray) and the party panel.
 */
export function PlayerHud({ store, camera, controls, resources, roll, focus }: PlayerHudProps): React.ReactElement {
  const [partyOpen, setPartyOpen] = useState(true);
  const [diceOpen, setDiceOpen] = useState(false);
  const diceButtonRef = useRef<HTMLDivElement>(null);
  const following = useSyncExternalStore(
    (onChange) => camera.onFollowingChange(onChange),
    () => camera.isFollowing(),
  );

  /** A roll is the selected token's when the player selected one of theirs. */
  const rollerId = (): string | undefined => {
    const { selectedIds, objects } = store.getState();
    return selectedIds.map((id) => objects.tokens[id]).find((token) => token && controls(token))?.id;
  };
  const toggleDice = (): void => setDiceOpen((open) => !open);
  const toggleParty = (): void => setPartyOpen((open) => !open);
  const recenter = (): void => {
    camera.recenter();
  };

  const items: ResponsiveToolbarItem[] = [
    {
      id: 'recenter',
      priority: 90,
      pinned: false,
      element: <ToolButton icon={Crosshair} label="Recenter on the GM's view" isActive={false} disabled={following} onClick={recenter} />,
      menuEntry: { icon: Crosshair, label: "Recenter on the GM's view", isActive: false, onSelect: recenter },
    },
    {
      id: 'party',
      priority: 80,
      pinned: false,
      element: <ToolButton icon={Users} label="Party" isActive={partyOpen} onClick={toggleParty} />,
      menuEntry: { icon: Users, label: 'Party', isActive: partyOpen, onSelect: toggleParty },
    },
    {
      id: 'dice',
      priority: 100,
      // The dice tray hangs from this button
      pinned: diceOpen,
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
      {following && <div className="atlas-player-following">The GM guides your camera</div>}
      {partyOpen && <PartyPanel store={store} controls={controls} resources={resources} focus={focus} />}
      <BottomToolbarRow>
        <ResponsiveToolbar items={items} />
      </BottomToolbarRow>
    </TooltipProvider>
  );
}

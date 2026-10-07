import React, { createElement, useRef } from 'react';
import { Settings } from 'lucide-react';
import type { NavigationInputMode } from '../../services/SettingsService';
import { ToolButton } from '../../packages/components/primitives/ToolButton';
import { INPUT_MODE_LABELS } from '../../settings/navigationSettingsSection';
import { PlayerDot } from '../../players/PlayerDot';
import { RESOURCE_COLORS } from '../../resources/resourceColors';
import { DICE_COLOUR_OPTIONS, DICE_FONT_OPTIONS, readDiceLook, type DiceLook } from '../../dice3d/diceLook';
import { openContextMenuGlobal, type ContextMenuEntry } from '../../ui/contextMenus';
import type { ProfileChoice } from './profileChoice';

const MENU_LABEL = 'Settings';
const DEVICE_ICONS: Record<NavigationInputMode, string> = { mouse: 'mouse', trackpad: 'touchpad' };
/** A player's accent dice take their profile's colour (`playerRollStamp`). */
const DICE_COLOURS = DICE_COLOUR_OPTIONS.map((option) => (option.value === 'accent' ? { ...option, label: 'My colour' } : option));

interface PlayerSettingsMenuProps {
  /** Who the player is, which they may change here. */
  choice: ProfileChoice;
  inputDevice: () => NavigationInputMode;
  onInputDeviceChange: (mode: NavigationInputMode) => void;
  /** Keeps the dice the player chose in their profile, which every roll of theirs is thrown in. */
  onDiceLookChange: (look: DiceLook) => void;
  /** Keeps the colour the player chose in their profile. */
  onColorChange: (color: string) => void;
}

/**
 * The player's own settings, as Atlas' menus are built on the DM's side: one submenu per setting
 * (who they play, their colour, their dice, their input device), so the menu stays a short list.
 */
export function PlayerSettingsMenu(props: PlayerSettingsMenuProps): React.ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const open = (): void => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) openContextMenuGlobal(settingsEntries(props), { x: rect.left, y: rect.top });
  };
  return (
    <div ref={rootRef} className="relative flex items-center">
      <ToolButton icon={Settings} label={MENU_LABEL} isActive={false} onClick={open} />
    </div>
  );
}

function settingsEntries({ choice, inputDevice, onInputDeviceChange, onDiceLookChange, onColorChange }: PlayerSettingsMenuProps): ContextMenuEntry[] {
  const subscribe = choice.subscribe;
  const entries: ContextMenuEntry[] = [];
  const { players, chosen } = choice.getState();

  if (players?.length) {
    entries.push({
      type: 'submenu',
      label: chosen ? `Playing as ${chosen.name || 'Unnamed player'}` : 'Choose player',
      icon: 'user-round',
      subscribe,
      children: () => {
        const state = choice.getState();
        return (state.players ?? []).map((player) => ({
          type: 'item' as const,
          label: player.name || 'Unnamed player',
          checked: player.id === state.chosen?.id,
          leading: createElement(PlayerDot, { player }),
          onClick: () => choice.choose(player.id),
        }));
      },
    });
  }

  if (chosen) {
    entries.push({
      type: 'submenu',
      label: 'My colour',
      icon: 'palette',
      subscribe,
      // The colours no other player has: players tell each other apart by them
      children: () => {
        const { players: all, chosen: me } = choice.getState();
        return RESOURCE_COLORS
          .filter(({ value }) => !all?.some(({ id, color }) => id !== me?.id && color.toLowerCase() === value.toLowerCase()))
          .map(({ value, label }) => ({
            type: 'item' as const,
            label,
            checked: value.toLowerCase() === me?.color.toLowerCase(),
            leading: createElement(PlayerDot, { player: { color: value } }),
            onClick: () => onColorChange(value),
          }));
      },
    });
    entries.push({
      type: 'submenu',
      label: 'My dice',
      icon: 'dices',
      subscribe,
      children: () => {
        const look = readDiceLook(choice.getState().chosen?.diceLook);
        return [
          ...DICE_COLOURS.map(({ value, label }) => ({
            type: 'item' as const,
            label,
            checked: look.colour === value,
            keepOpen: true,
            onClick: () => onDiceLookChange({ ...look, colour: value }),
          })),
          { type: 'separator' as const },
          ...DICE_FONT_OPTIONS.map(({ value, label }) => ({
            type: 'item' as const,
            label: `${label} numbers`,
            checked: look.font === value,
            keepOpen: true,
            onClick: () => onDiceLookChange({ ...look, font: value }),
          })),
        ];
      },
    });
  }

  entries.push({ type: 'separator' }, {
    type: 'submenu',
    label: 'Input device',
    icon: DEVICE_ICONS[inputDevice()],
    children: (Object.keys(INPUT_MODE_LABELS) as NavigationInputMode[]).map((mode) => ({
      type: 'item' as const,
      label: INPUT_MODE_LABELS[mode],
      icon: DEVICE_ICONS[mode],
      checked: inputDevice() === mode,
      onClick: () => onInputDeviceChange(mode),
    })),
  });
  return entries;
}

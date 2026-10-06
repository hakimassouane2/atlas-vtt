import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Mouse, Settings, Touchpad, UserRound } from 'lucide-react';
import { cn } from 'src/utils/cn';
import type { NavigationInputMode } from '../../services/SettingsService';
import { ToolButton } from '../../packages/components/primitives/ToolButton';
import { DropdownMenuItem } from '../../packages/components/primitives/DropdownMenuItem';
import { useKeepInView } from '../../packages/components/primitives/useKeepInView';
import { INPUT_MODE_LABELS } from '../../settings/navigationSettingsSection';
import { PlayerDot } from '../../players/PlayerDot';
import type { ProfileChoice } from './profileChoice';

const MENU_LABEL = 'Settings';
const DEVICE_ICONS: Record<NavigationInputMode, React.ComponentType<{ className?: string }>> = {
  mouse: Mouse,
  trackpad: Touchpad,
};

interface PlayerSettingsMenuProps {
  /** Who the player is, which they may change here. */
  choice: ProfileChoice;
  inputDevice: NavigationInputMode;
  onInputDeviceChange: (mode: NavigationInputMode) => void;
}

/** The player's own settings, in a menu hanging from the toolbar like the GM's tool menus. */
export function PlayerSettingsMenu({ choice, inputDevice, onInputDeviceChange }: PlayerSettingsMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const { players, chosen } = useSyncExternalStore(choice.subscribe, choice.getState);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const keepInView = useKeepInView(menuRef, open, 'top');

  // A press anywhere else or Escape closes the menu
  useEffect(() => {
    const root = rootRef.current;
    if (!open || !root) return undefined;
    const onPointerDown = (event: PointerEvent): void => {
      if (!root.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex items-center">
      <ToolButton icon={Settings} label={MENU_LABEL} isActive={open} menuExpanded={open} onClick={() => setOpen((wasOpen) => !wasOpen)} />
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={MENU_LABEL}
          className={cn(
            'atlas-dropdown-content atlas-dropdown-content--top atlas-dropdown-content--right min-w-[220px]',
            keepInView.capped && 'atlas-keep-in-view--capped',
          )}
          style={keepInView.style}
        >
          {!!players?.length && (
            <div className="atlas-dropdown-section">
              <span className="atlas-dropdown-label atlas-player-menu-label">
                {chosen && <PlayerDot player={chosen} />}
                {chosen ? `Playing as ${chosen.name || 'Unnamed player'}` : 'No player chosen'}
              </span>
              <DropdownMenuItem
                role="menuitem"
                icon={UserRound}
                label="Change player"
                onClick={() => {
                  setOpen(false);
                  choice.chooseAgain();
                }}
              />
            </div>
          )}
          <div className="atlas-dropdown-section">
            <span className="atlas-dropdown-label">Input device</span>
            {(Object.keys(INPUT_MODE_LABELS) as NavigationInputMode[]).map((mode) => (
              <DropdownMenuItem
                key={mode}
                role="menuitem"
                icon={DEVICE_ICONS[mode]}
                label={INPUT_MODE_LABELS[mode]}
                isActive={inputDevice === mode}
                onClick={() => onInputDeviceChange(mode)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

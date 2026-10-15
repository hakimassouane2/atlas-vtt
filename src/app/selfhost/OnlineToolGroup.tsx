import React from 'react';
import { Copy, Globe, Power } from 'lucide-react';
import { useStore } from 'zustand';
import { cn } from 'src/utils/cn';
import { DropdownMenuItem } from '../packages/components/primitives/DropdownMenuItem';
import { ToolGroup, type ToolGroupControls } from '../packages/components/toolbar/ToolGroup';
import type { ToolbarContext } from '../packages/components/toolbar/toolbarContext';
import type { ToolbarItemBody } from '../packages/components/toolbar/toolbarItems';
import { OnlineConnections } from './OnlineConnections';
import type { OnlineControl } from './onlineControl';
import { onlineSessionStore, type OnlineSessionState } from './OnlineSession';

const LABEL = 'Copy player link';

/** The globe, in the session's state: dimmed while stopped, red when the port was taken, with the players connected. */
function OnlineIcon({ className }: { className?: string }): React.ReactElement {
  const { isRunning, failed, playerCount } = useStore(onlineSessionStore);
  return (
    <span className={cn('atlas-online-icon', isRunning && 'is-running', failed && 'is-failed')}>
      <Globe className={className} />
      {isRunning && playerCount > 0 && <span className="atlas-online-icon__count">{playerCount}</span>}
    </span>
  );
}

/** One line on the session for the menu's top. */
function sessionStatus(session: OnlineSessionState): React.ReactNode {
  if (session.isRunning) return <OnlineConnections playerCount={session.playerCount} players={session.players} />;
  if (session.failed) return 'Could not open the port for players. Is another program using it? Copying the link tries again.';
  return 'Not running. Copying the link starts it.';
}

interface OnlineToolGroupProps extends ToolGroupControls {
  online: OnlineControl;
  shortcut: string;
}

/** The online session in the GM's toolbar: a click copies the link, the chevron or a right-click opens its menu. */
export function OnlineToolGroup({ online, shortcut, menuOpen, toggleMenu, closeMenu }: OnlineToolGroupProps): React.ReactElement {
  const { session } = online;
  const act = (action: () => void) => (): void => {
    closeMenu();
    action();
  };
  return (
    <div
      className="atlas-online-tool"
      onContextMenu={(event) => {
        event.preventDefault();
        toggleMenu();
      }}
    >
      <ToolGroup
        face={{ icon: OnlineIcon, label: LABEL, isActive: session.isRunning }}
        shortcut={shortcut}
        menuLabel="Online session"
        menuOpen={menuOpen}
        onSelect={online.copyLink}
        onMenuToggle={toggleMenu}
      >
        <div className="atlas-dropdown-section">
          <span className="atlas-dropdown-label atlas-online-tool__status">
            {sessionStatus(session)}
          </span>
        </div>
        <div className="atlas-dropdown-section">
          <DropdownMenuItem icon={Copy} label={LABEL} shortcut={shortcut} onClick={act(online.copyLink)} />
          <DropdownMenuItem icon={Power} label="Stop online session" disabled={!session.isRunning} onClick={act(online.stop)} />
        </div>
      </ToolGroup>
    </div>
  );
}

/** The control's item: pinned while its menu is open, which hangs from it. */
export function onlineToolbarItem(ctx: ToolbarContext): ToolbarItemBody {
  const menuOpen = ctx.openMenu === 'online';
  const shortcut = ctx.hotkeyLabel('online');
  return {
    kind: 'group',
    pinned: menuOpen,
    active: menuOpen,
    element: <OnlineToolGroup {...ctx.groupControls('online')} online={ctx.online} shortcut={shortcut} />,
    menuEntry: { icon: Globe, label: LABEL, shortcut, isActive: ctx.online.session.isRunning, onSelect: ctx.online.copyLink },
  };
}

import React from 'react';
import { Globe } from 'lucide-react';
import { useStore } from 'zustand';
import { Button } from '../packages/components/primitives/button';
import { OnlineSession, onlineSessionStore } from './OnlineSession';
import { OnlineConnections } from './OnlineConnections';

/** The dashboard's online session button: starts the session and copies the player link, and says who is connected. */
export function OnlineDashboardAction(): React.JSX.Element {
  const online = useStore(onlineSessionStore);
  return (
    <Button variant="ghost" className="dashboard-topbar__action" onClick={() => void OnlineSession.getInstance()?.startAndCopyLink()}>
      <Globe />
      <span>
        {online.isRunning
          ? <OnlineConnections playerCount={online.playerCount} players={online.players} hint="copy link" />
          : 'Online session'}
      </span>
    </Button>
  );
}

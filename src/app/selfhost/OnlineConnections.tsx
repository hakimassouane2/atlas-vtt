import React from 'react';
import type { PlayerProfile } from '../types/collectionSettingsTypes';
import { PlayerDot } from '../players/PlayerDot';

interface OnlineConnectionsProps {
  /** Pages connected with the player link. */
  playerCount: number;
  /** The profiles someone at those pages chose. */
  players: readonly PlayerProfile[];
  /** What a click does, after the players (the dashboard's tile). */
  hint?: string;
}

/** Who is connected to the online session: the players by name, else how many pages. */
export function OnlineConnections({ playerCount, players, hint }: OnlineConnectionsProps): React.ReactElement {
  const suffix = hint ? ` · ${hint}` : '';
  if (players.length === 0) {
    return <>{`${playerCount} player${playerCount === 1 ? '' : 's'} connected${suffix}`}</>;
  }
  return (
    <span className="atlas-online-connections">
      {players.map((player) => (
        <span key={player.id} className="atlas-online-connections__player">
          <PlayerDot player={player} />
          {player.name || 'Unnamed player'}
        </span>
      ))}
      {hint && <span>{`· ${hint}`}</span>}
    </span>
  );
}

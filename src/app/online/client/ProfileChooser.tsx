import React, { useSyncExternalStore } from 'react';
import { PlayerDot } from '../../players/PlayerDot';
import type { ProfileChoice } from './profileChoice';

/**
 * Asks the player who they are, over the map they already see, while they have no profile of the
 * presented scene's collection; the settings menu changes it afterwards. A collection without
 * profiles asks nothing; a line says so, and the player acts on no token.
 */
export function ProfileChooser({ choice }: { choice: ProfileChoice }): React.ReactElement | null {
  const { players, chosen } = useSyncExternalStore(choice.subscribe, choice.getState);

  if (players && players.length === 0) {
    return <div className="atlas-profile-notice" role="status">The GM has not created any players yet.</div>;
  }
  if (!players || chosen) return null;
  return (
    <div className="atlas-profile-chooser">
      <div className="atlas-profile-chooser__panel" role="dialog" aria-modal="true" aria-labelledby="atlas-profile-chooser-title">
        <h2 id="atlas-profile-chooser-title" className="atlas-profile-chooser__title">Who are you?</h2>
        {players.map((player) => (
          <button key={player.id} type="button" className="atlas-profile-chooser__player" onClick={() => choice.choose(player.id)}>
            <PlayerDot player={player} />
            {player.name || 'Unnamed player'}
          </button>
        ))}
      </div>
    </div>
  );
}

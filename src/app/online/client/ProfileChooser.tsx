import React, { useEffect, useSyncExternalStore } from 'react';
import { PlayerDot } from '../../players/PlayerDot';
import type { ProfileChoice } from './profileChoice';

/**
 * Asks the player who they are, over the map they already see: when they have no profile of the
 * presented scene's collection yet, or when they asked from the settings menu. A collection
 * without profiles asks nothing; a line says so, and the player acts on no token.
 */
export function ProfileChooser({ choice }: { choice: ProfileChoice }): React.ReactElement | null {
  const { players, chosen, choosing } = useSyncExternalStore(choice.subscribe, choice.getState);
  const open = !!players?.length && (!chosen || choosing);

  // Asked again from the menu, Escape keeps the profile; a first choice cannot be put off
  useEffect(() => {
    if (!open || !chosen) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') choice.keep();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, chosen, choice]);

  if (players && players.length === 0) {
    return <div className="atlas-profile-notice" role="status">The GM has not created any players yet.</div>;
  }
  if (!open) return null;
  return (
    <div className="atlas-profile-chooser" onClick={() => choice.keep()}>
      <div className="atlas-profile-chooser__panel" role="dialog" aria-modal="true" aria-labelledby="atlas-profile-chooser-title"
        onClick={(event) => event.stopPropagation()}>
        <h2 id="atlas-profile-chooser-title" className="atlas-profile-chooser__title">Who are you?</h2>
        {players.map((player) => (
          <button key={player.id} type="button" className="atlas-profile-chooser__player"
            aria-current={player.id === chosen?.id ? 'true' : undefined} onClick={() => choice.choose(player.id)}>
            <PlayerDot player={player} />
            {player.name || 'Unnamed player'}
          </button>
        ))}
      </div>
    </div>
  );
}

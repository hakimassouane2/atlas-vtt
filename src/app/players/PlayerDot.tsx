import React from 'react';
import type { PlayerProfile } from '../types/collectionSettingsTypes';

/** A player's colour as a small dot before their name. */
export function PlayerDot({ player }: { player: Pick<PlayerProfile, 'color'> }): React.ReactElement {
  return <span className="atlas-player-dot" style={{ backgroundColor: player.color }} aria-hidden="true" />;
}

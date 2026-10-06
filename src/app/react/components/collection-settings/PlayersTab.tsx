/**
 * PlayersTab — the people at the table. An online player picks one of these profiles on
 * joining and acts on the tokens it is given (Edit Token, or the token menu's Players).
 */

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../packages/components/primitives/button';
import { LabelTooltip } from '../../../packages/components/primitives/tooltip';
import { DropdownSwatchGrid } from '../../../packages/components/primitives/DropdownSwatchGrid';
import { RESOURCE_COLORS } from '../../../resources/resourceColors';
import { newPlayerProfile } from '../../../players/playerProfiles';
import { PlayerDot } from '../../../players/PlayerDot';
import type { PlayerProfile } from '../../../types/collectionSettingsTypes';

interface PlayersTabProps {
  players: PlayerProfile[];
  onChange: (players: PlayerProfile[]) => void;
}

export function PlayersTab({ players, onChange }: PlayersTabProps): React.ReactElement {
  /** The player whose colours are open. */
  const [pickingId, setPickingId] = useState<string | null>(null);

  const update = (id: string, changes: Partial<PlayerProfile>): void =>
    onChange(players.map((player) => (player.id === id ? { ...player, ...changes } : player)));

  return (
    <>
      <p className="atlas-csm-hint">
        The people at your table. Online players choose one of these when they open the
        player link, and move only the tokens you give them: in Edit Token, or with
        Players in the token&apos;s menu. Deleting a player leaves their tokens to nobody.
      </p>

      {players.length > 0 ? (
        <div className="atlas-csm-condition-list">
          {players.map((player) => (
            <div key={player.id} className="atlas-csm-condition">
              <div className="atlas-csm-condition-row">
                <LabelTooltip label="Choose colour">
                  <button
                    type="button"
                    className="atlas-csm-condition-badge-button atlas-csm-player-colour"
                    aria-label="Choose colour"
                    aria-expanded={pickingId === player.id}
                    onClick={() => setPickingId(pickingId === player.id ? null : player.id)}
                  >
                    <PlayerDot player={player} />
                  </button>
                </LabelTooltip>
                <input
                  type="text"
                  className="atlas-csm-input"
                  placeholder="Player name"
                  aria-invalid={player.name.trim() === '' ? true : undefined}
                  value={player.name}
                  onChange={(e) => update(player.id, { name: e.target.value })}
                />
                <LabelTooltip label="Remove player">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="atlas-csm-condition-delete"
                    aria-label="Remove player"
                    onClick={() => onChange(players.filter(({ id }) => id !== player.id))}
                  >
                    <Trash2 />
                  </Button>
                </LabelTooltip>
              </div>
              {pickingId === player.id && (
                <DropdownSwatchGrid label="Colour" swatches={RESOURCE_COLORS} value={player.color}
                  onChange={(color) => update(player.id, { color })} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="atlas-csm-empty">No players yet</div>
      )}

      <Button variant="ghost" className="atlas-csm-add-btn" onClick={() => onChange([...players, newPlayerProfile(players)])}>
        <Plus />
        Add Player
      </Button>
    </>
  );
}

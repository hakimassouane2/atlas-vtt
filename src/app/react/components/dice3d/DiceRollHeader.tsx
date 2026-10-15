import React from 'react';
import { TokenPortrait } from '../../../packages/components/shared/TokenPortrait';
import type { DiceRollResult } from '../../../types/diceTypes';
import type { RollSourcePresentation, UseDiceAvatar } from '../dice/diceSourcePresentation';
import { rollAuthor } from '../../../tools/rollAuthor';

interface DiceRollHeaderProps {
  result: DiceRollResult;
  /** Who the roll names; unset looks it up as the GM's window does. */
  presentation?: RollSourcePresentation | null | undefined;
  label: string;
  /** Finds the portrait; called once per render. */
  useAvatar: UseDiceAvatar;
}

/**
 * The portrait of the token that rolled, when it has one, who rolled (in the player's
 * colour, so players at the table tell their rolls apart) and what they rolled.
 */
export function DiceRollHeader({ result, presentation, label, useAvatar }: DiceRollHeaderProps): React.ReactElement {
  const avatar = useAvatar(result.source, presentation);
  const presented = presentation !== undefined;
  const name = presented ? presentation?.name : result.source?.tokenName;
  // A presented roll names exactly its own name, or nobody.
  const author = presented ? (name ? { name } : null) : rollAuthor(result);
  return (
    <span className="atlas-dice-roll__who">
      {avatar && (
        <TokenPortrait
          className="atlas-dice-roll__avatar"
          src={avatar.src}
          alt={name ?? ''}
          showRing={avatar.showRing}
          ringColor={avatar.ringColor}
          ring={avatar.ring}
        />
      )}
      <span className="atlas-dice-roll__names">
        {author && (
          <span className="atlas-dice-roll__author" style={author.color ? { color: author.color } : undefined}>{author.name}</span>
        )}
        <span className="atlas-dice-roll__label">{label}</span>
      </span>
    </span>
  );
}

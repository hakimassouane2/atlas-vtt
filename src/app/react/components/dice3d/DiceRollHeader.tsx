import React from 'react';
import { TokenPortrait } from '../../../packages/components/shared/TokenPortrait';
import type { DiceRollResult } from '../../../tools/DiceTool';
import { useDiceAvatar } from '../dice/useDiceAvatar';
import { rollAuthor } from '../../../tools/rollAuthor';

interface DiceRollHeaderProps {
  result: DiceRollResult;
  label: string;
}

/**
 * The portrait of the token that rolled, when it has one, who rolled (in the player's
 * colour, so players at the table tell their rolls apart) and what they rolled.
 */
export function DiceRollHeader({ result, label }: DiceRollHeaderProps): React.ReactElement {
  const avatar = useDiceAvatar(result.source);
  const author = rollAuthor(result);
  return (
    <span className="atlas-dice-roll__who">
      {avatar && (
        <TokenPortrait
          className="atlas-dice-roll__avatar"
          src={avatar.src}
          alt={result.source?.tokenName ?? ''}
          showRing={avatar.showRing}
          ringColor={avatar.ringColor}
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

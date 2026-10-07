import React from 'react';
import { cn } from '../../../../utils/cn';
import { DICE_COLOUR_OPTIONS, type DiceColour } from '../../../dice3d/diceLook';

interface DiceColourStripProps {
  value: DiceColour;
  /** Rendered d20s per colour; a colour without one shows an empty well while it renders. */
  previews: Partial<Record<DiceColour, string>>;
  onChange: (colour: DiceColour) => void;
  /** The colours and their labels; Atlas' own by default. */
  options?: readonly { value: DiceColour; label: string }[];
}

/** The dice colours side by side, each as the d20 it gives, to click. */
export function DiceColourStrip({ value, previews, onChange, options = DICE_COLOUR_OPTIONS }: DiceColourStripProps): React.ReactElement {
  return (
    <div className="atlas-dice-colour-strip" role="radiogroup" aria-label="Dice colour">
      {options.map((option) => {
        const preview = previews[option.value];
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={cn('atlas-dice-colour-strip__option', active && 'atlas-active')}
            onClick={() => onChange(option.value)}
          >
            {preview
              ? <img className="atlas-dice-colour-strip__die" src={preview} alt="" draggable={false} />
              : <span className="atlas-dice-colour-strip__die atlas-dice-colour-strip__die--pending" aria-hidden="true" />}
            <span className="atlas-dice-colour-strip__label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

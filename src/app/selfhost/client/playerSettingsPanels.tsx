import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { DropdownSwatchGrid } from '../../packages/components/primitives/DropdownSwatchGrid';
import { SegmentedControl } from '../../packages/components/primitives/SegmentedControl';
import { DiceColourStrip } from '../../react/components/command-palette/DiceColourStrip';
import { RESOURCE_COLORS } from '../../resources/resourceColors';
import { renderDicePreviews } from '../../dice3d/diceLookRuntime';
import { DICE_COLOUR_OPTIONS, DICE_FONT_OPTIONS, parseHex, readDiceLook, type DiceColour, type DiceFont, type DiceLook } from '../../dice3d/diceLook';
import type { ProfileChoice } from './profileChoice';

/** A player's accent dice take their profile's colour (`playerRollStamp`). */
const PLAYER_DICE_COLOURS = DICE_COLOUR_OPTIONS.map((option) => (option.value === 'accent' ? { ...option, label: 'My colour' } : option));

/** The player's colour, as the grid of the GM's Players tab: the colours no other player has, since players tell each other apart by them. */
export function PlayerColourPanel({ choice, onChange }: { choice: ProfileChoice; onChange: (color: string) => void }): React.ReactElement | null {
  const { players, chosen } = useSyncExternalStore(choice.subscribe, choice.getState);
  if (!chosen) return null;
  const free = RESOURCE_COLORS.filter(({ value }) =>
    !players?.some(({ id, color }) => id !== chosen.id && color.toLowerCase() === value.toLowerCase()));
  return (
    <div className="atlas-player-settings-panel atlas-player-settings-panel--colour">
      <DropdownSwatchGrid label="My colour" swatches={free} value={chosen.color} onChange={onChange} />
    </div>
  );
}

/** The player's dice, as the GM's dice settings show them: a d20 in each colour, and the numbers. */
export function PlayerDicePanel({ choice, onChange }: { choice: ProfileChoice; onChange: (look: DiceLook) => void }): React.ReactElement | null {
  const { chosen } = useSyncExternalStore(choice.subscribe, choice.getState);
  const look = readDiceLook(chosen?.diceLook);
  const previews = usePlayerDicePreviews(look.font, chosen?.color ?? null);
  if (!chosen) return null;
  return (
    <div className="atlas-player-settings-panel atlas-player-settings-panel--dice">
      <DiceColourStrip value={look.colour} previews={previews} options={PLAYER_DICE_COLOURS} onChange={(colour) => onChange({ ...look, colour })} />
      <SegmentedControl ariaLabel="Dice numbers" value={look.font} options={DICE_FONT_OPTIONS} onChange={(font) => onChange({ ...look, font })} />
    </div>
  );
}

/** Previews already rendered, by font and colour: a submenu mounts its panel each time it opens. */
const rendered = new Map<string, Partial<Record<DiceColour, string>>>();

/** A d20 in each colour and `font`, the accent one in the player's `color`. */
function usePlayerDicePreviews(font: DiceFont, color: string | null): Partial<Record<DiceColour, string>> {
  const key = `${font}|${color ?? ''}`;
  const [previews, setPreviews] = useState(() => rendered.get(key) ?? {});
  useEffect(() => {
    const known = rendered.get(key);
    if (known) {
      setPreviews(known);
      return undefined;
    }
    let alive = true;
    void renderDicePreviews(font, document, color ? parseHex(color) : null).then((next) => {
      rendered.set(key, next);
      if (alive) setPreviews(next);
    });
    return () => {
      alive = false;
    };
  }, [key, font, color]);
  return previews;
}

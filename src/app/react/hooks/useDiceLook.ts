import { useEffect, useState } from 'react';
import { DEFAULT_DICE_LOOK, type DiceLook } from '../../dice3d/diceLook';
import type { DiceSettingsSource } from '../components/dice/diceEnvironment';

/** The dice look from Atlas' settings, kept current as it changes. */
export function useDiceLook(settings: DiceSettingsSource | undefined): DiceLook {
  const [look, setLook] = useState<DiceLook>(() => settings?.getDiceLook() ?? { ...DEFAULT_DICE_LOOK });

  useEffect(() => {
    if (!settings) return;
    const update = (): void => {
      const next = settings.getDiceLook();
      setLook((prev) => (prev.colour === next.colour && prev.font === next.font ? prev : next));
    };
    update();
    return settings.onChange(update);
  }, [settings]);

  return look;
}

/** The class that sets the dice font for the numbers inside an element. */
export function diceFontClass(look: DiceLook): string | false {
  return look.font === 'scifi' && 'atlas-dice-font--scifi';
}

/** The class that sets a roll's own dice font, whatever the font around it. */
export function rollFontClass(look: DiceLook): string {
  return look.font === 'scifi' ? 'atlas-dice-font--scifi' : 'atlas-dice-font--medieval';
}

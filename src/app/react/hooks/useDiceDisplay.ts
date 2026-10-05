import { useEffect, useState } from 'react';
import type { DiceDisplay } from '../../dice3d/diceDisplay';
import type { DiceSettingsSource } from '../components/dice/diceEnvironment';

/** How rolls are shown, kept current as the setting changes. */
export function useDiceDisplay(settings: DiceSettingsSource | undefined): DiceDisplay {
  const [display, setDisplay] = useState<DiceDisplay>(() => settings?.getDiceDisplay() ?? 'full');

  useEffect(() => {
    if (!settings) return;
    setDisplay(settings.getDiceDisplay());
    return settings.onChange(() => setDisplay(settings.getDiceDisplay()));
  }, [settings]);

  return display;
}

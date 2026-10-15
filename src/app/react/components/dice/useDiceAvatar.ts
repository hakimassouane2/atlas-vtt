import { useMemo } from 'react';
import { useOptionalAtlasStore } from '../../ViewStoreContext';
import type { DiceRollResult } from '../../../types/diceTypes';
import { useDiceEnvironment } from './diceEnvironment';
import type { TokenRole } from '../../../tokenRings/tokenRingTypes';
import type { DiceAvatar, RollSourcePresentation } from './diceSourcePresentation';

export type { DiceAvatar };

/**
 * Resolves the avatar for a roll at render time rather than storing a URL with
 * the roll: resource URLs do not survive a restart, and a token may have been
 * given new artwork since. The map token's current image wins, then the library
 * token linked to the statblock (the one the roll recorded, where several are),
 * then the token image recorded with the roll, then the statblock's own art. The
 * ring follows the map token, so the avatar matches the canvas; without one it
 * follows the library token drawn with that artwork, and any other image (a
 * statblock's raw art) is shown unframed.
 *
 * A roll shown with a `presentation` (the player window's) has exactly its portrait, or
 * none: nothing is looked up for it.
 */
export function useDiceAvatar(source: DiceRollResult['source'], presentation?: RollSourcePresentation | null): DiceAvatar | null {
  const { art } = useDiceEnvironment();
  const lookup = presentation === undefined ? source : undefined;
  const tokenId = lookup?.tokenId;
  // One selector per field: selecting the token itself would re-render on every move.
  // The player window reads the presented scene's store, lent to it. Without a store, and for
  // a token the store does not hold, avatars come from the statblock or the roll.
  const currentImagePath = useOptionalAtlasStore(
    (state): string | undefined => (tokenId ? state.objects?.tokens?.[tokenId]?.imagePath : undefined),
    undefined,
  );
  const mapShowRing = useOptionalAtlasStore(
    (state): boolean | undefined => (tokenId ? state.objects?.tokens?.[tokenId]?.showRing : undefined),
    undefined,
  );
  const ringColor = useOptionalAtlasStore(
    (state): string | undefined => (tokenId ? state.objects?.tokens?.[tokenId]?.ringColor : undefined),
    undefined,
  );
  const role = useOptionalAtlasStore(
    (state): TokenRole | undefined => (tokenId ? state.objects?.tokens?.[tokenId]?.role : undefined),
    undefined,
  );
  const ringStyle = useOptionalAtlasStore(
    (state): string | undefined => (tokenId ? state.objects?.tokens?.[tokenId]?.ringStyle : undefined),
    undefined,
  );
  // ponytail: read per render, so a re-link shows on the next re-render (the log
  // ticks every 10 s); subscribe to metadataCache 'changed' if that is too slow.
  const statblockPath = lookup?.statblockPath;
  const linkedImagePath = statblockPath ? art?.linkedTokenImage(statblockPath, lookup?.tokenImagePath) ?? null : null;
  const statblockImagePath = statblockPath ? art?.statblockImage(statblockPath) ?? null : null;
  const imagePath = currentImagePath ?? linkedImagePath ?? lookup?.tokenImagePath ?? statblockImagePath;
  const src = imagePath ? art?.src(imagePath) ?? null : null;
  const showRing = currentImagePath !== undefined
    ? mapShowRing !== false
    : !!imagePath && !!src && !!art?.libraryShowsRing(imagePath);

  const found = useMemo(
    (): DiceAvatar | null => (src ? { src, showRing, ringColor, ring: { ringColor, role, ringStyle } } : null),
    [src, showRing, ringColor, role, ringStyle],
  );
  return presentation === undefined ? found : presentation?.avatar ?? null;
}

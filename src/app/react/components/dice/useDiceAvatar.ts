import { useMemo } from 'react';
import { useOptionalAtlasStore } from '../../ViewStoreContext';
import type { DiceRollResult } from '../../../tools/DiceTool';
import { useDiceEnvironment } from './diceEnvironment';
import type { RingSubject, TokenRole } from '../../../tokenRings/tokenRingTypes';

export interface DiceAvatar {
  src: string;
  showRing: boolean;
  /** The map token's ring: its role, ring style and colour. */
  ring: RingSubject;
}

/**
 * Resolves the avatar for a roll at render time rather than storing a URL with
 * the roll: resource URLs do not survive a restart, and a token may have been
 * given new artwork since. The map token's current image wins, then the image
 * of the token currently linked to the statblock, then the path recorded with
 * the roll. The ring follows the map token, so the avatar matches the canvas;
 * without one it follows the library token drawn with that artwork, and any
 * other image is shown unframed.
 */
export function useDiceAvatar(source: DiceRollResult['source']): DiceAvatar | null {
  const { art } = useDiceEnvironment();
  const tokenId = source?.tokenId;
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
  const linkedImagePath = source?.statblockPath ? art?.statblockImage(source.statblockPath) ?? null : null;
  const imagePath = currentImagePath ?? linkedImagePath ?? source?.tokenImagePath;
  const src = imagePath ? art?.src(imagePath) ?? null : null;
  const showRing = currentImagePath !== undefined
    ? mapShowRing !== false
    : !!imagePath && !!src && !!art?.libraryShowsRing(imagePath);

  return useMemo(
    (): DiceAvatar | null => (src ? { src, showRing, ring: { ringColor, role, ringStyle } } : null),
    [src, showRing, ringColor, role, ringStyle],
  );
}

import { createContext, useContext } from 'react';
import type { RingSubject } from '../../../tokenRings/tokenRingTypes';

/** How a portrait draws a token's ring: an image (unset is Atlas' ring) in a colour (unset is white). */
export interface PortraitRing {
  image?: string | undefined;
  color?: string | undefined;
}

/** The ring a portrait of `subject` is drawn with, in the collection the surface shows. */
export type PortraitRingOf = (subject: RingSubject) => PortraitRing;

/** Outside every collection: Atlas' ring in the token's own colour. */
const atlasRing: PortraitRingOf = (subject) => ({ color: subject.ringColor });

/**
 * The rings of the collection a surface shows (the asset manager's, the map's); `TokenPortrait`
 * reads it. A surface without a provider (the players' page) draws Atlas' ring.
 */
export const TokenRingContext = createContext<PortraitRingOf>(atlasRing);

export function usePortraitRing(subject: RingSubject | undefined): PortraitRing | undefined {
  const ringOf = useContext(TokenRingContext);
  return subject ? ringOf(subject) : undefined;
}

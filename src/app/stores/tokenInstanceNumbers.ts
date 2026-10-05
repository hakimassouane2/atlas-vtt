import type { TokenEntity } from '../types';

/** Find the lowest unused instance number for tokens sharing the same imagePath. */
export function computeNextInstanceNumber(
  tokens: Record<string, TokenEntity>,
  imagePath: string,
): number {
  const usedNumbers = new Set(
    Object.values(tokens)
      .filter((t) => t.imagePath === imagePath)
      .map((t) => t.instanceNumber)
      .filter((n): n is number => n != null)
  );
  let num = 1;
  while (usedNumbers.has(num)) num++;
  return num;
}

/**
 * The number a token's badge shows (on the map and in initiative lists): its instance number,
 * while the map shows instance badges and another token shares its artwork; otherwise none.
 */
export function shownInstanceNumber(tokens: Record<string, TokenEntity>, tokenId: string, showInstanceBadges: boolean | undefined): number | null {
  if (!(showInstanceBadges ?? true)) return null;
  const token = tokens[tokenId];
  if (!token?.instanceNumber) return null;
  const sameImageCount = Object.values(tokens).filter((t) => t.imagePath === token.imagePath).length;
  return sameImageCount >= 2 ? token.instanceNumber : null;
}

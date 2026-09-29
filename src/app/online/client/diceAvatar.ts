import { useMemo } from 'react';
import { useStore } from 'zustand';
import type { DiceAvatar } from '../../react/components/dice/useDiceAvatar';
import type { DiceRollResult } from '../../tools/DiceTool';
import { sceneStore } from './playerState';
import { imageUrl } from './session';

/**
 * Stands in for Atlas' `useDiceAvatar` in the player page's bundle (see
 * `vite/player-client.mts`), which reads the vault. Like it, the map token's
 * current artwork and ring win, then the artwork recorded with the roll.
 */
export function useDiceAvatar(source: DiceRollResult['source']): DiceAvatar | null {
  const tokenId = source?.tokenId;
  const token = useStore(sceneStore, (scene) => (tokenId ? scene.objects.tokens[tokenId] : undefined));
  const path = token?.imagePath ?? source?.tokenImagePath;
  return useMemo(
    (): DiceAvatar | null => (path ? { src: imageUrl(path), showRing: token ? token.showRing !== false : true, ringColor: token?.ringColor } : null),
    [path, token],
  );
}

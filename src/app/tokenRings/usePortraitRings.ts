import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { App } from 'obsidian';
import type { PortraitRingOf } from '../packages/components/shared/tokenRingContext';
import { TokenRingLibrary } from './TokenRingLibrary';

const noChanges = (): (() => void) => () => undefined;

/** The ring library's revision: it changes whenever a ring file, a file's tint or a collection's settings change. */
export function useTokenRingRevision(app: App | null | undefined): number {
  const library = TokenRingLibrary.forApp(app);
  const subscribe = useCallback((onChange: () => void) => library?.onChange(onChange) ?? noChanges(), [library]);
  return useSyncExternalStore(subscribe, () => library?.revision ?? 0);
}

/** How the portraits of `collectionId` draw their rings, for `TokenRingContext`; follows every change of the rings. */
export function usePortraitRings(app: App | null | undefined, collectionId: string | null): PortraitRingOf {
  const library = TokenRingLibrary.forApp(app);
  const revision = useTokenRingRevision(app);
  return useMemo<PortraitRingOf>(
    () => (library ? (subject) => library.portraitRing(collectionId, subject) : (subject) => ({ color: subject.ringColor })),
    // `revision` stands for the ring files and the collection's settings, which are read here.
    [library, collectionId, revision],
  );
}

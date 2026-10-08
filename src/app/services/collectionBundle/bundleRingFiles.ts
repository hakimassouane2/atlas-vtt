import { TFile, type App } from 'obsidian';
import { tokenRingFolder, tokenRingStyleOfPath } from '../../tokenRings/tokenRingFiles';
import { TOKEN_RING_ROLE, type BundleFile } from './bundleFormat';

/**
 * `files` with the collection's ring images (`tokenRings/tokenRingFiles.ts`), so its tokens keep
 * their rings wherever it is imported. They lie in the collection's folder and land at the same
 * place in the importing one.
 */
export function withTokenRingFiles(app: App, files: readonly BundleFile[], collectionId: string): BundleFile[] {
  const packed = new Set(files.map((file) => file.vaultPath));
  const rings = (app.vault.getFolderByPath(tokenRingFolder(collectionId))?.children ?? [])
    .filter((child): child is TFile => child instanceof TFile && tokenRingStyleOfPath(child.path) !== null && !packed.has(child.path))
    .map((file): BundleFile => ({ vaultPath: file.path, role: TOKEN_RING_ROLE }));
  return [...files, ...rings];
}

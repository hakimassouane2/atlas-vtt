import { TFile, type App } from 'obsidian';
import type { ArtSource } from '../../canvas/canvasHost';
import { imageMimeType } from '../../utils/imageMimeTypes';

/** Token art read from the vault, with the vault's changes to it. */
export function vaultArtSource(app: App): ArtSource {
  return {
    read: async (path) => {
      const file = app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) return null;
      return { bytes: await app.vault.readBinary(file), mimeType: imageMimeType(file.extension) ?? 'image/png' };
    },
    onChanged: (listener) => {
      const ref = app.vault.on('modify', (file) => listener(file.path));
      return () => app.vault.offref(ref);
    },
  };
}

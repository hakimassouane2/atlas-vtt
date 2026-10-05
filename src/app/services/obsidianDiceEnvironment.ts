import { TFile, type App } from 'obsidian';
import type { DiceEnvironment } from '../react/components/dice/diceEnvironment';
import { AssetService } from './AssetService';
import { SettingsService } from './SettingsService';
import { TokenStatblockLinkService } from './TokenStatblockLinkService';

/** Dice rolls in Obsidian: Atlas' settings, and avatars from the vault. */
export function obsidianDiceEnvironment(app: App): DiceEnvironment {
  const fileAt = (path: string): TFile | null => {
    const file = app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? file : null;
  };
  return {
    settings: SettingsService.forApp(app),
    art: {
      src: (imagePath) => {
        const file = fileAt(imagePath);
        return file ? app.vault.getResourcePath(file) : null;
      },
      statblockImage: (statblockPath) => {
        const file = fileAt(statblockPath);
        return file ? TokenStatblockLinkService.getInstance(app).readStatblockImage(file) : null;
      },
      libraryShowsRing: (imagePath) => {
        const asset = AssetService.getInstance(app).findTokenAssetByImagePath(imagePath);
        return asset ? asset.showRing !== false : false;
      },
    },
  };
}

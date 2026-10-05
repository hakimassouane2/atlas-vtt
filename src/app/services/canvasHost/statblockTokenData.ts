import { TFile, parseYaml, type App } from 'obsidian';
import type { ResourceDefinition } from '../../resources/resourceTypes';
import type { TokenEntity } from '../../types';
import { buildStatblockLinkUpdates } from '../../pixi/token-renderer/statblockFrontmatter';
import { TokenStatblockLinkService } from '../TokenStatblockLinkService';

/**
 * The token as its sprite shows it: a character whose image is linked to a statblock but
 * that has no statblock path yet starts out with the statblock's data, and a character
 * without a name of its own shows its statblock's.
 */
export async function withStatblockData(app: App, token: TokenEntity, resources: readonly ResourceDefinition[]): Promise<TokenEntity> {
  let character = token;
  if (token.imagePath) {
    const linkedStatblockPath = await TokenStatblockLinkService.getInstance(app).getStatblockLinkedToToken(token.imagePath);
    if (linkedStatblockPath && token.kind === 'character' && !token.statblockPath) {
      character = { ...token, statblockPath: linkedStatblockPath };
      try {
        const statblockFile = app.vault.getAbstractFileByPath(linkedStatblockPath);
        const frontmatter = statblockFile instanceof TFile ? app.metadataCache.getFileCache(statblockFile)?.frontmatter : undefined;
        if (frontmatter) character = { ...character, ...buildStatblockLinkUpdates(frontmatter, token.name, resources, token.resources) };
      } catch (error) {
        console.error(`[TokenRenderer] Failed to load statblock data for token ${token.id}:`, error);
      }
    }
  }
  return withStatblockName(app, character);
}

/** A character without a name of its own shows the name in its statblock's frontmatter. */
async function withStatblockName(app: App, character: TokenEntity): Promise<TokenEntity> {
  if (character.kind !== 'character' || character.name || !character.statblockPath) return character;
  const statblockPath = character.statblockPath;
  try {
    const file = app.vault.getAbstractFileByPath(statblockPath);
    if (!(file instanceof TFile)) {
      console.warn(`[TokenRenderer] Statblock file not found: ${statblockPath}`);
      return character;
    }
    const match = (await app.vault.read(file)).match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
      console.warn(`[TokenRenderer] Invalid statblock format in file: ${statblockPath}`);
      return character;
    }
    const statblockData: unknown = parseYaml(match[1]!);
    if (!statblockData || typeof statblockData !== 'object') {
      console.warn(`[TokenRenderer] Failed to parse YAML in statblock: ${statblockPath}`);
      return character;
    }
    const name = 'name' in statblockData ? statblockData.name : undefined;
    return { ...character, statblockName: typeof name === 'string' && name ? name : null };
  } catch (error) {
    console.error(`[TokenRenderer] Error loading statblock at ${statblockPath}:`, error);
    return character;
  }
}

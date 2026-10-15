import type { ResourceViewer } from '../resources/resourceTypes';
import type { TokenEntity } from '../types';
import { seesResourcesOf } from '../resources/visibleResources';
import type { App } from 'obsidian';
import type { ViewAtlasState } from '../storeFactory';
import type { InitiativeRules } from '../types/initiativeRulesTypes';
import { sideOf } from '../initiative/sides';
import { listedForPlayers, playerInitiativeList, renderPlayerInitiative, type EntryToken } from './playerInitiativeList';
import { PlayerSceneOverlay, type PlayerSettings } from './PlayerSceneOverlay';
import type { SettingsService } from './SettingsService';
import { shownInstanceNumber } from '../stores/tokenInstanceNumbers';
import type { PortraitRing } from '../packages/components/shared/tokenRingContext';

/** What the panel asks the collection holding the presented map (fork: the online page answers it too). */
export interface InitiativeCollection {
  /** Whether players see the combatants' HP. */
  showsHp(mapPath: string | null): boolean;
  /** Who the list is shown to, for `token`: a player, or one of the players it is given to. */
  viewerOf(token: TokenEntity): ResourceViewer;
  rules(mapPath: string | null): InitiativeRules;
  /** How a combatant's portrait draws its ring, as the map's collection frames the token. */
  ringOf(mapPath: string | null, token: TokenEntity): PortraitRing;
}

/** Separates token ids in `InitiativeScene.visibleTokenIds`. */
const TOKEN_ID_SEPARATOR = '\n';

interface InitiativeScene {
  initiative: ViewAtlasState['initiative'];
  initiativeTrackerOpen: boolean;
  /** Initiative tokens players may see, joined into a key so edits to other tokens compare equal. */
  visibleTokenIds: string;
  mapPath: string | null;
  /** What the list shows of every initiative token (`EntryToken`), in entry order, as a key that changes when one of them does. */
  tokens: string;
}

/**
 * Read-only initiative projection; never mounts the DM tracker or its controls. It lists the
 * GM's combatants without those whose token is hidden, in turn order or by sides as the fight runs.
 */
export class PlayerInitiativePanel extends PlayerSceneOverlay<InitiativeScene> {
  constructor(private readonly app: App, settings: SettingsService, private readonly collection: InitiativeCollection) {
    super({ cls: 'atlas-player-initiative-container' }, settings);
  }

  protected select({ initiative, initiativeTrackerOpen, objects, mapPath, tokenSettings }: ViewAtlasState): InitiativeScene {
    const tokens = objects?.tokens;
    const entries = initiative?.entries ?? [];
    const visibleTokenIds = entries
      .filter((entry) => listedForPlayers(tokens?.[entry.tokenId]))
      .map((entry) => entry.tokenId)
      .join(TOKEN_ID_SEPARATOR);
    const entryTokens = JSON.stringify(entries.map((entry): EntryToken => {
      const token = tokens?.[entry.tokenId];
      const ring = token ? this.collection.ringOf(mapPath ?? null, token) : {};
      return {
        // A token that hides its resources from these players hides its HP here too
        hp: token && seesResourcesOf(token.barsShownTo, this.collection.viewerOf(token)) ? token.resources?.hp ?? null : null,
        showRing: token?.showRing !== false,
        ringColor: ring.color,
        ringImage: ring.image,
        side: sideOf(token),
        instance: tokens ? shownInstanceNumber(tokens, entry.tokenId, tokenSettings?.showInstanceBadges) : null,
      };
    }));
    return { initiative, initiativeTrackerOpen, visibleTokenIds, mapPath: mapPath ?? null, tokens: entryTokens };
  }

  protected render(container: HTMLElement, scene: InitiativeScene, settings: PlayerSettings): void {
    const { initiative, initiativeTrackerOpen } = scene;
    if (!settings.showInitiative || !initiativeTrackerOpen || !initiative) return;
    const visibleTokenIds = new Set(scene.visibleTokenIds.split(TOKEN_ID_SEPARATOR));
    const tokenOf = JSON.parse(scene.tokens) as EntryToken[];
    const list = playerInitiativeList(
      initiative,
      (entry, index) => (visibleTokenIds.has(entry.tokenId) ? tokenOf[index] ?? { hp: null, showRing: true, side: 'opponents' } : null),
      this.collection.rules(scene.mapPath),
      this.collection.showsHp(scene.mapPath),
    );
    renderPlayerInitiative(container, list, {
      showNames: settings.showTokenNameplates,
      portraitSrc: (imagePath) => (/^(?:https?:|data:|blob:|app:)/.test(imagePath) ? imagePath : this.app.vault.adapter.getResourcePath(imagePath)),
    });
  }
}

import type { ResourceDefinition, ResourceViewer } from '../resources/resourceTypes';
import type { TokenEntity } from '../types';
import type { ConditionDefinition } from '../types/collectionSettingsTypes';
import type { InitiativeRules } from '../types/initiativeRulesTypes';
import { seesResourcesOf } from '../resources/visibleResources';
import type { App } from 'obsidian';
import type { StoreApi } from 'zustand';
import type { ViewAtlasState } from '../storeFactory';
import type { PlayerBadgeNumbers } from '../pixi/token-renderer/PlayerInstanceBadges';
import { entryTokenOf, listedForPlayers, playerInitiativeList, renderPlayerInitiative, sideIdsOf, type EntryToken } from './playerInitiativeList';
import { PlayerSceneOverlay, type PlayerSettings } from './PlayerSceneOverlay';
import type { SettingsService } from './SettingsService';
import { portraitSrc } from '../utils/portraitSrc';
import type { PortraitRing } from '../packages/components/shared/tokenRingContext';

/** What the panel asks the collection holding the presented map (fork: the online page answers it too). */
export interface InitiativeCollection {
  /** Whether players see the combatants' HP. */
  showsHp(mapPath: string | null): boolean;
  /** The map's resources, which say who is defeated. */
  resources(mapPath: string | null): readonly ResourceDefinition[];
  /** The map's conditions, drawn on the cards as the map draws them on the tokens. */
  conditions(mapPath: string | null): readonly ConditionDefinition[];
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
 * Look-alikes carry the number their badge shows the players (`PlayerBadgeNumbers`), which may
 * differ from the GM's: the list is drawn anew once the players' frame numbered them anew. It
 * follows the GM's layout: the edge it stands at and whether it starts at the turn.
 */
export class PlayerInitiativePanel extends PlayerSceneOverlay<InitiativeScene> {
  private badgeNumbers: PlayerBadgeNumbers | undefined;
  private stopBadgeNumbers: (() => void) | undefined;
  /** The numbers the list showed last, kept as plain data for a held list, which lets go of the renderer. */
  private shownNumbers: ReadonlyMap<string, number> = new Map();
  private redrawQueued = false;
  private readonly stopLayout: () => void;

  constructor(private readonly app: App, private readonly settings: SettingsService, private readonly collection: InitiativeCollection) {
    super({ cls: 'atlas-player-initiative-container' }, settings);
    // The GM's layout is no player setting: the list is drawn anew when the edge or the start changes
    let { fromTurn, dock } = settings.initiativeLayout();
    this.stopLayout = settings.onChange(() => {
      const next = settings.initiativeLayout();
      if (next.fromTurn === fromTurn && next.dock === dock) return;
      ({ fromTurn, dock } = next);
      this.refresh();
    });
  }

  override destroy(): void {
    this.stopLayout();
    super.destroy();
  }

  override present(store: StoreApi<ViewAtlasState>, _diceEvents?: unknown, _rollSources?: unknown, badgeNumbers?: PlayerBadgeNumbers): void {
    this.letGoOfBadgeNumbers();
    this.badgeNumbers = badgeNumbers;
    this.stopBadgeNumbers = badgeNumbers?.onNumbersChange(() => this.redrawSoon());
    super.present(store);
  }

  override hold(): void {
    this.letGoOfBadgeNumbers();
    super.hold();
  }

  /** The players' frame numbers its badges while it renders: the list is drawn once that render is done. */
  private redrawSoon(): void {
    if (this.redrawQueued) return;
    this.redrawQueued = true;
    queueMicrotask(() => {
      this.redrawQueued = false;
      this.refresh();
    });
  }

  private letGoOfBadgeNumbers(): void {
    this.stopBadgeNumbers?.();
    this.stopBadgeNumbers = undefined;
    this.badgeNumbers = undefined;
  }

  protected select({ initiative, initiativeTrackerOpen, objects, mapPath }: ViewAtlasState): InitiativeScene {
    const tokens = objects?.tokens;
    const entries = initiative?.entries ?? [];
    // Who is defeated follows the map's resources, as on the GM's cards
    const definitions = entries.length > 0 ? this.collection.resources(mapPath ?? null) : [];
    // The conditions the map draws on the tokens, as players see them there
    const conditions = entries.length > 0 ? this.collection.conditions(mapPath ?? null) : [];
    const visibleTokenIds = entries
      .filter((entry) => listedForPlayers(tokens?.[entry.tokenId]))
      .map((entry) => entry.tokenId)
      .join(TOKEN_ID_SEPARATOR);
    // A token's side counts where the fight or the rules know it
    const sides = entries.length > 0 && initiative ? sideIdsOf(initiative, this.collection.rules(mapPath ?? null)) : undefined;
    const entryTokens = JSON.stringify(entries.map((entry): EntryToken => {
      const token = tokens?.[entry.tokenId];
      const shown = entryTokenOf(token, definitions, conditions, sides);
      if (!token) return shown;
      const ring = this.collection.ringOf(mapPath ?? null, token);
      return {
        ...shown,
        // A token that hides its resources from these players hides its HP here too
        hp: seesResourcesOf(token.barsShownTo, this.collection.viewerOf(token)) ? shown.hp : null,
        ringColor: ring.color,
        ringImage: ring.image,
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
      (entry, index) => (visibleTokenIds.has(entry.tokenId) ? tokenOf[index] ?? { hp: null, showRing: true, side: 'opponents', defeated: false } : null),
      this.collection.rules(scene.mapPath),
      this.collection.showsHp(scene.mapPath),
    );
    const live = this.badgeNumbers;
    const held = this.shownNumbers;
    const shown = new Map<string, number>();
    for (const { entry } of list.combatants) {
      const number = live ? live.numberOf(entry.tokenId) : held.get(entry.tokenId) ?? null;
      if (number !== null) shown.set(entry.tokenId, number);
    }
    this.shownNumbers = shown;
    const { fromTurn, dock } = this.settings.initiativeLayout();
    renderPlayerInitiative(container, list, {
      showNames: settings.showTokenNameplates,
      fromTurn,
      dock,
      badgeNumber: (tokenId) => shown.get(tokenId) ?? null,
      portraitSrc: (imagePath) => portraitSrc(this.app, imagePath),
    });
  }
}

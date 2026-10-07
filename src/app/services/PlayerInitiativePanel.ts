import type { ResourceValue, ResourceViewer } from '../resources/resourceTypes';
import type { TokenEntity } from '../types';
import { seesResourcesOf } from '../resources/visibleResources';
import type { App } from 'obsidian';
import type { ViewAtlasState } from '../storeFactory';
import type { InitiativeEntry } from '../types/initiativeTypes';
import { createTokenPortrait } from '../packages/components/shared/tokenPortraitElement';
import { SIDE_LABELS, listedBySides, sideOf, sidesInOrder } from '../initiative/sides';
import type { InitiativeRules, InitiativeSide } from '../types/initiativeRulesTypes';
import { scrollWithin } from '../utils/scrollWithin';
import { PlayerSceneOverlay, type PlayerSettings } from './PlayerSceneOverlay';
import type { SettingsService } from './SettingsService';
import './player-initiative.scss';
import { shownInstanceNumber } from '../stores/tokenInstanceNumbers';

/** What the panel asks the collection holding the presented map. */
export interface InitiativeCollection {
  /** Whether players see the combatants' HP. */
  showsHp(mapPath: string | null): boolean;
  /** Who the list is shown to, for `token`: a player, or one of the players it is given to. */
  viewerOf(token: TokenEntity): ResourceViewer;
  rules(mapPath: string | null): InitiativeRules;
}
import { t } from '../i18n';

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

/** What the list reads from a combatant's token. */
interface EntryToken {
  hp: ResourceValue | null;
  /** The map frames a token unless its ring is switched off. */
  showRing: boolean;
  ringColor?: string | undefined;
  side: InitiativeSide;
  /** The number of the token's badge, as the map shows it (Goblin 2); null without one. */
  instance: number | null;
}

/** A combatant the players see, with what the list shows of its token. */
interface Combatant {
  entry: InitiativeEntry;
  token: EntryToken;
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
      .filter((entry) => tokens?.[entry.tokenId] && !tokens[entry.tokenId]?.isHidden)
      .map((entry) => entry.tokenId)
      .join(TOKEN_ID_SEPARATOR);
    const entryTokens = JSON.stringify(entries.map((entry): EntryToken => {
      const token = tokens?.[entry.tokenId];
      return {
        // A token that hides its resources from these players hides its HP here too
        hp: token && seesResourcesOf(token.barsShownTo, this.collection.viewerOf(token)) ? token.resources?.hp ?? null : null,
        showRing: token?.showRing !== false,
        ringColor: token?.ringColor,
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
    const hpVisible = this.collection.showsHp(scene.mapPath);
    const combatants = initiative.entries
      .map((entry, index): Combatant => {
        const token = tokenOf[index] ?? { hp: null, showRing: true, side: 'opponents', instance: null };
        return { entry, token: hpVisible ? token : { ...token, hp: null } };
      })
      .filter(({ entry }) => visibleTokenIds.has(entry.tokenId))
      .sort((a, b) => a.entry.order - b.entry.order);
    if (!combatants.length) return;

    const panel = container.createDiv({
      cls: 'atlas-player-initiative',
      attr: { role: 'region', 'aria-label': t('playerInit.order') },
    });
    const rules = this.collection.rules(scene.mapPath);
    if (listedBySides(initiative, rules)) {
      this.renderSides(panel, combatants, initiative, settings, initiative.sides?.first ?? rules.firstSide);
    } else {
      const list = panel.createDiv({ cls: 'atlas-player-initiative__list', attr: { role: 'list' } });
      for (const combatant of combatants) this.renderEntry(list, combatant, settings, initiative.isActive);
    }
    if (initiative.isActive) {
      panel.createDiv({ cls: 'atlas-player-initiative__round', text: t('playerInit.round', { round: initiative.round }) });
      // The list is drawn anew on every change, scrolled to its top: bring the turn back into view
      const list = panel.querySelector<HTMLElement>('.atlas-player-initiative__list');
      const side = panel.querySelector('.atlas-player-initiative__side--active');
      const card = panel.querySelector('.atlas-player-initiative__card--active');
      if (list && side) scrollWithin(list, side, 'start');
      else if (list && card) scrollWithin(list, card, 'nearest');
    }
  }

  /** The combatants under their side, the side that acts first on top; a side the players see nobody of is left out. */
  private renderSides(panel: HTMLElement, combatants: Combatant[], initiative: InitiativeScene['initiative'], settings: PlayerSettings, first: InitiativeSide): void {
    const sides = panel.createDiv({ cls: 'atlas-player-initiative__list' });
    for (const side of sidesInOrder(first)) {
      const members = combatants.filter(({ token }) => token.side === side);
      if (!members.length) continue;
      const group = sides.createDiv({ cls: 'atlas-player-initiative__side', attr: { role: 'list', 'aria-label': SIDE_LABELS[side] } });
      if (initiative.sides?.active === side) {
        group.addClass('atlas-player-initiative__side--active');
        group.setAttribute('aria-current', 'true');
      }
      group.createDiv({ cls: 'atlas-player-initiative__side-label', text: SIDE_LABELS[side], attr: { 'aria-hidden': 'true' } });
      // By sides the turn is the side's and there are no numbers
      for (const member of members) this.renderEntry(group, member, settings, false, false);
    }
  }

  private renderEntry(parent: HTMLElement, { entry, token }: Combatant, settings: PlayerSettings, combatActive: boolean, showValue = true): void {
    const card = parent.createDiv({ cls: 'atlas-player-initiative__card', attr: { role: 'listitem' } });
    if (combatActive && entry.isActive) {
      card.addClass('atlas-player-initiative__card--active');
      card.setAttribute('aria-current', 'true');
    }
    if (entry.sitsOut) card.addClass('atlas-player-initiative__card--sitting-out');
    if (entry.imagePath) {
      const src = /^(?:https?:|data:|blob:|app:)/.test(entry.imagePath)
        ? entry.imagePath : this.app.vault.adapter.getResourcePath(entry.imagePath);
      const portrait = card.createDiv({ cls: 'atlas-player-initiative__portrait' });
      createTokenPortrait(portrait, { src, alt: settings.showTokenNameplates ? entry.name : '', cls: 'atlas-player-initiative__avatar', showRing: token.showRing, ringColor: token.ringColor });
      if (token.instance !== null) portrait.createSpan({ cls: 'atlas-player-initiative__instance-badge', text: String(token.instance) });
    }
    if (showValue) card.createSpan({ cls: 'atlas-player-initiative__value', text: String(entry.initiative) });
    if (settings.showTokenNameplates) {
      card.createSpan({ cls: 'atlas-player-initiative__name', text: entry.name });
    }
    const { hp } = token;
    if (hp && hp.max > 0) {
      card.createEl('progress', {
        cls: 'atlas-player-initiative__hp',
        attr: { max: hp.max, value: Math.max(0, hp.current), 'aria-label': 'HP' },
      });
    }
  }
}

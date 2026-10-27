# Reprendre le mode en ligne de l'original

Liste de travail : ce que l'original (Atlas Online, `src/app/online/`) sait faire et que notre mode
auto-hébergé (`src/app/selfhost/`) n'a pas encore, et comment le recréer chez nous. `FORK.md` décrit
ce qui existe ; ce document décrit ce qui reste à faire. Une fiche terminée passe dans `FORK.md` et
son état devient **fait** ici.

Rédigé le 27 octobre 2026 en lisant `upstream/main` = **0.10.1** (`af9ccc97`). Notre dernière
synchro est la 0.8.0. Pour lire leur code avant le merge : `git show upstream/main:<chemin>` ;
après le merge, il est dans le dépôt.

## Décisions

- **On garde notre transport** : le serveur HTTP du plugin (`OnlineSessionServer`, SSE + POST, port
  ouvert sur la box, lien avec clé). Pas de relais, pas de serveur à héberger, pas d'extension.
- **On reprend leurs fonctions, pas leur protocole.** Notre page joueur fait tourner le moteur
  d'Atlas sur une copie de la scène (`docs/adr/0001-player-client-runs-the-canvas.md`) ; la leur
  reçoit des données filtrées. On garde notre réplication (`selfhost/scene/`) et on y branche
  leurs fonctions une par une.
- **On importe sur place leur logique pure** (calculs, parseurs, composants React partagés) depuis
  `src/app/online/` et `src/app/campaigns/`, **sans jamais modifier ces dossiers**. On ne copie dans
  `selfhost/` que ce qui est mêlé au relais ou aux comptes. Si une synchro déplace un fichier
  importé, on corrige l'import.
- **Pas d'anti-triche.** On joue entre potes ; leur filtrage de l'info cachée ne nous intéresse que
  si une fonction en a besoin pour s'afficher correctement.
- **Textes d'interface en anglais en dur**, comme le reste du fork.

## Écarté (ne pas faire)

| Quoi | Où chez eux | Pourquoi |
| --- | --- | --- |
| Comptes, connexion, droit d'héberger | `gm/account/*`, `servers.ts`, `dock/accountMenu.ts`, `closingRow.ts` | inutile pour une table privée |
| Relais et serveurs `atlas-vtt.dev` | `TableConnection.ts`, `sendQueue.ts`, `socketWatch.ts`, `createTable.ts`, `tableStart.ts`, `tableEnd.ts`, `strayTable.ts`, `savedTable.ts`, `gmLevel.ts` | notre serveur suffit |
| Clés d'invitation, bêta fermée | `gm/account/*`, trames `access` / `noAccess` / `superseded` de `protocol/relay.ts` | idem |
| Porte d'entrée (le joueur frappe, le MJ accepte) | `joinGate.ts`, `waitingKnocks.ts`, `dock/knockStack`, `armedCards` | le lien avec clé suffit |
| Codes joueur à 6 chiffres | `protocol/seat.ts`, `your-code` | idem |
| QR code d'invitation | `dock/inviteQr`, `qrDrawing`, `qrImage` | pas voulu |
| Rapports d'erreur et feedback envoyés chez eux | `protocol/diagnostics.ts`, `errorReporter.ts`, `redact.ts`, `gm/companionDiagnostics.ts`, `companionReports.ts`, `dock/feedbackForm.ts` | rien à envoyer à un tiers |
| Éclairage dynamique et vision en ligne | `gm/sceneInputs.ts` (`sharedWall`, `sharedLightingScene`, `sharedSight`), `atlasLighting.ts`, `floorSight.ts`, `playerTokenVision.ts`, `protocol/lighting.ts` | le MJ gère le brouillard à la main ; à rouvrir seulement si une autre fonction l'exige |
| Étages en ligne (chaque joueur voit son étage) | `FloorShare.ts`, `floorStore*.ts`, `playerFloors.ts`, `stairSides.ts`, `protocol/floor.ts` | une scène par étage suffit |
| Extension Chrome Atlas Dice | dépôt séparé `atlas-vtt/atlas-dice` | hors sujet |

## Comment leur code est construit

Utile pour aller y piocher sans se perdre.

- **Deux couches de protocole.** L'enveloppe (`protocol/relay.ts` : `hello`, `welcome`, `send`,
  `sends`, `game`, porte d'entrée, keepalive) est propre au relais : on l'ignore. Les messages de
  jeu (`GmMessage`, `PlayerMessage` dans `protocol/game.ts`, lus par `parseGmMessage` /
  `parsePlayerMessage`) sont du JSON simple avec des parseurs stricts, sans hypothèse de
  transport. Ils tournent déjà chez eux en SSE + POST (`protocol/stream.ts`).
- **Le côté MJ parle au réseau par des « ports »** (`sceneSharePorts.ts`, `bookSharePorts.ts`,
  `floorPorts.ts`) et lit Atlas par duck typing (`atlasMapLayers.ts`, `gmMarks.ts`,
  `presentedScene.ts`). Ses classes `*Share` peuvent donc, en principe, être branchées sur notre
  serveur à la place de `TableConnection`.
- **Niveaux de capacité** (`protocol/level.ts`, `GM_LEVEL = 7`) : datent les fonctions de la page
  joueur. 1 codes joueur, 2-3 repos, 4 `book-list`, 5 formules nommées, 6 avantage, 7 maximums
  modifiables. On n'en a pas besoin : notre page et notre MJ sortent toujours du même build.
- **Ce qui est public côté joueur** : seulement les modules « partagés » (`scripts/boundaries.mjs`,
  frontière `shared`) : `tableLog/` (journal de table en React), `marks/` (laser, règle, curseurs
  distants), `movement/` (collision avec les murs). Tout le reste de leur page joueur (rendu de la
  scène, fiche de personnage, initiative, plateau de dés) est privé : le relais la sert compilée,
  sans sources (`apps/play/` dans leur dépôt privé).
- **L'info cachée** est filtrée côté MJ avant envoi, dans chaque module (tokens sous alias
  aléatoires, portes secrètes envoyées comme des murs, champs de fiche selon `playerAccess`…).
  `redact.ts` ne sert qu'à nettoyer les rapports d'erreur.

## Chantiers, dans l'ordre

| # | Chantier | État |
| --- | --- | --- |
| 0 | Merge de la 0.10.1 | fait (27 octobre 2026) |
| 1 | Passer à leurs campagnes | à faire |
| 2 | Journal de table et chat | à faire |
| 3 | Fiche de personnage du joueur (3a, 3b, 3c) | à faire |
| 4 | Petites fonctions (4a à 4f) | à faire |

### 0. Merge de la 0.10.1

**État** : fait le 27 octobre 2026 (`5dc1b9ca`). Les vérifications en ligne ci-dessous restent à
faire en jouant.

Selon les règles habituelles de `FORK.md` : merge direct de `upstream/main` sur `main`, typecheck,
tests unitaires, build, push, puis on répare ensemble. `src/app/online/` n'est jamais touché.

**Ce que la 0.9 et la 0.10 apportent hors ligne** (changelog) :

- 0.9.0 : placement des tokens avec aperçu, Encounter Builder, actions de récupération (repos) dans
  les statblocks, compteurs et références `@` dans les modèles de statblock, initiative refaite
  (cartes, camps qui tirent leur ordre, combattants sans token, bannière de tour, retarder),
  PV de plusieurs tokens à la fois, avis de mise à jour, filtre du DM Screen.
- 0.9.1 : rotation de plusieurs tokens, **éclairage dynamique sorti de l'expérimental**, règles et
  sélection redessinées, roues de ressources.
- 0.10.0 : générateur de donjons, **couches de carte** (plusieurs couches par scène, sélecteur à
  gauche), rencontres aléatoires sur une épingle, notes créées par l'outil épingle, générateurs
  dans les tables aléatoires, **cartes animées (WebM, MP4)**, remplacer l'image d'une carte,
  import UVTT d'un bâtiment en un seul fichier avec un étage par niveau.
- 0.10.1 : correctif de l'éclairage sous Windows.

**À vérifier en ligne après le merge** (notre page joueur fait tourner le moteur, elle prend donc
ces changements de plein fouet) :

- une carte vidéo (WebM, MP4) : notre route `/image/<chemin>` et le chargement de l'image côté page ;
- une scène à plusieurs couches : la page affiche-t-elle la bonne couche, ou toutes ;
- l'initiative refaite : `PlayerInitiativePanel` / `playerInitiativeList` (modifiés des deux côtés) ;
- l'éclairage désormais toujours disponible : notre page doit rester sans éclairage (scène affichée
  non éclairée, comme aujourd'hui) ;
- les règles et la sélection redessinées : notre cadre de sélection (`SelectionManager`) et nos
  règles partagées (`PlayerRulers`).

**Fichiers modifiés des deux côtés depuis la 0.8.0** (conflits possibles ; hors tests et
traductions), par zone :

- Racine et build : `main.ts`, `package.json`, `scripts/boundaries.mjs`, `vitest.config.mts`,
  `styles/main.scss`.
- Vue et store : `atlas-view.ts`, `MapController.ts`, `PixiRendererOrchestrator.ts`,
  `storeFactory.ts`, `stores/uiSlice.ts`, `stores/initiativeEntries.ts`, `types.ts`,
  `types/collectionSettingsTypes.ts`, `types/diceTypes.ts`, `types/atlasWindowEvents.d.ts`.
- Canvas : `pixi/TokenRenderer.ts`, `TokenUIRenderer.ts`, `TokenControlsUI.ts`,
  `SelectionManager.ts`, `PinRenderer.ts`, `TextRenderer.ts`, `DrawingInteraction.ts`,
  `fog/FogOfWarRenderer.ts`, `hexLinks/HexLinkInteraction.ts`, `lighting/lightingMenus.ts`,
  `token-renderer/*` (ConditionBadgeRing, DragRuler, DragRulerView, EditTokenModal,
  EditTokenSections, InteractionController, resources/wheelAnchor, tokenSizing, types, UIManager).
- **Supprimés chez nous, modifiés chez eux** : `pixi/TokenResizeUI.ts`, `pixi/TokenRotationUI.ts`
  (on garde la suppression ; vérifier qu'aucune de leurs nouveautés n'y vivait, ex. la rotation de
  plusieurs tokens de la 0.9.1).
- Services : `AssetService.ts`, `AssetValidationService.ts`, `atlasSettings.ts`, `SettingsService.ts`,
  `ServiceManager.ts`, `RendererService.ts`, `MapPersistence.ts`, `ImageDisplayService.ts`,
  `NotePreviewUIManager.ts`, `PlayerWindowService.ts`, `PlayerInitiativePanel.ts`,
  `playerInitiativeList.ts`, `player-initiative.scss`, `collectionBundle/bundleSettings.ts`,
  `collectionBundle/collectionExport.ts`.
- Interface : `MainToolbar.tsx`, `toolbar/toolbarContext.ts`, `toolbarControls.tsx`,
  `useToolbarHotkeys.ts`, `toolbar/toolbarCatalog.ts`, `keyboard/mapHotkeys.ts`, `UIRoot.tsx`,
  `root/ContextMenuContext.tsx`, `context-menu/*`, `CollectionSettingsModal.tsx`,
  `collection-settings/*` (RulesSettingsTabs, SettingsDialog, useCollectionSettingsDraft),
  `InitiativeCard.tsx`, `initiativeCardMenu.ts`, `initiative-tracker.scss`.
- Dés : `tools/DiceTool.ts`, `dice3d/diceLook.ts`, `dice/DiceRollDisplay.tsx`, `dice/DiceTray.tsx`,
  `dice3d/DiceRollPanel.tsx`, `dice3d/dice-roll.scss`, `command-palette/DiceColourStrip.tsx`,
  `command-palette/DiceSettingsPanel.tsx`.
- Asset Manager : `AssetManager.tsx`, `TokenCreator.tsx`, `types.ts`, `components/AssetCard.tsx`,
  `components/ModalLayer.tsx`, `contextMenus/assetContextMenu.ts`, `hooks/useContextMenus.ts`,
  `utils/assetFormatters.ts`, `utils/tokenSpawnService.ts`.
- Divers : `imageProcessing/imageProcessing.ts`, `utils/activeLeafGuard.ts`.

Recalculer la liste au moment du merge (`git merge-base main upstream/main`, puis comparer les
`git diff --name-only` des deux côtés) si `upstream/main` a bougé.

### 1. Passer à leurs campagnes

**État** : à faire. **Prérequis** : chantier 0.

**Pourquoi** : on maintient en double ce que leurs campagnes font mieux, et chaque synchro en paie le
prix. La fiche de personnage (chantier 3) vit dans les fichiers de campagne.

**Leur modèle** (`src/app/campaigns/`, hors ligne, sur la page d'accueil d'Atlas) :

- une campagne a son propre dossier, indépendant des collections, et peut jouer des scènes de
  n'importe quelle collection (`campaignTypes.ts`, `CampaignService.ts`, `CampaignFiles.ts`) ;
- elle a une carte du monde, des quêtes (`quests/`), le temps de jeu et les scènes jouées
  (`campaignUsage.ts`, `recordCampaignPlay.ts`), un système de jeu facultatif (`campaignSystem.ts`) ;
- `players/playersFile.ts` (`players.json`) : chaque joueur a un id, un nom, un code et ses
  personnages (tokens de bibliothèque) ; `tokenAssignments.ts` attribue les tokens ;
- `partyValues/` (`PartySync`, `charactersFile.ts`) : les valeurs d'un personnage (PV, ressources)
  partagées entre tous ses tokens, écrites dans le fichier de la campagne ;
- `players/booksFile.ts`, `CampaignBooks.ts` : les fiches de personnage ;
- `playedCampaign.ts`, `useCampaignPlay.ts` : la campagne jouée en ce moment.

**Notre doublon** : profils par collection (`src/app/players/`, `CollectionSettings.players`,
onglet **Players**), `BaseToken.controlledBy`, fiche dans `TokenAsset.character` et `CharacterSync`
(`src/app/characters/`, qui existe aussi chez eux avec `playerCharacters.ts` et `playerVision.ts`).

**À faire chez nous** :

- les joueurs de la campagne jouée remplacent nos profils ; leurs codes à 6 chiffres sont ignorés ;
- l'attribution des tokens passe par `tokenAssignments.ts` au lieu de `controlledBy` ;
- `PartySync` remplace `CharacterSync` là où les deux font la même chose ;
- la page joueur demande « qui es-tu ? » parmi les joueurs de la campagne jouée
  (`client/profileChoice.ts`, `ProfileChooser.tsx`) ;
- migrer les profils et attributions existants (4 joueurs : une migration automatique ou à la main) ;
- garder ce que leurs campagnes n'ont pas : rôles PJ / PNJ, anneaux par collection, couleur et
  habillage des dés du joueur, `barsShownTo`.

**Points ouverts** :

- où ranger la couleur et les dés d'un joueur (leur `players.json` garde les champs inconnus :
  y ajouter les nôtres, ou un fichier à nous à côté) ;
- que fait la page joueur quand aucune campagne n'est jouée.

### 2. Journal de table et chat

**État** : à faire. **Prérequis** : chantier 1 (les auteurs des messages sont les joueurs de la
campagne).

**Ce que ça fait** : un journal partagé qui remplace notre historique des jets. Il contient le chat
(en personnage, emote, hors personnage), les chuchotements, les jets dans le texte (`[[1d20]]`) et
les boutons de jet, les réactions, les réponses et fils, l'édition et la suppression, les arrivées
et départs, les images montrées, les cartes de butin, les notes trouvées et les repos. Les jets
peuvent être secrets (`gm`, `blind`, `self`).

**Leur code** :

- interface React publique, à réutiliser telle quelle : `src/app/online/tableLog/*.tsx` (Composer,
  LogList, ThreadBar, ReactionChips, SecretRow, `chatCommands.ts`, `rollDice.tsx`, `styles/`) ;
- côté MJ : `gm/log/*` (TableLog, logStore, logEntries, logFanout, logReactions, LogPresence,
  gmSpeakers, logSpeakers, `diceLogTakeover` qui remplace le journal de dés d'Atlas),
  `gm/tableChat.ts` (API pour que d'autres plugins écrivent dans le journal) ;
- protocole : `protocol/log.ts`, `logParse.ts`, `logShown.ts`, `chat.ts` (messages `log`,
  `log-entry`, `log-remove`, `chat-refused`, `people`).

**On jette** : rien de spécifique, à part le transport.

**Chez nous** :

- le MJ fait autorité sur le journal (leur `logStore`), on le réplique par notre SSE et les
  joueurs postent par `POST /command` ;
- monter `tableLog/` dans la page joueur à la place de `PlayerDiceLog`, et côté MJ comme eux
  (`diceLogTakeover`) ;
- brancher nos jets (`PlayerDiceFeed`, `rollStamps.ts`) sur les entrées de jet du journal.

**Points ouverts** : le journal est-il gardé entre les sessions (fichier de campagne) ou vidé à
chaque lancement.

### 3. Fiche de personnage du joueur

**État** : à faire. **Prérequis** : chantier 1 (les fiches vivent dans la campagne).

Leur plus gros morceau, et toute l'interface joueur est à refaire (page privée). Côté MJ, tout est
dans `gm/book/` ; protocole dans `protocol/book*.ts` et `sheet*.ts`. Une fiche par personnage, dans
le fichier de fiches de la campagne (`BookShelf`, `campaignBookSource`, `bookMigration`,
`legacyBooks`) ; la fiche d'un joueur suit le token avec lequel il joue (`book-token`,
`characters.ts`) et n'est envoyée qu'à lui (`book`, `book-sheet`, `book-parts`).

**Point ouvert commun** : leur MJ envoie un statblock « dessiné » (mise en page, nœuds, textes longs
par hash, budget d'octets : `statblockShare.ts`, `statblockSheet(s).ts`, `sheetNodes.ts`,
`sheetLeaves.ts`, `sheetSigils.ts`, `sheetTexts.ts`, `sheetBudget.ts`, `protocol/bookStatblock.ts`,
`sheetLayout.ts`) parce que leur page ne peut pas faire tourner le moteur de statblocks. Notre page
le peut peut-être (le moteur tourne sans Obsidian) : vérifier si le rendu des statblocks natifs
(0.8) s'importe sans `obsidian`. Si oui, on envoie le statblock tel quel ; sinon on reprend leur
format dessiné.

#### 3a. Lecture seule

**État** : à faire.

Le joueur ouvre la fiche de son personnage depuis sa page : statblock natif, PV et ressources,
capacités, inventaire, bourse, emplacements, notes. Ce qu'il voit est réglé champ par champ par le
MJ (`playerAccess.ts`, `sheetFields.ts`, réglage `statblocks/editor/.../PlayersSetting.tsx`).

#### 3b. Modifications et jets

**État** : à faire.

- **Valeurs** : `book-field` (valeur ou cellule de tableau, avec un contrôle `base` contre les
  changements concurrents), `book-ability`, `book-list`, `book-refill`, maximums
  (`book-resource` avec `max`). Code : `fieldEdit.ts`, `abilityEdit.ts`, `abilityComponents.ts`,
  `listEdit.ts`, `counterEdit.ts`, `resourceEdit.ts`, `resourceWrites.ts`, `resourceMax.ts`,
  `trackedSheet.ts`, `placedResources.ts`, `characterValues.ts` ; protocole
  `bookStatblockEdits.ts`, `bookAbilities.ts`, `sheetValues.ts`, `sheetCounters.ts`.
- **Objets** : `book-item` (le MJ donne un objet tiré, `bookItem.ts`, `log/lootCard.ts`,
  `BookShare.give()`), `book-purse`, `book-equip`, `book-slots` (`bookSlots.ts`).
- **Notes** : `book-note`, `book-note-delete`.
- **Jets cliquables et références `@`** : le MJ résout les nombres à partir des valeurs que le
  joueur peut voir (`sheetReferences.ts`, `sheetRolls.ts`, `statblockChecks.ts`) ; les jets
  nomment leurs valeurs (« 2d8 + Agilité »).
- **Avantage / désavantage** : clic droit ou appui long sur un dé, tiré selon les règles du jeu de
  dés (`rollAdvantage.ts`, `protocol/dice.ts`).
- Limite de débit des écritures : `BookShare.ts`.

#### 3c. Repos

**État** : à faire.

Le joueur demande un repos court ou long, choisit ses étapes et actions (pour lui ou un autre
personnage) ; le MJ reçoit une carte, accepte ou refuse, et le journal note le repos. Messages
`book-rest`, `book-rest-answer`. Code : `bookRests.ts`, `restRequests.ts`, `restRules.ts`,
`restGate.ts`, `characterRests.ts`, `log/restEntry.ts`, `tableLog/RestRow.tsx`,
`src/app/recovery/characterRest.ts` (hors ligne, arrive avec le merge).

### 4. Petites fonctions

Indépendantes les unes des autres, à faire dans n'importe quel ordre.

#### 4a. Notes lisibles sur la carte

**État** : à faire. Le MJ rend une épingle lisible ; un joueur qui la clique reçoit le texte de la
note, qui s'ajoute au journal (« note trouvée »). Code : `gm/pins/*`, `protocol/mapLayers.ts`
(`pin-found`). Dépend du chantier 2 pour le journal.

#### 4b. Montrer une image aux joueurs

**État** : à faire. « Display on player view » d'Atlas montre l'image aux joueurs en ligne, sans
chemin ni nom de fichier. Code : `gm/image/*`, `protocol/image.ts` (`shown-image`).

#### 4c. Donner un objet depuis une table de butin

**État** : à faire. Depuis une Table ou une Base, envoyer un objet tiré à un joueur pendant une
session. Code : `BookShare.give()`, `log/lootCard.ts`. Dépend du chantier 3b (inventaire).

#### 4d. Widgets partagés

**État** : à faire. Compteurs, horloges, minuteurs du MJ visibles par les joueurs. Code :
`gm/WidgetShare.ts`, `widgetInputs.ts`, `protocol/widgets.ts`.

#### 4e. Déplacement seulement à son tour

**État** : à faire. Option : un joueur ne déplace ses tokens que pendant son tour d'initiative ;
sinon le déplacement est refusé. Code : `gm/playerMoves.ts`, `moveCheck.ts`, `turnShare.ts`,
drapeaux `turn` / `held` des tokens. Chez nous : un refus de plus dans `playerCommands.ts`.

#### 4f. Initiative : trouver un combattant, curseurs des joueurs

**État** : à faire.

- Clic sur un combattant de la liste d'initiative de la page joueur : la caméra va à son token.
- Curseurs des joueurs visibles par tous, si le MJ l'active (`gm/CursorShare.ts`,
  `marks/RemoteCursors`, message `cursor`, réglage transmis par `rules`).

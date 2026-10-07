# Notre fork d'Atlas VTT

Fork perso de [ByteMirror/atlas-vtt](https://github.com/ByteMirror/atlas-vtt) pour remplacer
Foundry VTT : les joueurs rejoignent la partie depuis un simple lien ouvert dans leur navigateur.
Usage perso uniquement, 1 à 4 joueurs.

Ce document liste tout ce qui diffère de l'original, pour reprendre le travail sur n'importe quel
PC ou dans une nouvelle session, et pour savoir où regarder quand on récupère les mises à jour du
dev d'origine.

**La fenêtre joueur locale (popout sur un second écran) ne nous sert pas** : on joue en ligne. On
n'y investit rien. Une feature n'a pas à y fonctionner, on ne la teste pas là, et on n'y touche que
si un changement pour le mode en ligne l'exige, en faisant au plus simple pour limiter les
conflits avec l'original.

## Dépôts et branches

| Remote     | Dépôt                        | Rôle                                         |
| ---------- | ---------------------------- | -------------------------------------------- |
| `origin`   | `hakimassouane2/atlas-vtt`   | notre fork, on y pousse                      |
| `upstream` | `ByteMirror/atlas-vtt`       | le dev d'origine, lecture seule (push coupé) |

- `main` : notre seule branche durable. Une grosse fonctionnalité se fait sur une branche
  temporaire, supprimée une fois fusionnée dans `main`.

Dernière synchro avec l'original : **0.6.0** (7 octobre 2026, merge de `upstream/main`).

Sur un nouveau PC :

```
git clone https://github.com/hakimassouane2/atlas-vtt.git
cd atlas-vtt
git remote add upstream https://github.com/ByteMirror/atlas-vtt.git
git remote set-url --push upstream DISABLED
npm ci
```

## Récupérer les mises à jour du dev d'origine

On suit sa branche `main` (les releases), pas `beta`. On merge, on ne rebase pas.

```
git fetch upstream
git log --oneline main..upstream/main      # ses nouveaux commits
git diff main...upstream/main --stat       # les fichiers qu'il a touchés
git merge upstream/main
npm run build && npm test
```

Avant de merger, comparer ses changements avec la liste des **points de contact** plus bas :
ce sont les seuls fichiers d'origine qu'on a modifiés, donc les seuls où un conflit est possible.

## Installer le build dans le vault

Le vault de jeu est `C:\Users\PC\Documents\obsidian-jdr` sur le PC,
`/Users/hakim/Documents/obsidian-jdr` sur le Mac. Les deux chemins sont inscrits dans
`scripts/worktree-targets.js` (`GAME_VAULTS`) : le build copie dans celui qui existe sur la machine,
sans variable à donner.

```
npm run build
```

Vérifier que le build finit par `✅ Copied plugin artifacts to obsidian-jdr` ; si le vault change
de place, mettre à jour `GAME_VAULTS` (`ATLAS_DEV_VAULTS` reste possible pour un vault de plus).

Puis désactiver et réactiver Atlas dans Obsidian (ou redémarrer Obsidian).
Sous Windows le build réécrit les fins de ligne de `CHANGELOG.md` et
`src/app/changelog/releases.json` : les restaurer avec
`git checkout -- CHANGELOG.md src/app/changelog/releases.json`.

## Mode en ligne

Le navigateur du joueur fait tourner **le moteur d'Atlas lui-même** (canvas PIXI, store, interactions)
sur une copie de la scène présentée, affichée en vue joueur : mêmes tokens, barres, noms, sélection,
contrôles, dés que chez le MJ. Décision et dette de sécurité : `docs/adr/0001-player-client-runs-the-canvas.md` ;
vocabulaire : `CONTEXT.md`.

### Utilisation

1. Réglages Atlas, section **Online session** : adresse publique (IP statique) et port
   (30002 par défaut, à ouvrir en TCP sur la box, comme le 30001 de Foundry). Sans adresse
   publique, le lien prend l'adresse de l'ordinateur sur le réseau local (`lanAddress.ts`) :
   un téléphone ou une tablette sur le même Wi-Fi peut le suivre.
2. Accueil Atlas : tuile **Online Session**. Elle démarre le serveur et copie le lien joueur, puis
   affiche les profils connectés.
   Commandes équivalentes : "Start online session and copy the player link", "Stop online session".
3. Rien à présenter : les joueurs voient toujours la scène ouverte chez le MJ (l'onglet de scène
   actif). Changer d'onglet ou ouvrir une scène les y emmène ; ils gardent l'image de l'ancienne
   pendant le chargement. La popout locale suit de la même façon ("Open player view" l'ouvre).
4. Réglages de la collection, onglet **Players** : un profil par joueur (nom et couleur, sans mot de
   passe). Puis donner les tokens : Edit Token, section **Players** (un interrupteur par profil), ou
   clic droit sur le token (ou la sélection), sous-menu **Players**. Un token peut appartenir à
   plusieurs profils ; un token sans profil n'est à personne. Les ressources que les joueurs voient et
   modifient sont celles de la collection marquées **Players see it** (onglet **Resources**).
5. Le joueur colle le lien dans son navigateur, choisit son profil (retenu par le navigateur pour
   cette collection ; Réglages > Playing as … pour en changer) et a la carte comme le MJ :
   - glisser ses tokens, ceux de son profil seulement (les autres le voient bouger en direct ; un token tenu par un joueur est
     verrouillé pour les autres), poignée de rotation, +/- de ses ressources sur le token ;
   - clic droit relâché sur place sur son token : menu Ressources / Conditions / Rotation ;
     clic droit glissé : déplacer la carte ; molette : zoomer (même caméra que le MJ) ;
   - barre en bas : plateau de dés, historique des jets (aussi Entrée) et réglages, un menu
     contextuel d'Atlas avec un sous-menu par réglage : Playing as (profil), My colour (grille des
     couleurs qu'aucun autre joueur n'a), My dice (un d20 par couleur, comme les réglages des dés du
     MJ, et les chiffres), les deux gardés dans son profil, et Input device (souris ou trackpad,
     retenu par le navigateur) ;
   - initiative à droite (avec les numéros d'instance, "Gobelin 2"), dés en 3D.
   Pendant un drag, tout le monde voit la règle (trajet, étapes posées avec Espace, distance) de
   celui qui déplace, dans sa couleur (accent pour le MJ), sauf pour un token caché aux joueurs.
   Chaque jet dit qui l'a lancé : le personnage s'il y en a un, sinon le joueur (dans la couleur de
   son profil) ou « GM ». Les dés de chacun gardent son habillage partout ; la vitesse et le choix
   3D ou carte sont ceux du MJ (réglages des dés), pour toute la table.
6. Ce que les joueurs voient suit tes réglages de la vue joueur (grille, noms, jets du MJ) et la
   visibilité de chaque ressource. Pas d'éclairage dynamique en ligne : le brouillard seul révèle.
7. "Reset link" dans les réglages invalide tous les liens déjà envoyés.

### Fonctionnement

- **Le moteur sans Obsidian** : le canvas (`PixiRendererOrchestrator` et ce qu'il importe) et le
  store (`createSceneStore`) n'importent ni `obsidian`, ni l'UI React du MJ, ni Node
  (`tests/unit/canvasImportGraph.test.ts`). Ce qui vient d'Obsidian passe par un `CanvasHost`
  (`src/app/canvas/canvasHost.ts`) : images, règles de collection, réglages, menu du token, joueur,
  éclairage, audio. L'hôte du MJ est `services/canvasHost/obsidianCanvasHost.ts`, celui du navigateur
  `online/client/pageCanvasHost.ts`. Notifications, icônes et menus passent par de petits registres
  que le plugin remplit au chargement (`ui/notices.ts`, `ui/icons.ts`, `ui/contextMenus.ts`).
- Serveur HTTP (`OnlineSessionServer`), chaque requête porte la clé (`?k=`) : `/` la page,
  `/client.js` et `/styles.css` (feuilles du MJ + `client/playerPage.css`), `/events` le flux SSE,
  `POST /command` les commandes, `/image/<chemin>` les images de la scène et des jets.
- **Réplication** (`online/scene/`) : `SceneReplicator` envoie la scène entière à l'arrivée d'un
  joueur et à chaque chargement (`scene`), puis seulement les objets et champs changés (`changes`),
  une fois par tâche (pas par frame : Obsidian en arrière-plan n'en dessine plus) ; `context` porte les règles de la collection et les réglages de la vue
  joueur. Le MJ fait seul autorité.
- **Commandes** : le joueur édite le store de sa page comme le MJ le sien ; `client/commandBridge.ts`
  traduit ses changements en commandes (`drag`, `move`, `rotate`, `resource`, `condition`,
  `conditionValue`, `roll`) ; le MJ les valide (`playerCommands.ts`, tokens du profil choisi
  seulement, hors historique d'annulation du MJ), `PlayerHolds` verrouille un token tenu. Une
  commande refusée remet la scène telle que le MJ l'a envoyée.
- **Profils** (`src/app/players/`) : `CollectionSettings.players` (`PlayerProfile` : id stable, nom,
  couleur de `RESOURCE_COLORS`), `BaseToken.controlledBy` (ids de profils, lus par `controllersOf` ;
  ceux d'un profil supprimé sont ignorés). La page choisit (`client/profileChoice.ts`,
  `ProfileChooser.tsx`, localStorage par collection) et l'annonce (`POST /profile`) à chaque
  connexion ; le MJ retient le profil de chaque connexion (`connectedPlayers.ts`) et le passe aux
  commandes. `isPlayerControlled(token, profileId)` décide des deux côtés. Les bundles ne portent
  jamais les profils (`withoutPlayers`).
- **Personnages** (`src/app/characters/`) : la config d'un personnage (joueurs, nameplate, anneau,
  taille, vision, lumière, camp, max saisis à la main, `linked`, `barsShownTo`) et, s'il est lié, ses
  ressources et conditions sont dans `TokenAsset.character` (index de la bibliothèque, écrit 0,5 s
  après la dernière modification). `CharacterSync` (un par vue) : une carte qui se charge et un token
  qui apparaît prennent la fiche ; un exemplaire modifié écrit la fiche (`AssetService.setCharacter`),
  que toutes les cartes ouvertes suivent (`atlas-vtt:character-changed`, hors annulation). Les cartes
  fermées se mettent à jour à leur ouverture. Un personnage sans fiche n'est touché qu'au premier
  réglage modifié. Les bundles ne portent pas la fiche (`withoutTableState`).
- **Barres par personnage** : `barsShownTo` (`everyone`, `controllers`, `nobody`) dans
  `visibleResources`, par le spectateur `controller` (joueur à qui le token est donné).
- **Jets** : chaque jet porte qui l'a fait (`DiceRollResult.roller`, copie du profil), son habillage
  (`look`, `RollLook` avec la couleur d'accent résolue ; `renderDicePreviews` et `DiceColourStrip`
  prennent une couleur d'accent et des libellés pour les aperçus du joueur) et `shownToPlayers`, posés au lancer
  (`online/rollStamps.ts` : `dmRollStamp` pour le MJ, `playerRollStamp` pour un joueur, dont l'accent
  est la couleur du profil). `PlayerDiceFeed` envoie les jets `shownToPlayers`, masqués pour un
  token caché ; `rollAuthor` décide du nom affiché (panneau 3D, carte, historique). L'habillage d'un
  joueur est dans `PlayerProfile.diceLook` (commande `diceLook`) ; sa couleur se change aussi depuis
  la page (commande `color`, une couleur de `RESOURCE_COLORS` qu'aucun autre profil n'a), par
  `CommandSource.updateProfile`. Un jet est dessiné dans son
  propre habillage (`dieAssets(sides, look)`, cache par habillage dans `dieMesh.ts`), la police des
  chiffres par `rollFontClass`. `context` porte `diceDisplay` du MJ. Les dés lisent leur
  environnement par un contexte React (`diceEnvironment.ts`).
- **Règles partagées** : `DragRuler` publie son trajet (token, départ, étapes) dans le store
  (`localRuler`, tranche UI). Une page l'envoie (commande `ruler`), le MJ le pose dans
  `sharedRulers` sous l'id de la connexion avec la couleur du profil (`PlayerControls`), et
  `PlayerRulers` envoie aux pages (`rulers`) celles des joueurs plus celle du MJ (`dm`) ; chaque
  page retire la sienne. `SharedDragRulers` (dans `TokenRenderer`) dessine celles de
  `sharedRulers` avec `DragRulerView`, jusqu'à la case où le token atterrirait là où il est
  (sa position arrive avec la réplication), et ignore sur une page un token caché.
- **Historique des joueurs** : `PlayerDiceLog` envoie (`diceLog`) le journal de la scène suivie
  (`diceLog` du store, 20 derniers), sans les jets que les joueurs n'ont pas vus, à chaque
  changement et à chaque arrivée. La page l'affiche avec `DiceRollLogPanel` (`client/pageDiceLog.tsx`) ;
  « Relancer » seulement sur ses propres jets.
- **Les joueurs suivent le MJ** (`services/followedScene.ts`) : la scène suivie est celle de la vue
  Atlas (une seule, ses onglets partagent un store et un canvas), dès que sa première scène est
  chargée. La session en ligne et la popout locale s'y abonnent (`onFollowedScene`) ; un changement
  de scène passe par le store (la réplication envoie la nouvelle scène entière une fois chargée, la
  popout tient sa dernière image puis fait un fondu enchaîné, `PlayerWindowService.watchScene`).
  La page joueur garde l'image de l'ancienne scène par-dessus son canvas jusqu'à ce que la nouvelle
  soit dessinée (`captureSceneTransition` dans `PlayerCanvas.showScene`). Vue Atlas fermée : la
  page reçoit `noScene` et revient au message d'attente ; la popout garde sa dernière image sous
  le message d'attente. Plus de bouton Show : œil des onglets, Maj+Entrée du sélecteur et
  `presentedTabId` supprimés.

### Fichiers ajoutés

- `src/app/canvas/canvasHost.ts` : ce que le canvas reçoit de son hôte.
- `src/app/canvas/sharedRulers.ts`, `pixi/token-renderer/SharedDragRulers.ts` : les règles des autres.
- `src/app/online/` (côté MJ) : `OnlineSession.ts`, `OnlineSessionServer.ts`, `PlayerControls.ts`,
  `playerCommands.ts`, `playerHolds.ts`, `playerTokens.ts`, `PlayerDiceFeed.ts`, `playerPage.ts`,
  `pageTheme.ts`, `tokenImage.ts`, `onlineSessionSettingsSection.ts`, `playerClient.d.ts`,
  `connectedPlayers.ts`, `OnlineConnections.tsx`, `PlayerDiceLog.ts`, `rollStamps.ts`,
  `PlayerRulers.ts`, et
  `scene/` (`sceneReplica.ts`, `sceneProtocol.ts`, `SceneReplicator.ts`).
- `src/app/players/` : `playerProfiles.ts`, `PlayerDot.tsx`, `players.scss` ; onglet
  `react/components/collection-settings/PlayersTab.tsx`, sous-menu `context-menu/playersMenu.ts`.
- `src/app/online/client/` (la page, compilée pour le navigateur par `vite/player-client.mts`) :
  `main.ts`, `PlayerCanvas.ts`, `pageCanvasHost.ts`, `commandBridge.ts`, `sceneConnection.ts`,
  `PlayerHud.tsx`, `playerTokenMenu.ts`, `pageDice.tsx`,
  `pageMenus.tsx`, `pageIcons.ts`, `initiativeOverlay.ts`, `pageStandIns.ts`, `session.ts`,
  `dom.ts`, `obsidianDom.ts`, `events.ts`, `playerPage.css`, `PlayerSettingsMenu.tsx`, `inputDevice.ts`, `pageZoomGuard.ts`,
  `profileChoice.ts`, `ProfileChooser.tsx`, `pageDiceLog.tsx`, `playerSettingsPanels.tsx`.
- `src/app/tools/rollAuthor.ts`, `react/components/dice-log/DiceRollLogPanel.tsx` (le panneau de
  l'historique, sorti de `DiceRollLog`).
- `src/app/services/followedScene.ts` : la scène que les écrans joueurs suivent.
- Côté MJ, sorties du moteur : `services/canvasHost/`, `services/TokenStatblockSync.ts`,
  `services/obsidianDiceEnvironment.ts`, `react/components/context-menu/gmTokenMenu.ts`,
  `pixi/audio/AudioFeature.ts`, `pixi/mapDisplay.ts`, `viewStore.ts`, `services/sceneFileVersion.ts`,
  `utils/imageMimeTypes.ts`, `keyboard/runtimePlatform.ts`.

### Points de contact dans le code d'origine

La séparation moteur / Obsidian touche beaucoup de fichiers de l'original ; au merge, garder ces
règles : le moteur prend ce qui vient d'Obsidian par `CanvasHost`, et `canvasImportGraph.test.ts`
doit rester vert.

- `PixiRendererOrchestrator`, `TokenRenderer`, `InteractionController`, `UIManager`,
  `TokenUIRenderer`, `TextureCache` : `CanvasHost` à la place de l'`App` d'Obsidian ; menu du token,
  synchronisation des fiches et audio sortis ; joueur (`CanvasPlayer`) pour les droits.
- `storeFactory.ts` : `createSceneStore` ; `createViewAtlasStore` est dans `viewStore.ts`.
- `scripts/worktree-targets.js` : `GAME_VAULTS`, nos vaults de jeu où le build se copie.
- `MapController`, `MapLoader` : affichage de la carte dans `pixi/mapDisplay.ts`.
- `ContextMenuContext.tsx`, `AtlasContextMenu.tsx` : registre et icônes dans `ui/` ;
  `ContextMenuContext` réexporte `ContextMenuEntry` et `ContextMenuOptions` de `ui/contextMenus.ts`.
- `DiceRollDisplay`, `useDiceAvatar`, `useDiceDisplay`, `useDiceLook`, `DiceDropdownMenu` :
  environnement des dés par contexte React.
- Règles partagées : `uiSlice` et `storeFactory` (`localRuler`, `sharedRulers`), `DragRuler`
  (publie son trajet ; `snapRulerPoint` et `drawRuler` exportés), `DragRulerView.draw` (couleur
  facultative), `TokenRenderer` (crée `SharedDragRulers`).
- Auteur et habillage des jets : `DiceTool` (`roller`, `look`, `shownToPlayers`, tampon du MJ passé
  par `ToolController`), `DiceRollHeader`, `DiceToast`, `DiceRollEntry` (nom de l'auteur, bouton
  Relancer facultatif), `DiceRollLog` (réduit à l'historique du MJ autour de `DiceRollLogPanel`),
  `DiceRollPanel` / `DiceStage` / `DiceRenderer.setPlan` / `dieMesh` / `dieArtwork.buildTextures`
  (habillage du jet), `dieSkin` (`resolveRollLook`), `diceLook` (`RollLook`, `toHex`,
  `readDiceLook`), `dice-roll.scss` (`__author`, `__names`, `.atlas-dice-font--medieval`).
- `gmTokenMenu`, `AtlasContextMenu`, `atlas-context-menu.scss` : le menu MJ du token est rangé en
  groupes (jeu, le token, qui le voit, copies, destruction) séparés par l'entrée `separator` ;
  sous-menus Fiche et Apparence.
- Tokens : plus de poignées de taille ni de rotation (`TokenResizeUI`, `TokenRotationUI` supprimés) ;
  Apparence ▸ (Taille, Rotate) agit sur toute la sélection (`tokenRotationMenu.ts`, partagé avec le
  menu joueur). L'interface d'un token sélectionné (nom, barres, roues, +/-) garde sa taille de repos
  et zoome avec la carte (`selectedTokenUIScale` supprimé).
- `PlayerInitiativePanel`, `InitiativeCard` : badge d'instance partagé (`shownInstanceNumber`).
- Joueurs qui suivent le MJ : `PlayerWindowPresenter` (réécrit : ouvrir, restaurer, suivre),
  `PlayerWindowService` (`follow` remplace `presentCanvas` / `holdCurrentFrame` /
  `releaseHeldFrame` / `releaseSource`), `PlayerFrameMirror` (`showsScene`), `local-player-view`
  (la session ne retient plus d'onglet), `playerWindowStore` (sans `presentedTabId`), `SceneTabBar`
  (sans œil), `SceneSwitcher` et son pied (sans Maj+Entrée), `UIRoot`, textes en/ru
  (`command`/`palette.sendMapToPlayerView` = "Open player view", clés de présentation retirées).
- `main.ts` : session en ligne, registres (notices, icônes, plateforme). `PlayerView`
  (`atlas-vtt-player`, jamais ouverte) est supprimée.
- `i18n/index.ts` : la langue est lue dans le `localStorage` (là où `getLanguage()` la lit), pas
  par l'import `obsidian`, que la page joueur n'a pas. Nos propres textes restent en anglais en dur.
- `MainToolbar` : `isPlayerView` vient du store ; `toolbarControls.tsx` passe `roll` au plateau de dés.
- `vite.config.mts`, `vitest.config.mts` (alias `events` pour les tests GPU), `atlasSettings.ts` et
  `SettingsService` (`onlineSession`, synchronisé avec les réglages du plugin), `PlayerWindowPresenter`, `dashboard-view.tsx`, `CommandPalette.tsx`,
  `EditTokenModal` (section Players), `gmTokenMenu` (sous-menu Players), `CollectionSettingsModal`
  (onglet Players), `bundleSettings.ts` (profils hors bundles). `playerLinked`, `playerId` et
  `playerCharacterId` sont retirés de `Character`.

### Limites connues

- **Sécurité** : le navigateur reçoit la scène en données, tokens cachés et zones sous le
  brouillard compris ; un joueur qui ouvre la console peut les lire (dette acceptée, ADR 0001).
- Pas d'éclairage dynamique en ligne.
- Profils sans mot de passe : n'importe qui avec le lien peut choisir n'importe quel profil.
- Les réglages d'un personnage ne suivent que les tokens de la bibliothèque (reconnus par leur
  image) ; un token sans personnage dans la bibliothèque garde ses réglages pour lui.
- Pas d'undo côté joueur ; pas de ping ni de règle de mesure partagée ; les pins restent cachés.
- Les jets s'affichent sans son chez les joueurs (les sons restent dans le plugin).
- Lien en `http` (pas de chiffrement) : suffisant entre amis, la clé du lien protège l'accès.

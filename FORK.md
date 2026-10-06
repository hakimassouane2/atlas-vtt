# Notre fork d'Atlas VTT

Fork perso de [ByteMirror/atlas-vtt](https://github.com/ByteMirror/atlas-vtt) pour remplacer
Foundry VTT : les joueurs rejoignent la partie depuis un simple lien ouvert dans leur navigateur.
Usage perso uniquement, 1 à 4 joueurs.

Ce document liste tout ce qui diffère de l'original, pour reprendre le travail sur n'importe quel
PC ou dans une nouvelle session, et pour savoir où regarder quand on récupère les mises à jour du
dev d'origine.

## Dépôts et branches

| Remote     | Dépôt                        | Rôle                                         |
| ---------- | ---------------------------- | -------------------------------------------- |
| `origin`   | `hakimassouane2/atlas-vtt`   | notre fork, on y pousse                      |
| `upstream` | `ByteMirror/atlas-vtt`       | le dev d'origine, lecture seule (push coupé) |

- `main` : notre seule branche durable. Une grosse fonctionnalité se fait sur une branche
  temporaire, supprimée une fois fusionnée dans `main`.

Dernière synchro avec l'original : **0.5.0** (3 octobre 2026, merge de `upstream/main`).

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
3. Dans la scène : **Présenter** ("Send to player view"). Les joueurs en ligne voient la scène ;
   la popout locale n'est plus nécessaire.
4. Réglages de la collection, onglet **Players** : un profil par joueur (nom et couleur, sans mot de
   passe). Puis donner les tokens : Edit Token, section **Players** (un interrupteur par profil), ou
   clic droit sur le token (ou la sélection), sous-menu **Players**. Un token peut appartenir à
   plusieurs profils ; un token sans profil n'est à personne. Les ressources que les joueurs voient et
   modifient sont celles de la collection marquées **Players see it** (onglet **Resources**).
5. Le joueur colle le lien dans son navigateur, choisit son profil (retenu par le navigateur pour
   cette collection ; Réglages > Change player pour en changer) et a la carte comme le MJ :
   - glisser ses tokens, ceux de son profil seulement (les autres le voient bouger en direct ; un token tenu par un joueur est
     verrouillé pour les autres), poignée de rotation, +/- de ses ressources sur le token ;
   - clic droit relâché sur place sur son token : menu Ressources / Conditions / Rotation ;
     clic droit glissé : déplacer la carte ; molette : zoomer (même caméra que le MJ) ;
   - barre en bas : plateau de dés et réglages (souris ou trackpad, retenu par le navigateur) ;
   - initiative à droite (avec les numéros d'instance, "Gobelin 2"), dés en 3D.
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
  au plus une fois par frame ; `context` porte les règles de la collection et les réglages de la vue
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
- `PlayerDiceFeed` envoie les jets des joueurs et ceux du MJ si `showDiceRolls`, masqués pour un
  token caché. Les dés lisent leur environnement par un contexte React (`diceEnvironment.ts`).
- Quand le MJ passe sur un autre onglet, les joueurs gardent leur scène et leurs commandes sont
  refusées ; au retour, la scène est renvoyée entière.

### Fichiers ajoutés

- `src/app/canvas/canvasHost.ts` : ce que le canvas reçoit de son hôte.
- `src/app/online/` (côté MJ) : `OnlineSession.ts`, `OnlineSessionServer.ts`, `PlayerControls.ts`,
  `playerCommands.ts`, `playerHolds.ts`, `playerTokens.ts`, `PlayerDiceFeed.ts`, `playerPage.ts`,
  `pageTheme.ts`, `tokenImage.ts`, `onlineSessionSettingsSection.ts`, `playerClient.d.ts`,
  `connectedPlayers.ts`, `OnlineConnections.tsx`, et
  `scene/` (`sceneReplica.ts`, `sceneProtocol.ts`, `SceneReplicator.ts`).
- `src/app/players/` : `playerProfiles.ts`, `PlayerDot.tsx`, `players.scss` ; onglet
  `react/components/collection-settings/PlayersTab.tsx`, sous-menu `context-menu/playersMenu.ts`.
- `src/app/online/client/` (la page, compilée pour le navigateur par `vite/player-client.mts`) :
  `main.ts`, `PlayerCanvas.ts`, `pageCanvasHost.ts`, `commandBridge.ts`, `sceneConnection.ts`,
  `PlayerHud.tsx`, `playerTokenMenu.ts`, `pageDice.tsx`,
  `pageMenus.tsx`, `pageIcons.ts`, `initiativeOverlay.ts`, `pageStandIns.ts`, `session.ts`,
  `dom.ts`, `obsidianDom.ts`, `events.ts`, `playerPage.css`, `PlayerSettingsMenu.tsx`, `inputDevice.ts`, `pageZoomGuard.ts`,
  `profileChoice.ts`, `ProfileChooser.tsx`.
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
- `ContextMenuContext.tsx`, `AtlasContextMenu.tsx` : registre et icônes dans `ui/`.
- `DiceRollDisplay`, `useDiceAvatar`, `useDiceDisplay`, `useDiceLook`, `DiceDropdownMenu` :
  environnement des dés par contexte React.
- `PlayerInitiativePanel`, `InitiativeCard` : badge d'instance partagé (`shownInstanceNumber`).
- `main.ts` : session en ligne, registres (notices, icônes, plateforme). `PlayerView`
  (`atlas-vtt-player`, jamais ouverte) est supprimée.
- `vite.config.mts`, `vitest.config.mts` (alias `events` pour les tests GPU), `SettingsService`
  (`onlineSession`), `PlayerWindowPresenter`, `dashboard-view.tsx`, `CommandPalette.tsx`,
  `EditTokenModal` (section Players), `gmTokenMenu` (sous-menu Players), `CollectionSettingsModal`
  (onglet Players), `bundleSettings.ts` (profils hors bundles). `playerLinked`, `playerId` et
  `playerCharacterId` sont retirés de `Character`.

### Limites connues

- **Sécurité** : le navigateur reçoit la scène en données, tokens cachés et zones sous le
  brouillard compris ; un joueur qui ouvre la console peut les lire (dette acceptée, ADR 0001).
- Pas d'éclairage dynamique en ligne.
- Profils sans mot de passe : n'importe qui avec le lien peut choisir n'importe quel profil.
- Pas d'undo côté joueur ; pas de ping ni de règle de mesure partagée ; les pins restent cachés.
- Les jets s'affichent sans son chez les joueurs (les sons restent dans le plugin).
- Lien en `http` (pas de chiffrement) : suffisant entre amis, la clé du lien protège l'accès.

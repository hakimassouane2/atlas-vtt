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

- `main` : notre version stable.
- `online` : développement du mode en ligne.

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

Le vault de jeu est `C:\Users\PC\Documents\obsidian-jdr`.

```
ATLAS_DEV_VAULTS="C:\Users\PC\Documents\obsidian-jdr" npm run build
```

Puis désactiver et réactiver Atlas dans Obsidian (ou redémarrer Obsidian).
Sous Windows le build réécrit les fins de ligne de `CHANGELOG.md` et
`src/app/changelog/releases.json` : les restaurer avec
`git checkout -- CHANGELOG.md src/app/changelog/releases.json`.

## Mode en ligne

### Utilisation

1. Réglages Atlas, section **Online session** : adresse publique (IP statique) et port
   (30002 par défaut, à ouvrir en TCP sur la box, comme le 30001 de Foundry).
2. Accueil Atlas : tuile **Online Session**. Elle démarre le serveur et copie le lien joueur.
   Commandes équivalentes : "Start online session and copy the player link", "Stop online session".
3. Dans la scène : **Présenter** ("Send to player view"). Les joueurs en ligne voient la scène ;
   la popout locale n'est plus nécessaire.
4. Edit Token d'un personnage : activer **Controlled by Players** pour que les joueurs puissent le
   déplacer, changer ses PV (et sa ressource secondaire, "Stress") et ses conditions.
5. Le joueur colle le lien dans son navigateur :
   - clic gauche sur son token et glisser pour le déplacer (anneau bleu à l'arrivée, snap à la
     grille comme un drag du MJ) ; clic gauche dans le vide et glisser pour déplacer la carte,
     molette pour zoomer, ⌖ pour revenir au cadrage du MJ ;
   - panneau en bas à gauche : PV, ressource secondaire et conditions de ses personnages ;
   - en bas à droite, les dés : d4 à d100 et formule libre ("Lancer pour" choisit le personnage) ;
   - ⚙ en haut à gauche : images par seconde et qualité (retenues dans son navigateur).
6. L'ordre d'initiative et les notifications de dés sont **ceux de la popout joueur d'Atlas**
   (mêmes composants, mêmes styles, ton thème Obsidian). L'initiative apparaît dès que ton
   tracker est ouvert ; noms et PV suivent les réglages de la vue joueur.
7. Les jets des joueurs sont tirés par ton moteur de dés (notification et journal de dés chez
   toi, avec le nom et le portrait du personnage) et affichés à tous. Tes jets ne vont aux joueurs
   que si "show dice rolls" est coché dans les réglages de la vue joueur.
8. **Players Follow My Camera** (palette Atlas) ou "Toggle online players following your camera"
   (palette Obsidian) : tous les joueurs voient à travers ta caméra et ne peuvent plus bouger la
   leur ; à la désactivation ils repartent de là où tu les as laissés.
9. Ce que les joueurs voient sur la carte suit tes réglages : grille cachée chez toi, cachée chez
   eux ; les tokens des joueurs montrent toujours leurs barres ; un nom affiché chez toi
   ("Show Nameplate") l'est chez eux ; les PV des monstres suivent les réglages de la vue joueur.
10. "Reset link" dans les réglages invalide tous les liens déjà envoyés.

### Fonctionnement

- Le plugin (Electron, donc Node disponible) lance un serveur HTTP (`OnlineSessionServer`).
  Chaque requête doit porter la clé du lien (`?k=`), sinon 403.
- **La page joueur** (`playerPage.ts`) charge deux fichiers :
  - `/client.js` : le client, écrit en TypeScript dans `src/app/online/client/` et compilé par
    `vite/player-client.mts` (esbuild, pendant le build du plugin, exposé en
    `virtual:atlas-player-client`). Il monte les **overlays de la popout joueur d'Atlas**
    (`PlayerInitiativePanel`, `PlayerDiceRolls`) tels quels. Pour qu'ils tournent hors
    d'Obsidian, le build remplace `obsidian` (`client/obsidianStub.ts`), `events`
    (`client/eventsStub.ts`) et le hook d'avatar lié au vault (`client/diceAvatar.ts`), et
    `client/obsidianDom.ts` ajoute les helpers DOM d'Obsidian (`createEl`, `createDiv`, `empty`…).
    Les imports SCSS sont ignorés : les styles viennent du fichier suivant.
  - `/styles.css` : toutes les feuilles de style de la fenêtre du MJ (Obsidian, thème, Atlas),
    lues au chargement de la page (`pageTheme.ts`), plus celles de la page
    (`client/playerPage.css`). La page porte les classes de thème du MJ et celles de la popout
    (`atlas-player-window`), donc les overlays ont exactement le rendu de la popout.
- Le navigateur ouvre un flux Server-Sent Events (`/events`) avec la taille de sa fenêtre, son
  framerate et sa qualité (`playerStreamRequest.ts`). Le serveur lui donne un id (`hello`) ; le
  flux apporte ses images (`frame`), l'état partagé (`state`, voir `protocol.ts`), le mode caméra
  (`mode`), le recentrage (`recenter`) et les jets de dés (`roll`, le `DiceRollResult` d'Atlas,
  que la page ré-émet en `atlas-dice-rolled` pour la notification d'Atlas). Aucune image n'est
  envoyée tant que le socket précédent n'est pas vidé (`drain`).
- **Caméra libre** : la page place tout de suite la dernière image sous la caméra du joueur, puis
  l'envoie (`POST /camera`, toutes les 50 ms au plus) ; les images suivantes sont rendues à travers
  elle. Chaque image dit si elle vient de la caméra du MJ (`isDmCamera`) : un joueur sans caméra
  propre (arrivée, recentrage, suivi du MJ) n'adopte que celles-là. Présenter une autre scène
  recentre tout le monde.
- `OnlineFrameStream` garde un "spectateur" par joueur (écran, caméra, framerate, qualité) et ne
  rend sa frame "sûre pour les joueurs" (mêmes couches que la popout : tokens cachés, pins MJ,
  brouillard, grille, barres) que si le canvas MJ a changé ou si sa caméra a bougé, puis l'encode
  en JPEG. `PlayerFrameRenderer` (un par joueur) rend la scène dans une `RenderTexture` à la
  taille exacte de l'écran du joueur, puis rend à nouveau le canvas MJ dans la même tâche.
- `PlayerControls` publie l'état (`protocol.ts`) : les tokens que les joueurs contrôlent
  (`playerTokens.ts`), les conditions de la collection (`mapConditions`), la scène pour les
  overlays (`playerScene.ts` : tokens visibles, initiative sans les tours cachés, noms et PV
  retirés si les réglages les cachent) et les réglages de la vue joueur. Il applique les
  commandes (`POST /command`, `playerCommands.ts`) : `move` (snappé avec `snapToCellCenter`),
  `resource` (borné via `resourceUpdates`), `condition` / `conditionValue` (seulement une
  condition que la collection définit), `roll` (`isSafeDiceFormula` : dés et modificateurs, 100
  dés au plus). Tout passe par les actions normales du store : sauvegarde automatique, et Ctrl+Z
  du MJ annule une action de joueur.
- `PlayerDiceFeed` écoute `atlas-dice-rolled` : chaque jet de joueur, et les jets du MJ si
  `showDiceRolls`, masqués pour un token caché (`diceRollForPlayers`, partagé avec la popout). Un
  jet de joueur pour un personnage est de type `statblock`, pour que les notifications d'Atlas
  montrent son nom et son portrait.
- `GET /image?path=` ne sert que l'artwork des tokens et tours d'initiative que les joueurs voient,
  et des jets reçus (`tokenImage.ts`) ; jamais un autre fichier du vault.
- Quand le MJ passe sur un autre onglet de scène, les joueurs gardent la dernière image et le
  dernier état, et leurs commandes sont refusées (le store de la vue contient alors l'autre
  scène) ; quand il revient, le direct reprend. Sans joueur connecté, rien n'est rendu.

### Fichiers ajoutés

- `src/app/online/` (côté MJ) :
  - `OnlineSession.ts` : démarrage, arrêt, lien, scène présentée, images autorisées.
  - `OnlineSessionServer.ts` : serveur HTTP, clé, flux SSE par joueur, routes de la page.
  - `OnlineFrameStream.ts` et `PlayerFrameRenderer.ts` : rendu et encodage des images par joueur.
  - `PlayerControls.ts`, `playerScene.ts`, `playerTokens.ts`, `playerCommands.ts` : état publié
    et commandes des joueurs.
  - `PlayerDiceFeed.ts` : jets de dés vers et depuis les joueurs.
  - `playerStreamRequest.ts`, `protocol.ts` : ce que la page demande et reçoit.
  - `playerPage.ts`, `pageTheme.ts`, `tokenImage.ts` : la page, ses styles, ses images.
  - `onlineSessionSettingsSection.ts` : la section de réglages.
  - `playerClient.d.ts` : type du module virtuel du client.
- `src/app/online/client/` (la page joueur, compilée pour le navigateur) : `main.ts` (démarrage),
  `connection.ts` (flux), `session.ts` (clé, requêtes), `playerState.ts` (état reçu), `camera.ts`,
  `frames.ts`, `mapInput.ts` (carte, drag, pan, zoom), `partyPanel.ts`, `diceLauncher.ts`,
  `streamSettings.ts`, `atlasOverlays.ts` (overlays d'Atlas), `dom.ts`, `playerPage.css`, et les
  remplaçants `obsidianStub.ts`, `eventsStub.ts`, `obsidianDom.ts`, `diceAvatar.ts`.
- `vite/player-client.mts` : compilation du client.
- `src/app/services/mapConditions.ts`, `src/app/tools/diceRollForPlayers.ts`,
  `src/app/pixi/token-renderer/playerTokenUISettings.ts` : règles partagées avec la popout.
- Tests (`tests/unit/`) : `onlineSessionServer`, `playerStreamRequest`, `playerCommands`,
  `playerScene`, `playerTokenUISettings`, `diceToolModifiers` ; `tests/mocks/playerClient.ts`
  remplace le module virtuel dans les tests.

### Points de contact dans le code d'origine

Garder ces modifications aussi petites que possible : ce sont les seuls endroits où un merge du
dev d'origine peut entrer en conflit.

- `main.ts` : crée `OnlineSession`, ajoute les trois commandes (démarrer, arrêter, suivre la
  caméra du MJ) et la section de réglages, arrête la session dans `onunload`.
- `vite.config.mts` : plugin `playerClient()` (compile la page joueur).
- `vitest.config.mts` : alias de `virtual:atlas-player-client` vers son mock.
- `src/app/services/SettingsService.ts` : réglage `onlineSession` (`port`, `publicHost`, `secret`)
  avec `getOnlineSessionSettings` / `setOnlineSessionSettings`.
- `src/app/services/PlayerWindowPresenter.ts` : `presentTabInPlayerWindow` envoie la scène à
  `OnlineSession` et n'ouvre la popout que si aucune session en ligne ne tourne.
- `src/app/dashboard-view.tsx` : tuile "Online Session".
- `src/app/react/components/CommandPalette.tsx` : entrée "Players Follow My Camera" (bascule,
  section mode, à côté de "Freeze Player Camera").
- `src/app/PixiRendererOrchestrator.ts` : la liste des couches de la vue joueur est sortie de
  `withPlayerSafeFrame` dans la méthode publique `getPlayerViewLayers`, et la grille n'y est
  visible que si le MJ l'affiche (**change aussi la popout**).
- `src/app/pixi/token-renderer/UIManager.ts` : barres et noms des tokens vus par les joueurs via
  `playerTokenUISettings` : tokens des joueurs toujours avec leurs barres, "Show Nameplate" du
  token respecté (**change aussi la popout**).
- `src/app/pixi/token-renderer/EditTokenModal.tsx` : interrupteur "Controlled by Players"
  (champ `playerLinked` existant, personnages seulement). L'interrupteur "Show Nameplate" et
  celui-ci partagent un petit composant local `ToggleField`.
- `src/app/services/PlayerInitiativePanel.ts` : le filtre "entrées visibles, dans l'ordre" est
  sorti dans `visibleInitiativeEntries` (exporté, même comportement).
- `src/app/react/components/dice/PlayerDiceToasts.tsx` : le masquage des jets pour un token caché
  est sorti dans `tools/diceRollForPlayers.ts` (même comportement).
- `src/app/pixi/TokenRenderer.ts` : la lecture des conditions de la collection passe par
  `services/mapConditions.ts` (même comportement).
- `src/app/tools/DiceTool.ts` : **correctif d'un bug d'origine**. Le nombre de dés d'un terme
  après un `+` était lu comme un modificateur (`2d6+1d8` ajoutait +1, `2d6+12d4+3` ajoutait +15).
  La regex des modificateurs ignore maintenant un nombre suivi de `d`. À proposer au dev d'origine.

Si le dev d'origine modifie `PlayerInitiativePanel`, `PlayerDiceRolls`, `PlayerDiceToasts`,
`DiceToast`, `useDiceAvatar` ou `TokenPortrait`, vérifier que le client joueur compile toujours
(`npm run build`) : il les utilise hors d'Obsidian. Une nouvelle dépendance à Obsidian dans ces
fichiers demande un remplaçant de plus dans `vite/player-client.mts`.

### Suite prévue

1. ~~Les joueurs déplacent leur token et modifient leurs PV.~~ Fait.
2. ~~Caméra libre pour les joueurs, et le MJ peut les forcer à suivre la sienne.~~ Fait.
3. ~~Initiative et dés côté joueur, avec les composants d'Atlas.~~ Fait.
4. ~~Conditions que le joueur active sur son token.~~ Fait.
5. Idées : widgets côté joueur (`PlayerWidgetBar`, même approche que l'initiative), lien par
   joueur, pinch-zoom tactile.

### Limites connues

- Un rendu par joueur : chaque image rend aussi à nouveau le canvas du MJ. Aucun souci à 1-2
  joueurs ; à 4 joueurs à 60 i/s, baisser leur framerate si Obsidian rame.
- Pas de pinch-zoom tactile sur la page joueur (molette uniquement).
- Les polices et images que les styles d'Obsidian chargent depuis l'application (`app://`) ne
  sont pas accessibles aux joueurs : leur navigateur prend une police de remplacement.
- `playerLinked` sert aussi ailleurs dans Atlas : un token contrôlé par les joueurs compte comme
  PJ (et non PNJ) dans l'initiative.
- Tout joueur qui a le lien peut déplacer tous les tokens "Controlled by Players" (un seul lien
  pour la table, pas de lien par joueur).
- Lien en `http` (pas de chiffrement) : suffisant entre amis, la clé du lien protège l'accès.
- Les 3 tests en échec de la suite d'origine (`playerWindowPresenter`, `worktreeTargets`)
  échouent déjà sur l'original sous Windows.

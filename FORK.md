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
   déplacer et changer ses PV (et sa ressource secondaire, "Stress").
5. Le joueur colle le lien dans son navigateur. Il fait glisser son token (un anneau bleu montre
   où il va atterrir, snap à la grille comme un drag du MJ) et change ses PV dans le panneau en bas
   à gauche. La roue en haut à droite règle ses images par seconde et la qualité (retenues dans son
   navigateur).
6. "Reset link" dans les réglages invalide tous les liens déjà envoyés.

### Fonctionnement

- Le plugin (Electron, donc Node disponible) lance un serveur HTTP (`OnlineSessionServer`).
  La page joueur est du HTML/JS vanilla servi par ce serveur (`playerPage.ts`).
- Chaque requête doit porter la clé du lien (`?k=`), sinon 403.
- Le navigateur du joueur ouvre un flux Server-Sent Events (`/events`) en indiquant la taille de
  sa fenêtre, son framerate et sa qualité (`playerStreamRequest.ts`). Un seul rendu sert tous les
  joueurs : le plus grand écran, le framerate et la qualité les plus élevés. Chaque joueur reçoit
  ensuite les images à son propre rythme, et jamais plus vite que sa connexion ne les absorbe
  (le serveur attend le `drain` du socket).
- `OnlineFrameStream` rend la frame "sûre pour les joueurs" (mêmes couches cachées que la vue
  joueur locale : tokens cachés, pins MJ, brouillard) uniquement quand le canvas MJ a changé,
  l'encode en JPEG et la pousse en base64 dans le flux SSE.
- `PlayerFrameRenderer` rend la scène dans une `RenderTexture` à la taille exacte de l'écran du
  joueur (plein écran et net), avec le centre et le zoom de la caméra du MJ, puis rend à nouveau
  le canvas MJ dans la même tâche (le MJ ne voit jamais la frame joueur).
- Chaque image arrive avec la caméra qui l'a rendue (`FrameView`) : la page joueur convertit
  elle-même ses clics en coordonnées de la carte, sans aller-retour.
- `PlayerControls` publie dans le flux SSE (`state`) les tokens que les joueurs contrôlent
  (`playerTokens.ts` : personnages `playerLinked`, non cachés) et applique leurs commandes
  (`POST /command`, `playerCommands.ts` : `move` snappé avec `snapToCellCenter`, `resource`
  borné entre 0 et le max via `resourceUpdates`). Les commandes passent par les actions normales
  du store : sauvegarde automatique, et le MJ peut annuler un déplacement de joueur avec Ctrl+Z.
- Quand le MJ passe sur un autre onglet de scène, les joueurs gardent la dernière image et leurs
  commandes sont refusées (le store de la vue contient alors l'autre scène) ; quand il revient,
  le direct reprend. Sans joueur connecté, rien n'est rendu.

### Fichiers ajoutés

- `src/app/online/OnlineSession.ts` : démarrage, arrêt, lien, scène présentée, état pour l'accueil.
- `src/app/online/OnlineSessionServer.ts` : serveur HTTP, clé, flux SSE par joueur.
- `src/app/online/OnlineFrameStream.ts` : quand rendre et encoder une frame.
- `src/app/online/PlayerFrameRenderer.ts` : rendu à la taille de l'écran joueur.
- `src/app/online/playerStreamRequest.ts` : ce que demande chaque joueur, et leur combinaison.
- `src/app/online/PlayerControls.ts` : état des tokens joueurs et commandes, seulement en direct.
- `src/app/online/playerTokens.ts` : quels tokens les joueurs contrôlent, et ce qu'ils en voient.
- `src/app/online/playerCommands.ts` : validation et application des commandes joueur.
- `src/app/online/playerPage.ts` : la page joueur (image, drag, panneau PV, réglages).
- `src/app/online/onlineSessionSettingsSection.ts` : la section de réglages.
- `tests/unit/onlineSessionServer.test.ts`, `tests/unit/playerStreamRequest.test.ts`,
  `tests/unit/playerCommands.test.ts`.

### Points de contact dans le code d'origine

Garder ces modifications aussi petites que possible : ce sont les seuls endroits où un merge du
dev d'origine peut entrer en conflit.

- `main.ts` : crée `OnlineSession`, ajoute les deux commandes et la section de réglages, arrête la
  session dans `onunload`.
- `src/app/services/SettingsService.ts` : réglage `onlineSession` (`port`, `publicHost`, `secret`)
  avec `getOnlineSessionSettings` / `setOnlineSessionSettings`.
- `src/app/services/PlayerWindowPresenter.ts` : `presentTabInPlayerWindow` envoie la scène à
  `OnlineSession` et n'ouvre la popout que si aucune session en ligne ne tourne.
- `src/app/dashboard-view.tsx` : tuile "Online Session".
- `src/app/PixiRendererOrchestrator.ts` : la liste des couches de la vue joueur est sortie de
  `withPlayerSafeFrame` dans la méthode publique `getPlayerViewLayers` (même comportement).
- `src/app/pixi/token-renderer/EditTokenModal.tsx` : interrupteur "Controlled by Players"
  (champ `playerLinked` existant, personnages seulement). L'interrupteur "Show Nameplate" et
  celui-ci partagent un petit composant local `ToggleField`.

### Suite prévue

1. ~~Les joueurs déplacent leur token et modifient leurs PV.~~ Fait.
2. Gel de la caméra joueur valable aussi pour les joueurs en ligne (aujourd'hui ils suivent la
   caméra du MJ).
3. Plus tard : initiative, widgets, dés, conditions côté joueur.

### Limites connues

- Les joueurs voient avec la caméra du MJ (centre et zoom) ; ils ne peuvent pas se déplacer seuls.
- `playerLinked` sert aussi ailleurs dans Atlas : un token contrôlé par les joueurs compte comme
  PJ (et non PNJ) dans l'initiative.
- Tout joueur qui a le lien peut déplacer tous les tokens "Controlled by Players" (un seul lien
  pour la table, pas de lien par joueur).
- Lien en `http` (pas de chiffrement) : suffisant entre amis, la clé du lien protège l'accès.
- Les 3 tests en échec de la suite d'origine (`playerWindowPresenter`, `worktreeTargets`)
  échouent déjà sur l'original sous Windows.

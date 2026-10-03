/**
 * Stands in for the `obsidian` module in the player page's bundle (see
 * `vite/player-client.mts`). The Atlas overlays the page runs only import
 * Obsidian's types, which erase, and `App` and `View`, which they never construct
 * (`View` only for `instanceof` checks that find none on the page).
 */
export class App {}

export class View {}

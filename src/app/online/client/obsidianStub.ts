/**
 * Stands in for the `obsidian` module in the player page's bundle (see
 * `vite/player-client.mts`). The Atlas overlays the page runs only import
 * Obsidian's types, which erase, and `App`, which they never construct.
 */
export class App {}

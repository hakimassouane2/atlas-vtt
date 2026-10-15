import EventEmitter from 'eventemitter3';

/**
 * Node's `events` for the player canvas page (`vite/player-client.mts`): the canvas only uses
 * `on`, `off` and `emit`, which PIXI's own emitter has too.
 */
export { EventEmitter };

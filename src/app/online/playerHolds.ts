/** How long a drag keeps its token after the player's last move: a page gone mid-drag lets go. */
export const HOLD_MS = 2000;

/**
 * The tokens players are dragging, by whom. While one player drags a token, nobody else may
 * drag or drop it: the token never jumps from one hand to another.
 */
export class PlayerHolds {
  private readonly holds = new Map<string, { playerId: string; at: number }>();

  /** Whether `playerId` may drag or drop `tokenId` now: no other player holds it. */
  allows(tokenId: string, playerId: string | null, now: number = Date.now()): boolean {
    const hold = this.holds.get(tokenId);
    return !hold || hold.playerId === playerId || now - hold.at > HOLD_MS;
  }

  /** `playerId` drags `tokenId`; a player without an id holds nothing. */
  take(tokenId: string, playerId: string | null, now: number = Date.now()): void {
    if (playerId) this.holds.set(tokenId, { playerId, at: now });
  }

  /** The token was dropped. */
  release(tokenId: string): void {
    this.holds.delete(tokenId);
  }

  /** The player left: whatever they held is free. */
  releasePlayer(playerId: string): void {
    for (const [tokenId, hold] of this.holds) if (hold.playerId === playerId) this.holds.delete(tokenId);
  }
}

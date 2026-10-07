import type { SettingsService } from '../services/SettingsService';
import type { RollStamp } from '../tools/DiceTool';
import type { PlayerProfile } from '../types/collectionSettingsTypes';
import { readDiceLook, toHex } from '../dice3d/diceLook';
import { readAccent } from '../dice3d/diceLookRuntime';

/**
 * The DM's rolls: thrown in the DM's look, with Obsidian's accent, and shown to players while the
 * player view shows dice rolls. Without settings (a vault that cannot be reached), Atlas' default look, shown to nobody.
 */
export function dmRollStamp(settings: SettingsService | undefined, doc: Document): RollStamp {
  if (!settings) return { look: readDiceLook(null), shownToPlayers: false };
  const look = settings.getDiceLook();
  const accent = look.colour === 'accent' ? readAccent(doc) : null;
  return {
    look: accent ? { ...look, accent: toHex(accent) } : { ...look },
    shownToPlayers: settings.getLocalPlayerViewSettings().showDiceRolls,
  };
}

/** A player's rolls: signed with their profile and thrown in its look, whose accent is the profile's colour. Always shown. */
export function playerRollStamp(profile: PlayerProfile | null): RollStamp {
  if (!profile) return { roller: { name: 'Player' }, look: readDiceLook(null), shownToPlayers: true };
  const look = readDiceLook(profile.diceLook);
  return {
    roller: { profileId: profile.id, name: profile.name.trim() || 'Player', color: profile.color },
    look: look.colour === 'accent' ? { ...look, accent: profile.color } : look,
    shownToPlayers: true,
  };
}

/** What a scene file (`.atlasmap`) names itself, so Atlas recognises it. */
export const ATLAS_SCHEMA = 'atlas-vtt' as const;
/**
 * The version of the scene state in memory, and of every scene file with one level. Never bumped
 * for a change older versions can ignore: they load a file of a higher version empty (up to
 * 0.6.0) or refuse it. A scene with several levels is written as `LEVELS_FILE_VERSION`.
 */
export const ATLAS_VERSION = 4;

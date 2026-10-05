/** What a scene file (`.atlasmap`) names itself, so Atlas recognises it. */
export const ATLAS_SCHEMA = 'atlas-vtt' as const;
/**
 * The scene file format's version. An older Atlas loads a map with a higher version empty and
 * saves that over the file, so never raise it for a change older versions can ignore.
 */
export const ATLAS_VERSION = 4;

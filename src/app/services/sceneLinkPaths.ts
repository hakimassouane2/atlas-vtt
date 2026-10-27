/** The file a note link opens: `Notes/Cave.md#Entrance` opens `Notes/Cave.md`. */
export const linkedFilePath = (link: string): string => link.split('#', 1)[0]!;

/** The scene map a pin's link opens, or null when it opens a note. */
export function linkedMapPath(link: string): string | null {
  const path = linkedFilePath(link);
  return path.toLowerCase().endsWith('.atlasmap') ? path : null;
}

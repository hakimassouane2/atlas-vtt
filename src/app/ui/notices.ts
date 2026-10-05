/** Shows a short message: Obsidian's notice in the plugin, the page's own in a player's browser. */
export type NoticePresenter = (message: string, durationMs?: number) => void;

let presenter: NoticePresenter | null = null;

/** Makes `next` show every notice until the function it returns is called. */
export function setNoticePresenter(next: NoticePresenter): () => void {
  presenter = next;
  return () => {
    if (presenter === next) presenter = null;
  };
}

/** Tells whoever uses Atlas `message`, for `durationMs` or the presenter's default; logged where nothing shows notices. */
export function showNotice(message: string, durationMs?: number): void {
  if (presenter) presenter(message, durationMs);
  else console.warn(`[Atlas] ${message}`);
}

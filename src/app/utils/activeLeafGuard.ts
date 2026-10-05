
/**
 * Returns true when the currently active Obsidian workspace leaf
 * contains an Atlas VTT view (map canvas or player view).
 *
 * When `viewId` is provided, checks that the **specific** view's
 * container lives inside the active leaf — this is essential when
 * multiple Atlas views are open side-by-side.
 */
export function isActiveAtlasLeaf(viewId?: string): boolean {
  const activeLeaf = document.querySelector('.workspace-leaf.mod-active');
  if (!activeLeaf) return false;

  // Scoped check: does THIS view live inside the active leaf?
  if (viewId) {
    return activeLeaf.querySelector(`[data-view-id="${viewId}"]`) !== null;
  }

  // Broad check: does the active leaf contain any atlas view?
  return (
    activeLeaf.querySelector('.atlas-react-ui-container') !== null ||
    activeLeaf.querySelector('#atlas-pixi-canvas-debug') !== null ||
    activeLeaf.querySelector('.view-content[data-type="atlas-vtt"]') !== null
  );
}

/**
 * Returns true when a keyboard shortcut scope is currently active.
 *
 * For content inside an Obsidian workspace leaf, this means that leaf must be active.
 * For portaled modals/overlays outside the workspace leaf tree, this means focus must
 * currently live inside the provided scope.
 */
export function isShortcutScopeActive(scope: Element | null, viewId?: string): boolean {
  if (scope) {
    const workspaceLeaf = scope.closest('.workspace-leaf');
    if (workspaceLeaf) {
      return workspaceLeaf.classList.contains('mod-active');
    }

    const activeElement = document.activeElement;
    if (activeElement instanceof Node && scope.contains(activeElement)) {
      return true;
    }
  }

  return isActiveAtlasLeaf(viewId);
}

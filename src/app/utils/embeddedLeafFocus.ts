import { View, type Workspace, type WorkspaceLeaf } from 'obsidian';

type WorkspaceWithSetActiveLeaf = {
  setActiveLeaf?: ((leaf: WorkspaceLeaf, options?: { focus?: boolean }) => void) | undefined;
};

/** The leaf that currently owns workspace focus, whatever its view type. */
export function getActiveWorkspaceLeaf(workspace: Pick<Workspace, 'getActiveViewOfType'>): WorkspaceLeaf | null {
  return workspace.getActiveViewOfType(View)?.leaf ?? null;
}

function getWorkspaceLeafElement(leaf: WorkspaceLeaf | null | undefined): HTMLElement | null {
  const candidate = (
    (leaf as (WorkspaceLeaf & { view?: { containerEl?: HTMLElement | null } }) | null | undefined)?.view?.containerEl
    ?? (leaf as (WorkspaceLeaf & { containerEl?: HTMLElement | null }) | null | undefined)?.containerEl
    ?? null
  );

  if (!(candidate instanceof HTMLElement)) {
    return null;
  }

  return candidate.closest('.workspace-leaf');
}

export function isWorkspaceLeafSelected(leaf: WorkspaceLeaf | null | undefined): boolean {
  return getWorkspaceLeafElement(leaf)?.classList.contains('mod-active') ?? false;
}

export function suppressActiveLeaf(workspace: WorkspaceWithSetActiveLeaf): () => void {
  const originalSetActiveLeaf = workspace.setActiveLeaf?.bind(workspace);
  if (!originalSetActiveLeaf) {
    return () => {};
  }

  workspace.setActiveLeaf = (() => {});
  return () => {
    workspace.setActiveLeaf = originalSetActiveLeaf;
  };
}

export function restorePreservedLeaf(
  workspace: WorkspaceWithSetActiveLeaf,
  leafToPreserve: WorkspaceLeaf | null | undefined,
): void {
  if (!leafToPreserve || typeof workspace.setActiveLeaf !== 'function') {
    return;
  }

  if (!isWorkspaceLeafSelected(leafToPreserve)) {
    return;
  }

  workspace.setActiveLeaf(leafToPreserve, { focus: false });
}

type FocusWorkspaceLike = Pick<Workspace, 'getActiveViewOfType' | 'setActiveLeaf'>;

/**
 * Reclaim workspace ownership for a custom Atlas view when another leaf keeps
 * a focused editor/input alive after a tab switch.
 */
export function claimWorkspaceLeafFocus(
  workspace: FocusWorkspaceLike | null | undefined,
  leaf: WorkspaceLeaf | null | undefined,
  container: HTMLElement | null,
): void {
  if (!workspace || !leaf || !container) {
    return;
  }

  if (getActiveWorkspaceLeaf(workspace) !== leaf) {
    workspace.setActiveLeaf(leaf, { focus: false });
  }

  const targetLeafEl = container.closest('.workspace-leaf');
  const activeElement = document.activeElement;
  const activeLeafEl = activeElement instanceof HTMLElement
    ? activeElement.closest('.workspace-leaf')
    : null;

  const shouldFocusContainer =
    activeElement === document.body ||
    activeElement === null ||
    (targetLeafEl !== null && activeLeafEl !== null && activeLeafEl !== targetLeafEl);

  if (shouldFocusContainer && typeof container.focus === 'function') {
    if (container.tabIndex < 0) {
      container.tabIndex = -1;
    }
    container.focus({ preventScroll: true });
  }
}

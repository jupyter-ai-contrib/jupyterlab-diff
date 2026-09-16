import type { UnifiedCellDiffManager } from './unified-cell';

/**
 * Shared registry of notebook-level diff managers.
 *
 * Both the command-driven unified cell diff plugin and the metadata-diff
 * observer register their managers here so the notebook-level
 * "Accept All / Reject All" panel can operate across every pending diff. This
 * lives in its own module so neither consumer has to import the other (avoids
 * a circular import between `plugin.ts` and `metadata-diff/plugin.ts`).
 */
const notebookDiffRegistry = new Map<string, UnifiedCellDiffManager[]>();

/**
 * Register a diff manager against a notebook.
 *
 * The manager is dropped automatically when it is disposed (it emits a
 * `disposed` signal — it may dispose itself on accept/reject, so an external
 * unregister call is not enough).
 *
 * Resolution is op-aware because each manager's `acceptAll`/`rejectAll` already
 * encodes its op.
 */
export function registerNotebookManager(
  notebookId: string,
  manager: UnifiedCellDiffManager
): void {
  if (!notebookDiffRegistry.has(notebookId)) {
    notebookDiffRegistry.set(notebookId, []);
  }
  notebookDiffRegistry.get(notebookId)!.push(manager);
  manager.disposed.connect(() => {
    const list = notebookDiffRegistry.get(notebookId) ?? [];
    notebookDiffRegistry.set(
      notebookId,
      list.filter(m => m !== manager)
    );
  });
}

/**
 * Get the managers registered for a notebook.
 */
export function getNotebookManagers(
  notebookId: string
): UnifiedCellDiffManager[] {
  return notebookDiffRegistry.get(notebookId) ?? [];
}

/**
 * Drop all managers registered for a notebook (e.g. when it is closed).
 */
export function clearNotebookManagers(notebookId: string): void {
  notebookDiffRegistry.delete(notebookId);
}

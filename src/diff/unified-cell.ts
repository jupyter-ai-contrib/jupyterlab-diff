import { Cell, MarkdownCell } from '@jupyterlab/cells';
import { NotebookPanel } from '@jupyterlab/notebook';
import { checkIcon, ToolbarButton, undoIcon } from '@jupyterlab/ui-components';
import { ICellFooterTracker } from 'jupyterlab-cell-input-footer';
import {
  BaseUnifiedDiffManager,
  IBaseUnifiedDiffOptions
} from './base-unified-diff';
import type { ISharedText } from '@jupyter/ydoc';
import type { DiffOp } from '../metadata-diff/types';

/**
 * Options for creating a unified diff view for a cell
 */
export interface IUnifiedCellDiffOptions extends IBaseUnifiedDiffOptions {
  /**
   * The cell widget to show the diff for
   */
  cell: Cell;

  /**
   * The cell footer tracker
   */
  cellFooterTracker?: ICellFooterTracker;

  /**
   * The diff operation this view represents.
   *
   * When provided, accept/reject become op-aware (see the resolution matrix in
   * the metadata-diff plugin). Defaults to `edit`.
   */
  op?: DiffOp;

  /**
   * The notebook panel that owns the cell.
   *
   * Required for op-aware resolution: structural changes (removing a cell) go
   * through the notebook shared model, and every resolution is wrapped in a
   * single undoable notebook transaction so it participates in notebook undo.
   */
  notebook?: NotebookPanel;

  /**
   * Callback invoked to clear the pending diff marker once a resolution is
   * applied. It runs *inside* the same undoable transaction as the source or
   * structure change so that a single undo restores both the content and the
   * marker.
   *
   * Not called when the cell itself is removed (the marker goes away with it).
   */
  onResolve?: () => void;
}

/**
 * Manages unified diff view directly in cell editors
 */
export class UnifiedCellDiffManager extends BaseUnifiedDiffManager {
  /**
   * Construct a new UnifiedCellDiffManager
   */
  constructor(options: IUnifiedCellDiffOptions) {
    super(options);
    this._cell = options.cell;
    this._cellFooterTracker = options.cellFooterTracker;
    this._op = options.op ?? 'edit';
    this._notebook = options.notebook;
    this._onResolve = options.onResolve;
    this.activate();
  }

  private static _activeDiffCount = 0;
  private _toolbarObserver?: MutationObserver;
  private _wasRendered = false;

  /**
   * Check if this cell still has pending changes
   */
  public hasPendingChanges(): boolean {
    // For structural ops (add/delete) the diff is always considered pending
    // while the marker is present, even though the live source may match the
    // computed "new" side (a delete keeps its original content until resolved).
    if (this._op !== 'edit') {
      return !this.isDisposed;
    }
    return this.originalSource !== this._cell.model.sharedModel.getSource();
  }

  /**
   * Accept the pending change for this cell (op-aware).
   *
   * - edit: keep the new source
   * - add: keep the cell
   * - delete: remove the cell
   */
  public acceptAll(): void {
    this._resolve('accept');
  }

  /**
   * Reject the pending change for this cell (op-aware).
   *
   * - edit: restore the original source
   * - add: remove the cell
   * - delete: keep the cell (restoring its original content)
   */
  public rejectAll(): void {
    this._resolve('reject');
  }

  /**
   * Apply an op-aware resolution, then tear the diff view down.
   *
   * Cell-surviving resolutions (edit accept/reject, delete reject) go through
   * the CELL's own shared model. Edit-mode Cmd+Z is the JupyterLab Edit-menu
   * undoer for the focused cell, which drives the *per-cell* editor undo manager
   * (the same one that undoes typing) — NOT the notebook manager. Routing the
   * source + marker changes through the cell's shared model puts them on that
   * per-cell manager, so a single edit-mode undo restores the content and the
   * marker together (re-showing the diff) and redo re-applies the resolution.
   *
   * Cell removals (add reject, delete accept) are structural, so they must go
   * through the notebook shared model; those are only undoable from command mode
   * (there is no cell editor to focus once the cell is gone).
   */
  private _resolve(action: 'accept' | 'reject'): void {
    const cellModel = this._cell.model;
    const sharedNotebook = this._notebook?.model?.sharedModel;

    const removeCell = (): boolean => {
      const model = this._notebook?.model;
      if (!sharedNotebook || !model) {
        return false;
      }
      const cells = model.cells;
      for (let i = 0; i < cells.length; i++) {
        if (cells.get(i).id === cellModel.id) {
          sharedNotebook.deleteCell(i);
          return true;
        }
      }
      return false;
    };

    // Whether this resolution removes the cell entirely (add-reject or
    // delete-accept) — a structural change that must go through the notebook.
    const removesCell =
      (this._op === 'add' && action === 'reject') ||
      (this._op === 'delete' && action === 'accept');

    const apply = (): void => {
      let cellRemoved = false;

      switch (this._op) {
        case 'add':
          if (action === 'reject') {
            cellRemoved = removeCell();
          }
          break;
        case 'delete':
          if (action === 'accept') {
            cellRemoved = removeCell();
          } else {
            // Keep the cell; restore the content that was blanked when the
            // deletion diff was rendered.
            cellModel.sharedModel.setSource(this.originalSource);
          }
          break;
        case 'edit':
        default:
          if (action === 'reject') {
            cellModel.sharedModel.setSource(this.originalSource);
          }
          break;
      }

      // If the cell survived, clear its marker in the same transaction so a
      // single undo restores both the content and the marker.
      if (!cellRemoved) {
        this._onResolve?.();
      }
    };

    if (removesCell && sharedNotebook) {
      // Structural change → notebook manager (command-mode undo).
      sharedNotebook.transact(apply, true);
    } else {
      // Cell-surviving change → per-cell manager (edit-mode Cmd+Z).
      cellModel.sharedModel.transact(apply, true);
    }

    this.deactivate();
  }

  /**
   * When the edit diff is resolved chunk-by-chunk in the merge view, the editor
   * already holds the user's chosen source. Clear the marker so the diff does
   * not reappear on reload, then tear down.
   *
   * The marker clear goes through the cell's own shared model so it lands on the
   * per-cell editor undo manager (the one edit-mode Cmd+Z drives), consistent
   * with the whole-cell Accept/Reject path.
   */
  protected handleChunksResolved(): void {
    const cellModel = this._cell.model;
    cellModel.sharedModel.transact(() => this._onResolve?.(), true);
    super.handleChunksResolved();
  }

  /**
   * Notify that the diff has been updated
   */
  private _notifyDiffUpdated(): void {
    const event = new CustomEvent('diff-updated', {
      bubbles: true
    });
    this._cell.node.dispatchEvent(event);
  }

  /**
   * Handle diff updates
   */
  protected onDiffUpdated = () => {
    this._notifyDiffUpdated();
  };

  /**
   * Get the shared model for source manipulation
   */
  protected getSharedModel(): ISharedText {
    return this._cell.model.sharedModel;
  }

  /**
   * Activate the diff view without cell toolbar.
   */
  protected activate(): void {
    const { model } = this._cell;
    if (model.type === 'markdown') {
      const md = this._cell as MarkdownCell;
      if (md.rendered) {
        this._wasRendered = true;
        md.rendered = false;
      }
    }

    super.activate();
    UnifiedCellDiffManager._activeDiffCount++;

    const observer = new MutationObserver(() => {
      this.hideCellToolbar();
    });

    observer.observe(this._cell.node, {
      childList: true,
      subtree: true
    });

    this._toolbarObserver = observer;
  }

  /**
   * Deactivate the diff view with cell toolbar.
   */
  protected deactivate(): void {
    super.deactivate();
    UnifiedCellDiffManager._activeDiffCount = Math.max(
      0,
      UnifiedCellDiffManager._activeDiffCount - 1
    );

    if (this._wasRendered && this._cell.model.type === 'markdown') {
      (this._cell as MarkdownCell).rendered = true;
      this._wasRendered = false;
    }

    if (this._toolbarObserver) {
      this._toolbarObserver.disconnect();
      this._toolbarObserver = undefined;
    }
    this._notifyDiffUpdated();
    this.dispose();
  }

  /**
   * Find the cell's own toolbar, excluding the diff footer's toolbar.
   *
   * JupyterLab renders both the cell toolbar and the footer's toolbar as
   * `<jp-toolbar>` elements, so a bare `querySelector('jp-toolbar')` can match
   * the footer's own toolbar and hide the Accept/Reject buttons we just added.
   * Scope to toolbars that are NOT inside a `.jp-cellfooter`.
   */
  private _cellToolbar(): HTMLElement | null {
    const toolbars = this._cell.node.querySelectorAll('jp-toolbar');
    for (const tb of Array.from(toolbars)) {
      if (!tb.closest('.jp-cellfooter')) {
        return tb as HTMLElement;
      }
    }
    return null;
  }

  /**
   * Hide the cell's toolbar while the diff is active
   */
  protected hideCellToolbar(): void {
    const toolbar = this._cellToolbar();
    if (toolbar) {
      toolbar.style.display = 'none';
    }
  }

  /**
   * Show the cell's toolbar when the diff is deactivated
   */
  protected showCellToolbar(): void {
    if (UnifiedCellDiffManager._activeDiffCount > 0) {
      return;
    }
    const toolbar = this._cellToolbar();
    if (toolbar) {
      toolbar.style.display = '';
    }
  }

  /**
   * Add toolbar buttons to the cell footer
   */
  protected addToolbarButtons(): void {
    if (!this._cellFooterTracker || !this._cell) {
      return;
    }

    if (!this.hasPendingChanges()) {
      this.removeToolbarButtons();
      return;
    }

    const cellId = this._cell.model.id;
    const footer = this._cellFooterTracker.getFooter(cellId);
    if (!footer) {
      return;
    }

    this.acceptAllButton = new ToolbarButton({
      icon: checkIcon,
      label: this.trans.__('Accept'),
      tooltip: this.trans.__('Accept changes in this cell'),
      enabled: true,
      onClick: () => this.acceptAll()
    });

    this.rejectAllButton = new ToolbarButton({
      icon: undoIcon,
      label: this.trans.__('Reject'),
      tooltip: this.trans.__('Reject changes in this cell'),
      enabled: true,
      onClick: () => this.rejectAll()
    });

    if (this.showActionButtons) {
      footer.addToolbarItemOnRight('reject-all', this.rejectAllButton);
      footer.addToolbarItemOnRight('accept-all', this.acceptAllButton);
    }

    this._cellFooterTracker.showFooter(cellId);

    // Hide the main cell toolbar to avoid overlap
    this.hideCellToolbar();
  }

  /**
   * Remove toolbar buttons from the cell footer
   */
  protected removeToolbarButtons(): void {
    if (!this._cellFooterTracker || !this._cell) {
      return;
    }

    const cellId = this._cell.model.id;
    const footer = this._cellFooterTracker.getFooter(cellId);
    if (!footer) {
      return;
    }

    if (this.showActionButtons) {
      footer.removeToolbarItem('accept-all');
      footer.removeToolbarItem('reject-all');
    }

    // Hide the footer if no other items remain
    this._cellFooterTracker.hideFooter(cellId);

    // Show the main cell toolbar again
    this.showCellToolbar();
  }

  private _cell: Cell;
  private _cellFooterTracker?: ICellFooterTracker;
  private _op: DiffOp;
  private _notebook?: NotebookPanel;
  private _onResolve?: () => void;
}

/**
 * Create a unified diff view for a cell.
 *
 * Construction is synchronous (the manager activates in its constructor); the
 * function is kept as a factory for symmetry with the other diff views and to
 * leave room for future async setup.
 */
export function createUnifiedCellDiffView(
  options: IUnifiedCellDiffOptions
): UnifiedCellDiffManager {
  return new UnifiedCellDiffManager(options);
}

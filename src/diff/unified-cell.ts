import { Cell, MarkdownCell } from '@jupyterlab/cells';
import { checkIcon, ToolbarButton, undoIcon } from '@jupyterlab/ui-components';
import { ICellFooterTracker } from 'jupyterlab-cell-input-footer';
import {
  BaseUnifiedDiffManager,
  IBaseUnifiedDiffOptions
} from './base-unified-diff';
import type { ISharedText } from '@jupyter/ydoc';

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
    this.activate();
  }

  private static _activeDiffCount = 0;
  private _toolbarObserver?: MutationObserver;
  private _wasRendered = false;

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
  }

  /**
   * Hide the cell's toolbar while the diff is active
   */
  protected hideCellToolbar(): void {
    const toolbar = this._cell.node.querySelector(
      'jp-toolbar'
    ) as HTMLElement | null;
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
    const toolbar = this._cell.node.querySelector(
      'jp-toolbar'
    ) as HTMLElement | null;
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

    const cellId = this._cell.id;
    const footer = this._cellFooterTracker.getFooter(cellId);
    if (!footer) {
      return;
    }

    this.acceptAllButton = new ToolbarButton({
      icon: checkIcon,
      label: this.trans.__('Accept All'),
      tooltip: this.trans.__('Accept all chunks'),
      enabled: true,
      className: 'jp-UnifiedDiff-acceptAll',
      onClick: () => this.acceptAll()
    });

    this.rejectAllButton = new ToolbarButton({
      icon: undoIcon,
      label: this.trans.__('Reject All'),
      tooltip: this.trans.__('Reject all chunks'),
      enabled: true,
      className: 'jp-UnifiedDiff-rejectAll',
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

    const cellId = this._cell.id;
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
}

/**
 * Create a unified diff view for a cell
 */
export async function createUnifiedCellDiffView(
  options: IUnifiedCellDiffOptions
): Promise<UnifiedCellDiffManager> {
  return new UnifiedCellDiffManager(options);
}

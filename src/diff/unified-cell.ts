import { ICellModel } from '@jupyterlab/cells';
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
   * The cell to show the diff for
   */
  cell: ICellModel;

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

  /**
   * Get the shared model for source manipulation
   */
  protected getSharedModel(): ISharedText {
    return this._cell.sharedModel;
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
  }

  private _cell: ICellModel;
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

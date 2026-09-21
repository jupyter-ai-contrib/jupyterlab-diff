import { Cell } from '@jupyterlab/cells';
import { TranslationBundle } from '@jupyterlab/translation';
import { checkIcon, ToolbarButton, undoIcon } from '@jupyterlab/ui-components';
import { ICellFooterTracker } from 'jupyterlab-cell-input-footer';

export interface IBaseCellDiffOptions {
  cell: Cell;
  cellFooterTracker?: ICellFooterTracker;
  trans: TranslationBundle;
  showActionButtons?: boolean;
}

export abstract class BaseCellDiffManager {
  constructor(options: IBaseCellDiffOptions) {
    this._cell = options.cell;
    this._cellFooterTracker = options.cellFooterTracker;
    this.trans = options.trans;
    this.showActionButtons = options.showActionButtons ?? true;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this.deactivate();
  }

  abstract hasPendingChanges(): boolean;
  abstract acceptAll(): void;
  abstract rejectAll(): void;
  protected abstract activate(): void;
  protected abstract deactivate(): void;

  protected _notifyDiffUpdated(): void {
    const event = new CustomEvent('diff-updated', { bubbles: true });
    this._cell.node.dispatchEvent(event);
  }

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
  }

  protected removeToolbarButtons(): void {
    if (!this._cellFooterTracker || !this._cell) {
      return;
    }

    const cellId = this._cell.model?.id;
    if (!cellId) {
      return;
    }
    const footer = this._cellFooterTracker.getFooter(cellId);
    if (!footer) {
      return;
    }

    if (this.showActionButtons) {
      footer.removeToolbarItem('accept-all');
      footer.removeToolbarItem('reject-all');
    }

    this._cellFooterTracker.hideFooter(cellId);
  }

  protected _cell: Cell;
  protected _cellFooterTracker?: ICellFooterTracker;
  protected trans: TranslationBundle;
  protected showActionButtons: boolean;
  protected acceptAllButton: ToolbarButton | null = null;
  protected rejectAllButton: ToolbarButton | null = null;
  private _isDisposed = false;
}

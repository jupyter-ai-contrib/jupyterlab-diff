import { NotebookPanel } from '@jupyterlab/notebook';
import { BaseCellDiffManager, IBaseCellDiffOptions } from './base-cell-diff';

export interface IAddedCellDiffOptions extends IBaseCellDiffOptions {
  notebookPanel: NotebookPanel;
}

export class AddedCellDiffManager extends BaseCellDiffManager {
  constructor(options: IAddedCellDiffOptions) {
    super(options);
    this._notebookPanel = options.notebookPanel;
    this._cellId = options.cell.model.id;
    this.activate();
  }

  private _notebookPanel: NotebookPanel;
  private _cellId: string;
  private _isResolved = false;

  hasPendingChanges(): boolean {
    return !this._isResolved;
  }

  acceptAll(): void {
    this._isResolved = true;
    this.deactivate();
  }

  rejectAll(): void {
    this._isResolved = true;
    this._removeCell();
    this.deactivate();
  }

  private _removeCell(): void {
    const model = this._notebookPanel.content.model;
    if (!model) {
      return;
    }
    for (let i = 0; i < model.cells.length; i++) {
      if (model.cells.get(i).id === this._cellId) {
        model.sharedModel.deleteCell(i);
        break;
      }
    }
  }

  protected activate(): void {
    this._cell.node.classList.add('jp-diff-added-cell');
    BaseCellDiffManager._activeDiffCount++;
    this._setupToolbarObserver();
    this.addToolbarButtons();
    this.hideCellToolbar();
  }

  protected deactivate(): void {
    this._cell.node.classList.remove('jp-diff-added-cell');
    this.removeToolbarButtons();
    this.showCellToolbar();
    BaseCellDiffManager._activeDiffCount = Math.max(
      0,
      BaseCellDiffManager._activeDiffCount - 1
    );
    this._teardownToolbarObserver();
    this._notifyDiffUpdated();
    this.dispose();
  }
}

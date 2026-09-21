import {
  Cell,
  CodeCell,
  CodeCellModel,
  MarkdownCell,
  MarkdownCellModel,
  RawCell,
  RawCellModel
} from '@jupyterlab/cells';
import { NotebookPanel } from '@jupyterlab/notebook';
import { Panel, Widget } from '@lumino/widgets';
import { CellFooterWidget } from 'jupyterlab-cell-input-footer/lib/widget';
import { BaseCellDiffManager, IBaseCellDiffOptions } from './base-cell-diff';

export interface IDeletedCellDiffOptions
  extends Omit<IBaseCellDiffOptions, 'cell'> {
  notebookPanel: NotebookPanel;
  cellSource: string;
  cellType: 'code' | 'markdown' | 'raw';
  insertIndex: number;
}

export class DeletedCellDiffManager extends BaseCellDiffManager {
  constructor(options: IDeletedCellDiffOptions) {
    const cellWidget = DeletedCellDiffManager._buildCellWidget(options);
    super({ ...options, cell: cellWidget });
    this._notebookPanel = options.notebookPanel;
    this._cellType = options.cellType;
    this._insertIndex = options.insertIndex;
    this._cellFooter = DeletedCellDiffManager._addFooter(cellWidget);
    this.activate();
  }

  hasPendingChanges(): boolean {
    return !this._isResolved;
  }

  acceptAll(): void {
    if (this._isResolved) {
      return;
    }
    this._isResolved = true;
    this.deactivate();
  }

  rejectAll(): void {
    if (this._isResolved) {
      return;
    }
    this._isResolved = true;
    this._restoreCell();
    this.deactivate();
  }

  protected activate(): void {
    this._cell.addClass('jp-diff-deleted-cell');
    this._ghostPanel.addWidget(this._cell);
    BaseCellDiffManager._activeDiffCount++;
    this._setupToolbarObserver();
    this.addToolbarButtons(this._cellFooter);
    this.hideCellToolbar();
    this._insertGhostPanel();
    this._setupViewportObserver();
    this._notifyDiffUpdated();
  }

  protected deactivate(): void {
    this._teardownViewportObserver();
    this.removeToolbarButtons(this._cellFooter);
    if (!this._ghostPanel.isDisposed) {
      if (this._ghostPanel.isAttached) {
        Widget.detach(this._ghostPanel);
      }
      this._ghostPanel.dispose();
    }
    BaseCellDiffManager._activeDiffCount = Math.max(
      0,
      BaseCellDiffManager._activeDiffCount - 1
    );
    this._teardownToolbarObserver();
    this._notifyDiffUpdated();
    this.dispose();
  }

  private static _addFooter(cell: Cell): CellFooterWidget {
    const footer = new CellFooterWidget();
    const layout = cell.layout as any;
    const idx = layout.widgets.findIndex((w: Widget) =>
      w.hasClass('jp-Cell-inputWrapper')
    );
    layout.insertWidget(idx + 1, footer);
    footer.hide();
    return footer;
  }

  private _insertGhostPanel(): void {
    const viewportNode = this._getViewportNode();
    if (!viewportNode) {
      return;
    }
    const anchor = this._findAnchor(viewportNode);
    if (!this._ghostPanel.isAttached) {
      Widget.attach(this._ghostPanel, viewportNode, anchor);
    } else {
      viewportNode.insertBefore(this._ghostPanel.node, anchor);
    }
  }

  private _getViewportNode(): HTMLElement | null {
    return this._notebookPanel.content.node.querySelector(
      '.jp-WindowedPanel-viewport'
    ) as HTMLElement | null;
  }

  private _findAnchor(viewportNode: HTMLElement): HTMLElement | null {
    const children = viewportNode.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement;
      const idx = parseInt(child.dataset.windowedListIndex ?? '', 10);
      if (!isNaN(idx) && idx >= this._insertIndex) {
        return child;
      }
    }
    return null;
  }

  private _setupViewportObserver(): void {
    const viewportNode = this._getViewportNode();
    if (!viewportNode) {
      return;
    }
    this._viewportObserver = new MutationObserver(() => {
      if (this.isDisposed || this._isResolved || this._pendingReinsert) {
        return;
      }
      this._pendingReinsert = true;
      requestAnimationFrame(() => {
        this._pendingReinsert = false;
        if (!this.isDisposed && !this._isResolved) {
          const vp = this._getViewportNode();
          if (vp && !this._ghostPanel.isAttached) {
            this._insertGhostPanel();
          }
        }
      });
    });
    this._viewportObserver.observe(viewportNode, { childList: true });
  }

  private _teardownViewportObserver(): void {
    this._viewportObserver?.disconnect();
    this._viewportObserver = undefined;
  }

  private _restoreCell(): void {
    const model = this._notebookPanel.content.model;
    if (!model) {
      return;
    }
    model.sharedModel.insertCell(this._insertIndex, {
      cell_type: this._cellType,
      source: this._cell.model.sharedModel.getSource()
    });
  }

  private static _buildCellWidget(options: IDeletedCellDiffOptions): Cell {
    const nb = options.notebookPanel.content;
    const readOnly = { readOnly: true };
    switch (options.cellType) {
      case 'markdown': {
        const model = new MarkdownCellModel({});
        model.sharedModel.setSource(options.cellSource);
        return new MarkdownCell({
          model,
          rendermime: nb.rendermime,
          contentFactory: nb.contentFactory,
          editorConfig: { ...nb.editorConfig.markdown, ...readOnly },
          placeholder: false
        }).initializeState();
      }
      case 'raw': {
        const model = new RawCellModel({});
        model.sharedModel.setSource(options.cellSource);
        return new RawCell({
          model,
          contentFactory: nb.contentFactory,
          editorConfig: { ...nb.editorConfig.raw, ...readOnly },
          placeholder: false
        }).initializeState();
      }
      case 'code':
      default: {
        const model = new CodeCellModel({});
        model.sharedModel.setSource(options.cellSource);
        return new CodeCell({
          model,
          rendermime: nb.rendermime,
          contentFactory: nb.contentFactory,
          editorConfig: { ...nb.editorConfig.code, ...readOnly },
          placeholder: false
        }).initializeState();
      }
    }
  }

  private _notebookPanel: NotebookPanel;
  private _cellType: 'code' | 'markdown' | 'raw';
  private _insertIndex: number;
  private _isResolved = false;
  private _ghostPanel = new Panel();
  private _cellFooter: CellFooterWidget;
  private _viewportObserver?: MutationObserver;
  private _pendingReinsert = false;
}

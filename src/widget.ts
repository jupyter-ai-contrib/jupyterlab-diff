import { ICellModel } from '@jupyterlab/cells';
import { TranslationBundle } from '@jupyterlab/translation';
import { checkIcon, ToolbarButton, undoIcon } from '@jupyterlab/ui-components';
import { Widget } from '@lumino/widgets';
import { ICellFooterTracker } from 'jupyterlab-cell-input-footer';

/**
 * Options for creating a diff widget
 */
export interface IDiffWidgetOptions {
  /**
   * The cell to show the diff for
   */
  cell: ICellModel;

  /**
   * The cell footer tracker
   */
  cellFooterTracker: ICellFooterTracker;

  /**
   * The original source code
   */
  originalSource: string;

  /**
   * The new/modified source code
   */
  newSource: string;

  /**
   * The translation bundle
   */
  trans: TranslationBundle;

  /**
   * Cell ID for identification
   */
  cellId?: string;

  /**
   * Whether to show accept/reject buttons
   */
  showActionButtons?: boolean;

  /**
   * Whether to open the diff automatically (defaults to true)
   */
  openDiff?: boolean;
}

/**
 * Base class for diff widgets with shared action button functionality
 */
export abstract class BaseDiffWidget extends Widget {
  /**
   * Construct a new BaseDiffWidget.
   */
  constructor(options: IDiffWidgetOptions) {
    super();
    this._cell = options.cell;
    this._cellFooterTracker = options.cellFooterTracker;
    this._originalSource = options.originalSource;
    this._newSource = options.newSource || options.cell.sharedModel.getSource();
    this._trans = options.trans;
    this._showActionButtons = options.showActionButtons ?? true;
    this._openDiff = options.openDiff ?? true;
  }

  /**
   * Create and add the diff widget to the cell footer with buttons.
   */
  public addToFooter(): void {
    if (!this._cellFooterTracker || !this._cell) {
      return;
    }

    const cellId = this._cell.id;
    const footer = this._cellFooterTracker.getFooter(cellId);
    if (!footer) {
      return;
    }

    footer.removeWidget('jupyterlab-cell-diff');
    footer.removeToolbarItem('accept-diff');
    footer.removeToolbarItem('reject-diff');
    footer.removeToolbarItem('toggle-diff');
    footer.removeToolbarItem('compare');

    footer.addWidget(this);

    this._createButtons(footer);

    this._cellFooterTracker.showFooter(cellId);
  }

  /**
   * Handle accept button click event.
   */
  public onAcceptClick(): void {
    if (this._cell) {
      this._cell.sharedModel.setSource(this._newSource);
      this._closeDiffView();
    }
  }

  /**
   * Handle reject button click event.
   */
  public onRejectClick(): void {
    if (this._cell) {
      this._cell.sharedModel.setSource(this._originalSource);
      this._closeDiffView();
    }
  }

  /**
   * Handle toggle diff visibility
   */
  public onToggleClick(): void {
    if (this.isHidden) {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Create accept, reject, and toggle buttons for the footer toolbar.
   */
  private _createButtons(footer: any): void {
    this._toggleButton = new ToolbarButton({
      label: this._trans.__('Compare changes'),
      enabled: true,
      className: 'jp-DiffView-toggle',
      onClick: () => {
        this.onToggleClick();
      }
    });

    footer.addToolbarItemOnLeft('toggle-diff', this._toggleButton);

    if (this._showActionButtons) {
      const rejectButton = new ToolbarButton({
        icon: undoIcon,
        tooltip: this._trans.__('Reject Changes'),
        enabled: true,
        className: 'jp-DiffView-reject',
        onClick: () => this.onRejectClick()
      });

      const acceptButton = new ToolbarButton({
        icon: checkIcon,
        tooltip: this._trans.__('Accept Changes'),
        enabled: true,
        className: 'jp-DiffView-accept',
        onClick: () => this.onAcceptClick()
      });

      footer.addToolbarItemOnRight('reject-diff', rejectButton);
      footer.addToolbarItemOnRight('accept-diff', acceptButton);
    }

    if (this._openDiff) {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Close the diff view and clean up the footer.
   */
  private _closeDiffView(): void {
    if (this._cellFooterTracker && this._cell) {
      const cellId = this._cell.id;
      const footer = this._cellFooterTracker.getFooter(cellId);
      if (footer) {
        footer.removeWidget('jupyterlab-cell-diff');
        footer.removeToolbarItem('accept-diff');
        footer.removeToolbarItem('reject-diff');
        footer.removeToolbarItem('toggle-diff');
        footer.removeToolbarItem('compare');
      }
      this._cellFooterTracker.hideFooter(cellId);
    }
  }

  protected _cell: ICellModel;
  protected _cellFooterTracker: ICellFooterTracker;
  protected _originalSource: string;
  protected _newSource: string;
  protected _showActionButtons: boolean;
  protected _openDiff: boolean;
  protected _toggleButton: ToolbarButton | null = null;
  private _trans: TranslationBundle;
}

import { IDocumentWidget } from '@jupyterlab/docregistry';
import { FileEditor } from '@jupyterlab/fileeditor';
import {
  checkIcon,
  Toolbar,
  ToolbarButton,
  undoIcon
} from '@jupyterlab/ui-components';
import { Widget } from '@lumino/widgets';
import {
  BaseUnifiedDiffManager,
  IBaseUnifiedDiffOptions
} from './base-unified-diff';
import type { ISharedText } from '@jupyter/ydoc';

/**
 * Options for applying a unified diff to a file editor
 */
export interface IUnifiedFileDiffOptions extends IBaseUnifiedDiffOptions {
  /**
   * The file editor widget (IDocumentWidget containing the editor)
   */
  fileEditorWidget?: IDocumentWidget<FileEditor>;
}

/**
 * Manages unified file diffs in the editor using CodeMirror compartments
 */
export class UnifiedFileDiffManager extends BaseUnifiedDiffManager {
  /**
   * Construct a new UnifiedFileDiffManager
   */
  constructor(options: IUnifiedFileDiffOptions) {
    super(options);
    this._fileEditorWidget = options.fileEditorWidget;
    this.activate();
  }

  /**
   * Get the shared model for source manipulation
   */
  protected getSharedModel(): ISharedText {
    return this.editor.model.sharedModel;
  }

  /**
   * Add toolbar buttons to the file editor toolbar
   */
  protected addToolbarButtons(): void {
    if (!this._fileEditorWidget || !this.showActionButtons) {
      return;
    }

    const toolbar = this._fileEditorWidget.toolbar;
    if (!toolbar) {
      return;
    }

    // Show the toolbar
    toolbar.node.hidden = false;

    // Create a spacer to push buttons to the right
    this._spacer = Toolbar.createSpacerItem();

    // Accept all button
    this.acceptAllButton = new ToolbarButton({
      icon: checkIcon,
      label: this.trans.__('Accept All'),
      tooltip: this.trans.__('Accept all chunks'),
      enabled: true,
      className: 'jp-UnifiedFileDiff-acceptAll',
      onClick: () => this.acceptAll()
    });

    // Reject all button
    this.rejectAllButton = new ToolbarButton({
      icon: undoIcon,
      label: this.trans.__('Reject All'),
      tooltip: this.trans.__('Reject all chunks'),
      enabled: true,
      className: 'jp-UnifiedFileDiff-rejectAll',
      onClick: () => this.rejectAll()
    });

    toolbar.addItem('diff-spacer', this._spacer);
    toolbar.addItem('reject-all-diff', this.rejectAllButton);
    toolbar.addItem('accept-all-diff', this.acceptAllButton);
  }

  /**
   * Remove toolbar buttons from the file editor toolbar
   */
  protected removeToolbarButtons(): void {
    if (!this._fileEditorWidget) {
      return;
    }

    const toolbar = this._fileEditorWidget.toolbar;
    if (!toolbar) {
      return;
    }

    // Remove and dispose items only if they were added
    if (this.showActionButtons) {
      // Dispose of the spacer
      if (this._spacer) {
        this._spacer.dispose();
        this._spacer = null;
      }

      // Dispose of the buttons
      if (this.acceptAllButton) {
        this.acceptAllButton.dispose();
        this.acceptAllButton = null;
      }
      if (this.rejectAllButton) {
        this.rejectAllButton.dispose();
        this.rejectAllButton = null;
      }
    }

    // Check if there are any remaining items in the toolbar
    // If not, hide the toolbar
    const remainingItems = Array.from(toolbar.names());
    if (remainingItems.length === 0) {
      toolbar.node.hidden = true;
    }
  }

  private _fileEditorWidget?: IDocumentWidget<FileEditor>;
  private _spacer: Widget | null = null;
}

/**
 * Create a unified diff view for a file editor
 */
export async function createUnifiedFileDiff(
  options: IUnifiedFileDiffOptions
): Promise<UnifiedFileDiffManager> {
  return new UnifiedFileDiffManager(options);
}

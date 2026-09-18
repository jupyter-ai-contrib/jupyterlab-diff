import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { IDocumentWidget } from '@jupyterlab/docregistry';
import { FileEditor } from '@jupyterlab/fileeditor';
import { TranslationBundle } from '@jupyterlab/translation';
import {
  checkIcon,
  Toolbar,
  ToolbarButton,
  undoIcon
} from '@jupyterlab/ui-components';
import { Widget } from '@lumino/widgets';
import { Compartment } from '@codemirror/state';
import { applyDiff } from './utils';

export interface IUnifiedFileDiffOptions {
  editor: CodeMirrorEditor;
  fileEditorWidget?: IDocumentWidget<FileEditor>;
  originalSource: string;
  newSource: string;
  trans: TranslationBundle;
  showActionButtons?: boolean;
  allowInlineDiffs?: boolean;
}

export class UnifiedFileDiffManager {
  constructor(options: IUnifiedFileDiffOptions) {
    this._editor = options.editor;
    this._fileEditorWidget = options.fileEditorWidget;
    this._originalSource = options.originalSource;
    this._newSource = options.newSource;
    this._trans = options.trans;
    this._showActionButtons = options.showActionButtons ?? true;
    this._allowInlineDiffs = options.allowInlineDiffs ?? false;
    this._activate();
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._deactivate();
  }

  acceptAll(): void {
    this._originalSource = this._editor.model.sharedModel.getSource();
    this._deactivate();
  }

  rejectAll(): void {
    this._editor.model.sharedModel.setSource(this._originalSource);
    this._deactivate();
  }

  private _activate(): void {
    this._applyDiff();
    this._addToolbarButtons();
  }

  private _deactivate(): void {
    this._removeToolbarButtons();
    this._cleanupEditor();
  }

  private _applyDiff(): void {
    const editorView = this._editor?.editor;
    if (!editorView) {
      return;
    }

    applyDiff({
      editorView,
      compartment: this._diffCompartment,
      originalSource: this._originalSource,
      newSource: this._newSource,
      isInitialized: this._isInitialized,
      sharedModel: this._editor.model.sharedModel,
      onChunkChange: () => this._deactivate(),
      allowInlineDiffs: this._allowInlineDiffs
    });

    this._isInitialized = true;
  }

  private _cleanupEditor(): void {
    const editorView = this._editor?.editor;
    if (!editorView) {
      return;
    }
    editorView.dispatch({
      effects: [this._diffCompartment.reconfigure([])]
    });
  }

  private _addToolbarButtons(): void {
    if (!this._fileEditorWidget || !this._showActionButtons) {
      return;
    }

    const toolbar = this._fileEditorWidget.toolbar;
    if (!toolbar) {
      return;
    }

    toolbar.node.hidden = false;

    this._spacer = Toolbar.createSpacerItem();

    this._acceptAllButton = new ToolbarButton({
      icon: checkIcon,
      label: this._trans.__('Accept All'),
      tooltip: this._trans.__('Accept all chunks'),
      enabled: true,
      className: 'jp-UnifiedFileDiff-acceptAll',
      onClick: () => this.acceptAll()
    });

    this._rejectAllButton = new ToolbarButton({
      icon: undoIcon,
      label: this._trans.__('Reject All'),
      tooltip: this._trans.__('Reject all chunks'),
      enabled: true,
      className: 'jp-UnifiedFileDiff-rejectAll',
      onClick: () => this.rejectAll()
    });

    toolbar.addItem('diff-spacer', this._spacer);
    toolbar.addItem('reject-all-diff', this._rejectAllButton);
    toolbar.addItem('accept-all-diff', this._acceptAllButton);
  }

  private _removeToolbarButtons(): void {
    if (!this._fileEditorWidget) {
      return;
    }

    const toolbar = this._fileEditorWidget.toolbar;
    if (!toolbar || toolbar.isDisposed || !toolbar.parent) {
      return;
    }

    if (this._showActionButtons) {
      if (this._spacer) {
        this._spacer.dispose();
        this._spacer = null;
      }
      if (this._acceptAllButton) {
        this._acceptAllButton.dispose();
        this._acceptAllButton = null;
      }
      if (this._rejectAllButton) {
        this._rejectAllButton.dispose();
        this._rejectAllButton = null;
      }
    }

    const remainingItems = Array.from(toolbar.names());
    if (remainingItems.length === 0) {
      toolbar.node.hidden = true;
    }
  }

  private _editor: CodeMirrorEditor;
  private _fileEditorWidget?: IDocumentWidget<FileEditor>;
  private _originalSource: string;
  private _newSource: string;
  private _trans: TranslationBundle;
  private _showActionButtons: boolean;
  private _allowInlineDiffs: boolean;
  private _diffCompartment = new Compartment();
  private _isInitialized = false;
  private _isDisposed = false;
  private _spacer: Widget | null = null;
  private _acceptAllButton: ToolbarButton | null = null;
  private _rejectAllButton: ToolbarButton | null = null;
}

export async function createUnifiedFileDiff(
  options: IUnifiedFileDiffOptions
): Promise<UnifiedFileDiffManager> {
  return new UnifiedFileDiffManager(options);
}

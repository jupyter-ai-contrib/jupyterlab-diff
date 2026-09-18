import { MarkdownCell } from '@jupyterlab/cells';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { Compartment } from '@codemirror/state';
import { applyDiff } from './utils';
import { BaseCellDiffManager, IBaseCellDiffOptions } from './base-cell-diff';

export interface IUnifiedCellDiffOptions extends IBaseCellDiffOptions {
  editor: CodeMirrorEditor;
  originalSource: string;
  newSource: string;
  allowInlineDiffs?: boolean;
}

export class UnifiedCellDiffManager extends BaseCellDiffManager {
  constructor(options: IUnifiedCellDiffOptions) {
    super(options);
    this._editor = options.editor;
    this._originalSource = options.originalSource;
    this._newSource = options.newSource;
    this._allowInlineDiffs = options.allowInlineDiffs ?? false;
    this.activate();
  }

  private _editor: CodeMirrorEditor;
  private _originalSource: string;
  private _newSource: string;
  private _allowInlineDiffs: boolean;
  private _diffCompartment = new Compartment();
  private _isInitialized = false;
  private _wasRendered = false;

  hasPendingChanges(): boolean {
    return this._originalSource !== this._cell.model.sharedModel.getSource();
  }

  acceptAll(): void {
    this._originalSource = this._cell.model.sharedModel.getSource();
    this.deactivate();
  }

  rejectAll(): void {
    this._cell.model.sharedModel.setSource(this._originalSource);
    this.deactivate();
  }

  protected activate(): void {
    const { model } = this._cell;
    if (model.type === 'markdown') {
      const md = this._cell as MarkdownCell;
      if (md.rendered) {
        this._wasRendered = true;
        md.rendered = false;
      }
    }

    this._applyDiff();
    BaseCellDiffManager._activeDiffCount++;
    this._setupToolbarObserver();
    this.addToolbarButtons();
    this.hideCellToolbar();
  }

  protected deactivate(): void {
    this._cleanupEditor();

    if (this._wasRendered && this._cell.model.type === 'markdown') {
      (this._cell as MarkdownCell).rendered = true;
      this._wasRendered = false;
    }

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
      sharedModel: this._cell.model.sharedModel,
      onChunkChange: () => this.deactivate(),
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
}

export async function createUnifiedCellDiffView(
  options: IUnifiedCellDiffOptions
): Promise<UnifiedCellDiffManager> {
  return new UnifiedCellDiffManager(options);
}

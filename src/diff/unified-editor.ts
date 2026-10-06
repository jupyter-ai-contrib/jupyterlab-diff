import { Compartment } from '@codemirror/state';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { applyDiff } from './utils';

/**
 * How a unified diff shown in an editor ended.
 *
 * - `accepted`: the editor holds the new source: every change was kept.
 * - `rejected`: the editor holds the original source: every change was undone.
 * - `mixed`: the editor holds another source: some changes were kept and
 *   others undone, or the source was edited while the diff was shown.
 * - `disposed`: the manager was disposed before the diff ended. The editor
 *   keeps the source that it held at that time.
 */
export type UnifiedEditorDiffOutcome =
  | 'accepted'
  | 'rejected'
  | 'mixed'
  | 'disposed';

/**
 * The result of a unified diff shown in an editor.
 */
export interface IUnifiedEditorDiffResult {
  /**
   * How the diff ended.
   */
  outcome: UnifiedEditorDiffOutcome;

  /**
   * The source of the editor when the diff ended.
   */
  source: string;
}

/**
 * Options for showing a unified diff in an editor.
 */
export interface IUnifiedEditorDiffOptions {
  /**
   * The editor to show the diff in. The diff changes the shared model of the
   * editor's model, for example a cell or a file.
   */
  editor: CodeMirrorEditor;

  /**
   * The source before the change.
   */
  originalSource: string;

  /**
   * The source after the change. The editor's source is set to it, unless it
   * already holds it.
   */
  newSource: string;

  /**
   * Whether to show changes within a line inline (default: `false`).
   */
  allowInlineDiffs?: boolean;
}

/**
 * Shows a unified diff in a CodeMirror editor, with accept and reject buttons
 * for each changed chunk.
 *
 * It works with any `CodeMirrorEditor`: the editor of a notebook cell, of a
 * file, or an editor that another extension creates. It adds no toolbar
 * buttons: the caller shows its own controls, calls `acceptAll()` or
 * `rejectAll()`, and awaits `result`.
 *
 * Show one diff at a time in an editor: dispose the manager before showing
 * another diff in the same editor, and before the editor is disposed.
 */
export class UnifiedEditorDiffManager {
  /**
   * Show the diff in the editor.
   */
  constructor(options: IUnifiedEditorDiffOptions) {
    this._editor = options.editor;
    this._originalSource = options.originalSource;
    this._newSource = options.newSource;
    this._result = new Promise(resolve => {
      this._resolve = resolve;
    });

    applyDiff({
      editorView: this._editor.editor,
      compartment: this._compartment,
      originalSource: this._originalSource,
      newSource: this._newSource,
      isInitialized: false,
      sharedModel: this._editor.model.sharedModel,
      onChunkChange: () => this._finish(),
      allowInlineDiffs: options.allowInlineDiffs ?? false
    });
  }

  /**
   * A promise that resolves once the diff ends: when every chunk is accepted
   * or rejected, when `acceptAll()` or `rejectAll()` is called, or when the
   * manager is disposed.
   */
  get result(): Promise<IUnifiedEditorDiffResult> {
    return this._result;
  }

  /**
   * Whether the diff has ended.
   */
  get isResolved(): boolean {
    return this._isResolved;
  }

  /**
   * Whether the manager is disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Keep the changes that are left, and remove the diff.
   */
  acceptAll(): void {
    this._finish();
  }

  /**
   * Restore the original source, and remove the diff.
   */
  rejectAll(): void {
    this._finish({ restore: true });
  }

  /**
   * Remove the diff, and keep the source that the editor holds. If the diff
   * has not ended, `result` resolves with the `disposed` outcome.
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._finish({ disposed: true });
  }

  /**
   * Remove the diff from the editor, restore the original source if asked,
   * and resolve `result`.
   */
  private _finish(
    options: { restore?: boolean; disposed?: boolean } = {}
  ): void {
    if (this._isResolved) {
      return;
    }
    this._isResolved = true;

    if (!this._editor.isDisposed) {
      this._editor.editor.dispatch({
        effects: this._compartment.reconfigure([])
      });
    }
    const sharedModel = this._editor.model.sharedModel;
    if (options.restore && sharedModel.getSource() !== this._originalSource) {
      sharedModel.setSource(this._originalSource);
    }
    const source = sharedModel.getSource();
    this._resolve({
      outcome: options.disposed ? 'disposed' : this._outcomeOf(source),
      source
    });
  }

  /**
   * The outcome that a source shows once the diff ends.
   */
  private _outcomeOf(source: string): UnifiedEditorDiffOutcome {
    if (source === this._newSource) {
      return 'accepted';
    }
    if (source === this._originalSource) {
      return 'rejected';
    }
    return 'mixed';
  }

  private _editor: CodeMirrorEditor;
  private _originalSource: string;
  private _newSource: string;
  private _compartment = new Compartment();
  private _result: Promise<IUnifiedEditorDiffResult>;
  private _resolve!: (result: IUnifiedEditorDiffResult) => void;
  private _isResolved = false;
  private _isDisposed = false;
}

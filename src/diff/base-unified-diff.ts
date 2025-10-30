import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { EditorView } from '@codemirror/view';
import { Compartment } from '@codemirror/state';
import { TranslationBundle } from '@jupyterlab/translation';
import { ToolbarButton } from '@jupyterlab/ui-components';
import { applyDiff } from './utils';
import type { ISharedText } from '@jupyter/ydoc';

/**
 * Base options for unified diff managers
 */
export interface IBaseUnifiedDiffOptions {
  /**
   * The code editor widget
   */
  editor: CodeMirrorEditor;

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
   * Whether to show accept/reject buttons
   */
  showActionButtons?: boolean;

  /**
   * Whether to allow inline diffs
   */
  allowInlineDiffs?: boolean;
}

/**
 * Base class for unified diff managers
 */
export abstract class BaseUnifiedDiffManager {
  /**
   * Construct a new BaseUnifiedDiffManager
   */
  constructor(options: IBaseUnifiedDiffOptions) {
    this.editor = options.editor;
    this._originalSource = options.originalSource;
    this._newSource = options.newSource;
    this.trans = options.trans;
    this.showActionButtons = options.showActionButtons ?? true;
    this.allowInlineDiffs = options.allowInlineDiffs ?? false;
    this._isInitialized = false;
    this._isDisposed = false;
    this._diffCompartment = new Compartment();
  }

  /**
   * Whether the manager is disposed
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of the manager and clean up resources
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this.deactivate();
  }

  /**
   * Get the shared model for source manipulation
   * Subclasses must implement this to return the appropriate shared model
   */
  protected abstract getSharedModel(): ISharedText;

  /**
   * Add toolbar buttons to the appropriate location
   * Subclasses must implement this to add buttons to their specific UI location
   */
  protected abstract addToolbarButtons(): void;

  /**
   * Remove toolbar buttons from the appropriate location
   * Subclasses must implement this to remove buttons from their specific UI location
   */
  protected abstract removeToolbarButtons(): void;

  /**
   * Hook to hide the cell toolbar — overridden in subclasses
   */
  protected hideCellToolbar(): void {}

  /**
   * Hook to show the cell toolbar — overridden in subclasses
   */
  protected showCellToolbar(): void {}

  /**
   * Activate the diff view
   */
  protected activate(): void {
    this._applyDiff();
    this.addToolbarButtons();
    this.hideCellToolbar();
  }

  /**
   * Deactivate the diff view
   */
  protected deactivate(): void {
    this.removeToolbarButtons();
    this._cleanupEditor();
    this.showCellToolbar();
  }

  /**
   * Clean up the editor by removing the diff view
   */
  private _cleanupEditor(): void {
    const editorView = this._getEditorView();
    if (!editorView) {
      return;
    }

    editorView.dispatch({
      effects: [this._diffCompartment.reconfigure([])]
    });
  }

  /**
   * Accept all changes
   */
  protected acceptAll(): void {
    // simply accept the current state
    this.deactivate();
  }

  /**
   * Reject all changes
   */
  protected rejectAll(): void {
    const sharedModel = this.getSharedModel();
    sharedModel.setSource(this._originalSource);
    this.deactivate();
  }

  /**
   * Apply the diff to the editor
   */
  private _applyDiff(): void {
    const editorView = this._getEditorView();
    if (!editorView) {
      console.warn('No editor view found for diff');
      return;
    }

    applyDiff({
      editorView,
      compartment: this._diffCompartment,
      originalSource: this._originalSource,
      newSource: this._newSource,
      isInitialized: this._isInitialized,
      sharedModel: this.getSharedModel(),
      onChunkChange: () => this.deactivate(),
      allowInlineDiffs: this.allowInlineDiffs
    });

    this._isInitialized = true;
  }

  /**
   * Get the CodeMirror EditorView from the JupyterLab CodeMirrorEditor
   */
  private _getEditorView(): EditorView | null {
    return this.editor?.editor || null;
  }

  protected editor: CodeMirrorEditor;
  protected trans: TranslationBundle;
  protected showActionButtons: boolean;
  protected allowInlineDiffs: boolean;
  protected acceptAllButton: ToolbarButton | null = null;
  protected rejectAllButton: ToolbarButton | null = null;
  private _originalSource: string;
  private _newSource: string;
  private _isInitialized: boolean;
  private _isDisposed: boolean;
  private _diffCompartment: Compartment;
}

import { MergeView } from '@codemirror/merge';
import { basicSetup } from 'codemirror';
import { EditorView } from '@codemirror/view';
import { jupyterTheme } from '@jupyterlab/codemirror';
import { Widget } from '@lumino/widgets';
import type { IDocumentWidget } from '@jupyterlab/docregistry';
import type { FileEditor } from '@jupyterlab/fileeditor';
import type { TranslationBundle } from '@jupyterlab/translation';
import type { CodeMirrorEditor } from '@jupyterlab/codemirror';

export interface ISplitFileDiffOptions {
  /**
   * The file editor widget (document widget) that contains the CodeMirror editor.
   * This is optional but helpful for toolbar placement or context.
   */
  fileEditorWidget?: IDocumentWidget<FileEditor>;

  /**
   * The CodeMirrorEditor instance for the file being compared
   */
  editor: CodeMirrorEditor;

  /**
   * Original source text
   */
  originalSource: string;

  /**
   * New / modified source text
   */
  newSource: string;

  /**
   * Translation bundle (optional, kept for parity with other APIs)
   */
  trans?: TranslationBundle;

  /**
   * Whether to open the diff immediately (defaults to true).
   */
  openDiff?: boolean;
}

/**
 * A Lumino widget that contains a CodeMirror MergeView (side-by-side)
 * for file diffs. This is view-only (both editors are non-editable).
 */
export class CodeMirrorSplitFileWidget extends Widget {
  private _originalCode: string;
  private _modifiedCode: string;
  private _mergeView: MergeView | null = null;
  private _openDiff: boolean;
  private _scrollWrapper: HTMLElement;

  constructor(options: ISplitFileDiffOptions) {
    super();
    this.addClass('jp-SplitFileDiffView');
    this._originalCode = options.originalSource;
    this._modifiedCode = options.newSource;
    this._openDiff = options.openDiff ?? true;

    this.node.style.display = 'flex';
    this.node.style.flexDirection = 'column';
    this.node.style.height = '100%';
    this.node.style.width = '100%';

    this._scrollWrapper = document.createElement('div');
    this._scrollWrapper.classList.add('jp-SplitDiff-scroll');
    this.node.appendChild(this._scrollWrapper);
  }

  protected onAfterAttach(): void {
    this._createSplitView();
  }

  protected onBeforeDetach(): void {
    this._destroySplitView();
  }

  private _createSplitView(): void {
    if (this._mergeView) {
      return;
    }

    // MergeView options: left (a) = original, right (b) = modified
    //TODO: Currently Both panes are non-editable, but have to make right pane editable.
    this._mergeView = new MergeView({
      a: {
        doc: this._originalCode,
        extensions: [
          basicSetup,
          EditorView.editable.of(false),
          EditorView.lineWrapping,
          jupyterTheme
        ]
      },
      b: {
        doc: this._modifiedCode,
        extensions: [
          basicSetup,
          EditorView.editable.of(false),
          EditorView.lineWrapping,
          jupyterTheme
        ]
      },
      parent: this._scrollWrapper
    });

    if (!this._openDiff) {
      this.hide();
    }
  }

  private _destroySplitView(): void {
    if (this._mergeView) {
      try {
        this._mergeView.destroy();
      } catch (err) {
        // best-effort cleanup
        console.warn('Error destroying split-file merge view', err);
      }
      this._mergeView = null;
    }
  }

  dispose(): void {
    this._destroySplitView();
    super.dispose();
  }
}

/**
 * Factory to create a CodeMirrorSplitFileWidget.
 * Keep the signature async to match other factories and future expansion.
 */
export async function createCodeMirrorSplitFileWidget(
  options: ISplitFileDiffOptions
): Promise<Widget> {
  const widget = new CodeMirrorSplitFileWidget(options);
  return widget;
}

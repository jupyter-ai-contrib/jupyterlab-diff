import { python } from '@codemirror/lang-python';
import { MergeView } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import { jupyterTheme } from '@jupyterlab/codemirror';
import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import { basicSetup } from 'codemirror';
import { IDiffWidgetOptions, BaseDiffWidget } from '../widget';

/**
 * A Lumino widget that contains a CodeMirror diff view
 */
class CodeMirrorDiffWidget extends BaseDiffWidget {
  /**
   * Construct a new CodeMirrorDiffWidget.
   */
  constructor(options: IDiffWidgetOptions) {
    super(options);
    this._originalCode = options.originalSource;
    this._modifiedCode = options.newSource;
    this.addClass('jp-DiffView');
  }

  /**
   * Handle after-attach messages for the widget.
   */
  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this._createMergeView();
  }

  /**
   * Handle before-detach messages for the widget.
   */
  protected onBeforeDetach(msg: Message): void {
    this._destroyMergeView();
    super.onBeforeDetach(msg);
  }

  /**
   * Create the merge view with CodeMirror diff functionality.
   */
  private _createMergeView(): void {
    if (this._mergeView) {
      return;
    }

    this._mergeView = new MergeView({
      a: {
        doc: this._originalCode,
        extensions: [
          basicSetup,
          python(),
          EditorView.editable.of(false),
          jupyterTheme
        ]
      },
      b: {
        doc: this._modifiedCode,
        extensions: [
          basicSetup,
          python(),
          EditorView.editable.of(false),
          jupyterTheme
        ]
      },
      parent: this.node
    });
  }

  /**
   * Destroy the merge view and clean up resources.
   */
  private _destroyMergeView(): void {
    if (this._mergeView) {
      this._mergeView.destroy();
      this._mergeView = null;
    }
  }

  private _originalCode: string;
  private _modifiedCode: string;
  private _mergeView: MergeView | null = null;
}

export async function createCodeMirrorDiffWidget(
  options: IDiffWidgetOptions
): Promise<Widget> {
  const {
    cell,
    cellFooterTracker,
    originalSource,
    newSource,
    trans,
    showActionButtons = true,
    openDiff = true
  } = options;

  const diffWidget = new CodeMirrorDiffWidget({
    originalSource,
    newSource,
    cell,
    cellFooterTracker,
    showActionButtons,
    openDiff,
    trans
  });

  diffWidget.addClass('jupyterlab-cell-diff');
  diffWidget.addToFooter();

  return diffWidget;
}

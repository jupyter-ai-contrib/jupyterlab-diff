import { python } from '@codemirror/lang-python';
import { MergeView } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import { jupyterTheme } from '@jupyterlab/codemirror';
import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import { basicSetup } from 'codemirror';
import { IDiffWidgetOptions, BaseDiffWidget } from '../widget';

/**
 * A Lumino widget that contains a CodeMirror split view (side-by-side comparison)
 */
class CodeMirrorSplitDiffWidget extends BaseDiffWidget {
  /**
   * Construct a new CodeMirrorSplitDiffWidget.
   */
  constructor(options: IDiffWidgetOptions) {
    super(options);
    this._originalCode = options.originalSource;
    this._modifiedCode = options.newSource;
    this.addClass('jp-SplitDiffView');
  }

  /**
   * Handle after-attach messages for the widget.
   */
  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this._createSplitView();
  }

  /**
   * Handle before-detach messages for the widget.
   */
  protected onBeforeDetach(msg: Message): void {
    this._destroySplitView();
    super.onBeforeDetach(msg);
  }

  /**
   * Create the split view with CodeMirror diff functionality.
   */
  private _createSplitView(): void {
    if (this._splitView) {
      return;
    }

    this._splitView = new MergeView({
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
   * Destroy the split view and clean up resources.
   */
  private _destroySplitView(): void {
    if (this._splitView) {
      this._splitView.destroy();
      this._splitView = null;
    }
  }

  private _originalCode: string;
  private _modifiedCode: string;
  private _splitView: MergeView | null = null;
}

export async function createCodeMirrorSplitDiffWidget(
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

  const diffWidget = new CodeMirrorSplitDiffWidget({
    originalSource,
    newSource,
    cell,
    cellFooterTracker,
    showActionButtons,
    openDiff,
    trans
  });

  diffWidget.addClass('jupyterlab-diff');
  diffWidget.addToFooter();

  return diffWidget;
}

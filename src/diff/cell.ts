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
        doc: this._originalSource,
        extensions: [
          basicSetup,
          python(),
          EditorView.editable.of(false),
          jupyterTheme
        ]
      },
      b: {
        doc: this._newSource,
        extensions: [
          basicSetup,
          python(),
          EditorView.editable.of(true),
          jupyterTheme,
          EditorView.updateListener.of(update => {
            if (update.docChanged) {
              const newText = update.state.doc.toString();

              this._newSource = newText;
            }
          })
        ]
      },
      parent: this.node,
      revertControls: 'a-to-b',
      renderRevertControl: () => {
        const btn = document.createElement('button');
        btn.className = 'jp-DiffRevertButton';
        btn.title = 'Revert to Original';
        btn.textContent = '🡪';
        return btn;
      },
      gutter: true,
      highlightChanges: true
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

import { python } from '@codemirror/lang-python';
import { MergeView, getChunks } from '@codemirror/merge';
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

              this._renderArrowButtons();
            }
          })
        ]
      },
      parent: this.node,
      gutter: true,
      highlightChanges: true
    });

    const container = this._splitView.dom;
    const overlay = document.createElement('div');
    overlay.className = 'jp-DiffArrowOverlay';
    container.appendChild(overlay);
    this._arrowOverlay = overlay;

    this._addScrollSync();
    setTimeout(() => this._renderArrowButtons(), 50);
  }

  /**
   * Render "merge change" buttons in the diff on left editor.
   */
  private _renderArrowButtons(): void {
    if (!this._splitView) {
      return;
    }

    const paneA = this._splitView.a;
    const paneB = this._splitView.b;
    const result = getChunks(paneB.state);
    const chunks = result?.chunks ?? [];

    this._arrowOverlay.innerHTML = '';

    chunks.forEach(chunk => {
      const { fromA, toA, fromB, toB } = chunk;
      const lineBlockA = paneA.lineBlockAt(fromA);
      const lineBlockB = paneB.lineBlockAt(fromB);
      const midTop = (lineBlockA.top + lineBlockB.top) / 2;

      const connector = document.createElement('div');
      connector.className = 'jp-DiffConnectorLine';
      connector.style.top = `${midTop}px`;

      const arrowBtn = document.createElement('button');
      arrowBtn.textContent = '🡪';
      arrowBtn.className = 'jp-DiffArrow';
      arrowBtn.title = 'Revert Block';

      arrowBtn.onclick = () => {
        const docB = paneB.state.doc;
        const docLength = docB.length;

        const safeFromB = Math.min(Math.max(0, fromB), docLength);
        const safeToB = Math.min(Math.max(safeFromB, toB), docLength);

        const origText = paneA.state.doc.sliceString(fromA, toA);
        paneB.dispatch({
          changes: { from: safeFromB, to: safeToB, insert: origText }
        });
        this._renderArrowButtons();
      };

      connector.appendChild(arrowBtn);
      this._arrowOverlay.appendChild(connector);
    });
  }

  /**
   * Keep arrow overlay in sync with editor scroll.
   */
  private _addScrollSync(): void {
    const paneA = this._splitView.a;
    const paneB = this._splitView.b;
    const sync = () => this._renderArrowButtons();
    paneA.scrollDOM.addEventListener('scroll', sync);
    paneB.scrollDOM.addEventListener('scroll', sync);
  }

  private _destroySplitView(): void {
    if (this._splitView) {
      this._splitView.destroy();
      this._splitView = null!;
    }
    if (this._arrowOverlay) {
      this._arrowOverlay.remove();
    }
  }

  private _arrowOverlay!: HTMLDivElement;
  private _splitView!: MergeView & {
    a: EditorView;
    b: EditorView;
  };
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

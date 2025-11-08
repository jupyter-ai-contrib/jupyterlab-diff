import { python } from '@codemirror/lang-python';
import { MergeView, getChunks } from '@codemirror/merge';
import {
  EditorView,
  Decoration,
  WidgetType,
  DecorationSet
} from '@codemirror/view';
import { StateEffect, StateField, RangeSetBuilder } from '@codemirror/state';
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
          jupyterTheme,
          splitDiffDecoField
        ]
      },
      b: {
        doc: this._modifiedCode,
        extensions: [
          basicSetup,
          python(),
          EditorView.editable.of(true),
          jupyterTheme,
          splitDiffDecoField,
          EditorView.updateListener.of(update => {
            if (update.docChanged) {
              const newText = update.state.doc.toString();

              this._modifiedCode = newText;
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

    this._renderArrowButtons();
  }

  /**
   * Render "merge change" buttons in the diff on left editor.
   */
  private _renderArrowButtons(): void {
    const paneA = this._splitView.a;
    const paneB = this._splitView.b;

    const result = getChunks(paneB.state);
    const chunks = result?.chunks ?? [];

    const updatedSet = new Set<string>();
    chunks.forEach((chunk: any) => {
      const id = `${chunk.fromA}-${chunk.toA}`;
      updatedSet.add(id);

      if (!this._activeChunks.has(id)) {
        this._activeChunks.add(id);
      }
    });

    for (const id of this._activeChunks) {
      if (!updatedSet.has(id)) {
        this._activeChunks.delete(id);
      }
    }
    const builder = new RangeSetBuilder<Decoration>();

    chunks.forEach((chunk: any) => {
      const { fromA, toA, fromB, toB } = chunk;
      const id = `${fromA}-${toA}`;

      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const diffWidget = this;

      const arrowWidget = Decoration.widget({
        widget: new (class extends WidgetType {
          toDOM() {
            const arrowBtn = document.createElement('button');
            arrowBtn.textContent = '🡪';
            arrowBtn.className = 'jp-DiffMergeArrow';
            arrowBtn.onclick = () => {
              const origText = paneA.state.doc.sliceString(fromA, toA);

              paneB.dispatch({
                changes: { from: fromB, to: toB, insert: origText }
              });

              diffWidget._activeChunks.delete(id);
              diffWidget._renderArrowButtons();
            };
            return arrowBtn;
          }
        })(),
        side: 1
      });

      builder.add(fromA, fromA, arrowWidget);
    });

    paneA.dispatch({
      effects: addSplitDiffDeco.of(builder.finish())
    });
  }

  private _destroySplitView(): void {
    if (this._splitView) {
      this._splitView.destroy();
      this._splitView = null!;
    }
  }

  private _originalCode: string;
  private _modifiedCode: string;
  private _activeChunks = new Set<string>();

  private _splitView!: MergeView & {
    a: EditorView;
    b: EditorView;
  };
}

const addSplitDiffDeco = StateEffect.define<DecorationSet>();

const splitDiffDecoField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(deco, tr) {
    for (const ef of tr.effects) {
      if (ef.is(addSplitDiffDeco)) {
        return ef.value;
      }
    }
    return deco.map(tr.changes);
  },
  provide: f => EditorView.decorations.from(f)
});

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

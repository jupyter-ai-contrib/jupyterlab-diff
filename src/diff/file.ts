import { MergeView } from '@codemirror/merge';
import { basicSetup } from 'codemirror';
import { EditorView, ViewUpdate } from '@codemirror/view';
import { jupyterTheme } from '@jupyterlab/codemirror';
import { Widget } from '@lumino/widgets';
import type { IDocumentWidget } from '@jupyterlab/docregistry';
import type { FileEditor } from '@jupyterlab/fileeditor';
import type { TranslationBundle } from '@jupyterlab/translation';
import type { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { Compartment } from '@codemirror/state';
import { undo, redo } from '@codemirror/commands';
import {
  undoIcon,
  redoIcon,
  checkIcon,
  closeIcon,
  LabIcon
} from '@jupyterlab/ui-components';

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
 * for file diffs. This left pane is view only and right pane in editable.
 */
export class CodeMirrorSplitFileWidget extends Widget {
  private _originalCode: string;
  private _modifiedCode: string;
  private _mergeView: MergeView | null = null;
  private _openDiff: boolean;
  private _scrollWrapper: HTMLElement;
  private _fileEditorWidget?: IDocumentWidget<FileEditor>;
  private _listenerCompartment?: Compartment;

  private _isSyncingScroll = false;

  private _rebuildTimeout: number | null = null;
  private _rebuildDelay = 300;

  private _toolbarElement: HTMLElement | null = null;

  constructor(options: ISplitFileDiffOptions) {
    super();
    this.addClass('jp-SplitFileDiffView');
    this._originalCode = options.originalSource;
    this._modifiedCode = options.newSource;
    this._openDiff = options.openDiff ?? true;
    this._fileEditorWidget = options.fileEditorWidget;

    this.node.style.display = 'flex';
    this.node.style.flexDirection = 'column';
    this.node.style.height = '100%';
    this.node.style.width = '100%';

    this._toolbarElement = document.createElement('div');
    this._toolbarElement.className = 'jp-SplitFileDiff-toolbar';
    this._toolbarElement.style.display = 'flex';
    this._toolbarElement.style.gap = '8px';
    this._toolbarElement.style.padding = '6px';
    this._toolbarElement.style.alignItems = 'center';
    this.node.appendChild(this._toolbarElement);

    // Scrollable wrapper for MergeView (fills remaining space)
    this._scrollWrapper = document.createElement('div');
    this._scrollWrapper.classList.add('jp-SplitDiff-scroll');
    this._scrollWrapper.style.flex = '1 1 auto';
    this._scrollWrapper.style.overflow = 'auto';
    this._scrollWrapper.style.minHeight = '0';
    this.node.appendChild(this._scrollWrapper);

    this._buildToolbarButtons();
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

    // Create MergeView — left (a) readonly, right (b) editable
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
        extensions: [basicSetup, EditorView.lineWrapping, jupyterTheme]
      },
      parent: this._scrollWrapper
    });

    this._enableRightPaneSync();

    // Set up scroll sync between left & right
    this._enableScrollSync();

    if (!this._openDiff) {
      this.hide();
    }
  }

  private _destroySplitView(): void {
    if (this._rebuildTimeout) {
      window.clearTimeout(this._rebuildTimeout);
      this._rebuildTimeout = null;
    }

    // remove compartments if any
    this._listenerCompartment = undefined;

    if (this._mergeView) {
      try {
        this._mergeView.destroy();
      } catch (err) {
        console.warn('Error destroying split-file merge view', err);
      }
      this._mergeView = null;
    }
  }

  dispose(): void {
    this._destroySplitView();
    super.dispose();
  }

  /**
   * Build top toolbar with Undo / Redo / Accept All / Reject All buttons.
   * Undo/Redo operate on the right editor. Accept All writes right -> model.
   * Reject All resets right editor to the original source.
   */
  private _buildToolbarButtons(): void {
    if (!this._toolbarElement) {
      return;
    }

    const makeButton = (
      label: string,
      icon: LabIcon,
      tooltip: string,
      onClick: () => void
    ) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.title = tooltip;
      button.classList.add('jp-SplitFileDiff-btn');
      button.addEventListener('click', onClick);

      const iconElement = icon.element({
        stylesheet: 'toolbarButton',
        tag: 'span'
      });
      iconElement.setAttribute('aria-hidden', 'true');
      button.appendChild(iconElement);

      const span = document.createElement('span');
      span.textContent = label;
      span.style.marginLeft = '4px';
      button.appendChild(span);

      return button;
    };

    // Undo button
    const undoButton = makeButton('Undo', undoIcon, 'Undo last change', () => {
      const right = this._mergeView?.b;
      if (right) {
        undo(right);
      }
    });

    // Redo button
    const redoButton = makeButton('Redo', redoIcon, 'Redo last change', () => {
      const right = this._mergeView?.b;
      if (right) {
        redo(right);
      }
    });

    // Accept All (write right -> shared model)
    const acceptAllButton = makeButton(
      'Accept All',
      checkIcon,
      'Accept all changes',
      () => {
        const right = this._mergeView?.b;
        if (!right || !this._fileEditorWidget) {
          return;
        }
        const newText = right.state.doc.toString();
        this._fileEditorWidget.content.model.sharedModel.setSource(newText);
        this._scheduleRebuildImmediate();

        this.dispose();
      }
    );

    // Reject All (reset right -> original)
    const rejectAllButton = makeButton(
      'Reject All',
      closeIcon,
      'Reject all changes',
      () => {
        const right = this._mergeView?.b;
        if (!right) {
          return;
        }
        const leftText =
          this._mergeView?.a?.state?.doc?.toString() ?? this._originalCode;
        right.dispatch({
          changes: { from: 0, to: right.state.doc.length, insert: leftText }
        });
        if (this._fileEditorWidget) {
          this._fileEditorWidget.content.model.sharedModel.setSource(leftText);
        }
        this._scheduleRebuildImmediate();

        this.dispose();
      }
    );

    this._toolbarElement.appendChild(undoButton);
    this._toolbarElement.appendChild(redoButton);

    const spacer = document.createElement('div');
    spacer.style.flex = '1 1 auto';
    this._toolbarElement.appendChild(spacer);

    this._toolbarElement.appendChild(rejectAllButton);
    this._toolbarElement.appendChild(acceptAllButton);
  }

  /**
   * Enable sync of right editor changes -> JupyterLab model (sharedModel),
   * and trigger a debounced rebuild of the MergeView to refresh highlights.
   */
  private _enableRightPaneSync(): void {
    if (!this._fileEditorWidget || !this._mergeView?.b) {
      // Even when no fileEditorWidget is provided we still want to auto-rebuild highlights.
    }

    const rightEditor = this._mergeView?.b;
    if (!rightEditor) {
      return;
    }

    // create a compartment for attaching the update listener to the right editor
    this._listenerCompartment = new Compartment();

    const updateListener = EditorView.updateListener.of(
      (update: ViewUpdate) => {
        // if document changed:
        if (update.docChanged) {
          const newText = update.state.doc.toString();

          // If we have a FileEditor model, update the sharedModel — this marks file dirty
          if (this._fileEditorWidget) {
            try {
              this._fileEditorWidget.content.model.sharedModel.setSource(
                newText
              );
            } catch (err) {
              console.warn('Error syncing right pane to sharedModel', err);
            }
          }

          // Debounced rebuild so MergeView highlights update after the edit.
          this._scheduleRebuildDebounced();
        }
      }
    );

    rightEditor.dispatch({
      effects: this._listenerCompartment.reconfigure(updateListener)
    });
  }

  /**
   * Debounce helper: schedule a rebuild after _rebuildDelay ms of inactivity.
   */
  private _scheduleRebuildDebounced(): void {
    if (this._rebuildTimeout) {
      window.clearTimeout(this._rebuildTimeout);
    }
    this._rebuildTimeout = window.setTimeout(() => {
      this._rebuildTimeout = null;
      this._rebuildMergeViewPreserveState();
    }, this._rebuildDelay);
  }

  /**
   * Immediate rebuild trigger (used after Accept/Reject)
   */
  private _scheduleRebuildImmediate(): void {
    if (this._rebuildTimeout) {
      window.clearTimeout(this._rebuildTimeout);
      this._rebuildTimeout = null;
    }
    this._rebuildMergeViewPreserveState();
  }

  /**
   * Rebuild the MergeView using current left/right text while attempting to
   * preserve cursor/scroll/selection state for the right editor.
   * Diff must refresh fully after changes, Keep left/right diffs aligned
   */
  private _rebuildMergeViewPreserveState(): void {
    if (!this._mergeView) {
      return;
    }

    // read current texts & right-state
    const leftText =
      this._mergeView.a?.state?.doc?.toString() ?? this._originalCode;
    const rightEditor = this._mergeView.b;
    const rightText = rightEditor?.state?.doc?.toString() ?? this._modifiedCode;

    const rightSelection = rightEditor?.state?.selection;
    const rightScrollTop = rightEditor?.scrollDOM?.scrollTop ?? 0;
    const rightScrollLeft = rightEditor?.scrollDOM?.scrollLeft ?? 0;

    // Destroy existing view
    try {
      this._mergeView.destroy();
    } catch (err) {
      console.warn('Error destroying merge view during rebuild', err);
    }
    this._mergeView = null;

    // Recreate
    this._originalCode = leftText;
    this._modifiedCode = rightText;

    this._mergeView = new MergeView({
      a: {
        doc: leftText,
        extensions: [
          basicSetup,
          EditorView.editable.of(false),
          EditorView.lineWrapping,
          jupyterTheme
        ]
      },
      b: {
        doc: rightText,
        extensions: [basicSetup, EditorView.lineWrapping, jupyterTheme]
      },
      parent: this._scrollWrapper
    });

    // re-attach listeners / sync / scroll / selection
    this._enableRightPaneSync();
    this._enableScrollSync();

    // restore selection & scroll on right editor
    const newRight = this._mergeView.b;
    if (newRight && rightSelection) {
      try {
        newRight.dispatch({
          selection: rightSelection
        } as any);
      } catch (err) {
        // selection restore is best-effort
      }
      // restore scroll
      if (newRight.scrollDOM) {
        newRight.scrollDOM.scrollTop = rightScrollTop;
        newRight.scrollDOM.scrollLeft = rightScrollLeft;
      }
    }
  }

  /**
   * Sync vertical scroll between left & right editors.
   * Avoid infinite loops by a simple boolean guard.
   */
  private _enableScrollSync(): void {
    if (!this._mergeView?.a || !this._mergeView?.b) {
      return;
    }

    const left = this._mergeView.a;
    const right = this._mergeView.b;

    const syncFrom = (from: EditorView, to: EditorView) => {
      const fromDOM = from.scrollDOM;
      const toDOM = to.scrollDOM;
      if (!fromDOM || !toDOM) {
        return;
      }

      const onScroll = () => {
        if (this._isSyncingScroll) {
          return;
        }
        this._isSyncingScroll = true;
        const fraction =
          fromDOM.scrollTop /
          Math.max(1, fromDOM.scrollHeight - fromDOM.clientHeight);
        toDOM.scrollTop = Math.floor(
          fraction * Math.max(0, toDOM.scrollHeight - toDOM.clientHeight)
        );
        // small timeout to release guard
        window.setTimeout(() => {
          this._isSyncingScroll = false;
        }, 10);
      };

      fromDOM.addEventListener('scroll', onScroll, { passive: true });
    };

    syncFrom(left, right);
    syncFrom(right, left);
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

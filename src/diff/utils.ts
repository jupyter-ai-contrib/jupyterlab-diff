import { EditorView } from '@codemirror/view';
import { Extension, Compartment, StateEffect } from '@codemirror/state';
import { unifiedMergeView, getChunks } from '@codemirror/merge';
import { checkIcon, undoIcon } from '@jupyterlab/ui-components';
import { ISharedText } from '@jupyter/ydoc';

/**
 * Render a custom merge control button with JupyterLab icons.
 */
export function renderMergeButton(
  type: 'accept' | 'reject',
  action: (e: MouseEvent) => void
): HTMLElement {
  const button = document.createElement('button');
  button.className = `jp-merge-${type}-button`;
  button.onclick = (e: MouseEvent) => {
    e.preventDefault();
    action(e);
  };

  const icon = type === 'accept' ? checkIcon : undoIcon;
  const iconElement = icon.element({
    tag: 'span',
    elementSize: 'small'
  });

  button.appendChild(iconElement);
  return button;
}

/**
 * Create a merge extension with the given options
 *
 * @param originalSource The original source to compare against
 * @param options Additional options for the merge view
 */
export function createMergeExtension(
  originalSource: string,
  options?: Record<string, any>
): Extension {
  // Per-chunk inline accept/reject controls are shown by default. A consumer
  // that resolves whole-cell (e.g. the metadata-diff observer) can turn them
  // off with `showMergeControls: false`: a per-chunk merge resolution happens
  // inside the merge view and isn't captured on any undo manager, so whole-cell
  // resolution is the cleanly-undoable path there.
  const showMergeControls = options?.showMergeControls !== false;
  return unifiedMergeView({
    original: originalSource,
    allowInlineDiffs: options?.allowInlineDiffs ?? false,
    mergeControls: showMergeControls
      ? (type: 'accept' | 'reject', action: (e: MouseEvent) => void) =>
          renderMergeButton(type, action)
      : false
  });
}

/**
 * Check if all chunks have been resolved
 */
export function hasRemainingChunks(editorView: EditorView): boolean {
  const chunksInfo = getChunks(editorView.state);
  return !!(chunksInfo && chunksInfo.chunks.length > 0);
}

/**
 * Options for applying a diff to an editor
 */
export interface IApplyDiffOptions {
  /**
   * The CodeMirror editor view
   */
  editorView: EditorView;

  /**
   * The compartment for the diff extensions
   */
  compartment: Compartment;

  /**
   * The original source to compare against
   */
  originalSource: string;

  /**
   * The new source to show
   */
  newSource: string;

  /**
   * Whether the diff has been initialized before
   */
  isInitialized: boolean;

  /**
   * The shared text model
   */
  sharedModel: ISharedText;

  /**
   * Optional callback when chunks are resolved
   */
  onChunkChange?: () => void;

  /**
   * Whether to allow inline diffs
   */
  allowInlineDiffs?: boolean;

  /**
   * Whether to show the per-chunk merge accept/reject controls (default true).
   */
  showMergeControls?: boolean;
}

/**
 * Apply a diff to an editor with automatic chunk cleanup
 */
export function applyDiff(options: IApplyDiffOptions): void {
  const {
    editorView,
    compartment,
    originalSource,
    newSource,
    isInitialized,
    sharedModel,
    onChunkChange,
    allowInlineDiffs = false,
    showMergeControls = true
  } = options;

  const mergeExtension = createMergeExtension(originalSource, {
    allowInlineDiffs,
    showMergeControls
  });

  // Create an update listener to track chunk resolution
  const updateListener = EditorView.updateListener.of(update => {
    if (update.transactions.length > 0) {
      if (onChunkChange && !hasRemainingChunks(editorView)) {
        onChunkChange();
      }
    }
  });

  // Bundle the merge extension and the update listener in the compartment so
  // they are managed together and cleaned up when the diff is deactivated.
  const bundledExtensions = [mergeExtension, updateListener];
  const effects: StateEffect<any>[] = [];

  if (!isInitialized) {
    // First time: add compartment with bundled extensions
    effects.push(
      StateEffect.appendConfig.of(compartment.of(bundledExtensions))
    );
  } else {
    // Subsequent times: reconfigure compartment with new bundled extensions
    // This replaces the old extensions (including the old listener) cleanly
    effects.push(compartment.reconfigure(bundledExtensions));
  }

  // Only rewrite the source when it actually differs from what the cell already
  // holds. YCell.setSource does an unconditional full clear+insert of the YText
  // (delete(0, len) + insert(0, value)); for the metadata-diff observer the cell
  // already contains newSource, so an unconditional call would be a redundant
  // whole-text rewrite issued from this (client) YJS peer. That rewrite can race
  // a concurrent remote splice to the same cell and CRDT-merge into scrambled
  // text. Skipping the no-op write avoids the corruption; the merge view still
  // renders because it diffs the editor's current content against originalSource.
  if (sharedModel.getSource() !== newSource) {
    sharedModel.setSource(newSource);
  }
  editorView.dispatch({ effects });
}

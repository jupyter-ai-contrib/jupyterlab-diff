import { EditorView } from '@codemirror/view';
import { Extension, Compartment, StateEffect } from '@codemirror/state';
import { unifiedMergeView, getChunks } from '@codemirror/merge';
import { checkIcon, undoIcon } from '@jupyterlab/ui-components';
import { ISharedText } from '@jupyter/ydoc';

/**
 * Render a custom merge button with JupyterLab icons
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
  return unifiedMergeView({
    original: originalSource,
    allowInlineDiffs: options?.allowInlineDiffs ?? false,
    mergeControls: (
      type: 'accept' | 'reject',
      action: (e: MouseEvent) => void
    ) => {
      return renderMergeButton(type, action);
    }
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
    allowInlineDiffs = false
  } = options;

  const mergeExtension = createMergeExtension(originalSource, {
    allowInlineDiffs
  });

  // Create an update listener to track chunk resolution
  const updateListener = EditorView.updateListener.of(update => {
    if (update.transactions.length > 0) {
      if (onChunkChange && !hasRemainingChunks(editorView)) {
        onChunkChange();
      }
    }
  });

  // Bundle both the merge extension and update listener in the compartment
  // This ensures they're managed together and properly cleaned up
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

  sharedModel.setSource(newSource);
  editorView.dispatch({ effects });
}

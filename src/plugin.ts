import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICellModel } from '@jupyterlab/cells';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { FileEditor, IEditorTracker } from '@jupyterlab/fileeditor';
import { ICellFooterTracker } from 'jupyterlab-cell-input-footer';
import { IDocumentWidget } from '@jupyterlab/docregistry';

import { IDiffWidgetOptions } from './widget';
import { createCodeMirrorSplitDiffWidget } from './diff/cell';
import {
  createUnifiedCellDiffView,
  UnifiedCellDiffManager
} from './diff/unified-cell';
import {
  createUnifiedFileDiff,
  UnifiedFileDiffManager
} from './diff/unified-file';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';

/**
 * The translation namespace for the plugin.
 */
const TRANSLATION_NAMESPACE = 'jupyterlab-diff';

/**
 * Find a notebook by path using the notebook tracker
 */
export function findNotebook(
  notebookTracker: INotebookTracker,
  notebookPath?: string
): NotebookPanel | null {
  const notebook = notebookTracker.find(
    widget => widget.context.path === notebookPath
  );

  return notebook ?? notebookTracker.currentWidget;
}

/**
 * Find a cell in a notebook by ID or return the active cell
 */
export function findCell(
  notebook: NotebookPanel,
  cellId?: string
): ICellModel | null {
  const notebookWidget = notebook.content;
  const model = notebookWidget.model;

  let cell = notebookWidget.activeCell?.model;
  if (cellId && model) {
    for (let i = 0; i < model.cells.length; i++) {
      const c = model.cells.get(i);
      if (c.id === cellId) {
        cell = c;
        break;
      }
    }
  }

  return cell ?? null;
}

/**
 * Registry for notebook-level diff managers
 */
const notebookDiffRegistry = new Map<string, UnifiedCellDiffManager[]>();

let registerCellManager = (
  notebookId: string,
  manager: UnifiedCellDiffManager
): void => {
  if (!notebookDiffRegistry.has(notebookId)) {
    notebookDiffRegistry.set(notebookId, []);
  }
  notebookDiffRegistry.get(notebookId)!.push(manager);
};

function getNotebookManagers(notebookId: string) {
  return notebookDiffRegistry.get(notebookId) || [];
}

function clearNotebookManagers(notebookId: string) {
  notebookDiffRegistry.delete(notebookId);
}

/**
 * Split cell diff plugin - shows side-by-side comparison
 */
const splitCellDiffPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-diff:split-cell-diff-plugin',
  description: 'Show cell diff using side-by-side split view',
  requires: [ICellFooterTracker, INotebookTracker],
  optional: [ITranslator],
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    cellFooterTracker: ICellFooterTracker,
    notebookTracker: INotebookTracker,
    translator: ITranslator | null
  ) => {
    const { commands } = app;
    const trans = (translator ?? nullTranslator).load(TRANSLATION_NAMESPACE);

    commands.addCommand('jupyterlab-diff:split-cell-diff', {
      label: trans.__('Show Cell Diff (Split View)'),
      describedBy: {
        args: {
          type: 'object',
          properties: {
            cellId: {
              type: 'string',
              description: trans.__('ID of the cell to show diff for')
            },
            originalSource: {
              type: 'string',
              description: trans.__('Original source code to compare against')
            },
            newSource: {
              type: 'string',
              description: trans.__('New source code to compare with')
            },
            showActionButtons: {
              type: 'boolean',
              description: trans.__(
                'Whether to show action buttons in the diff widget'
              )
            },
            notebookPath: {
              type: 'string',
              description: trans.__('Path to the notebook containing the cell')
            },
            openDiff: {
              type: 'boolean',
              description: trans.__(
                'Whether to open the diff widget automatically'
              )
            }
          },
          required: ['originalSource', 'newSource']
        }
      },
      execute: async (args: any = {}) => {
        const {
          cellId,
          originalSource,
          newSource,
          showActionButtons = true,
          notebookPath,
          openDiff = true
        } = args;

        if (!originalSource || !newSource) {
          console.error(
            trans.__('Missing required arguments: originalSource and newSource')
          );
          return;
        }

        const currentNotebook = findNotebook(notebookTracker, notebookPath);
        if (!currentNotebook) {
          return;
        }

        const cell = findCell(currentNotebook, cellId);
        if (!cell) {
          console.error(
            trans.__(
              'Missing required arguments: cellId (or no active cell found)'
            )
          );
          return;
        }

        const footer = cellFooterTracker.getFooter(cell.id);
        if (!footer) {
          console.error(trans.__('Footer not found for cell %1', cell.id));
          return;
        }

        const options: IDiffWidgetOptions = {
          cell,
          cellFooterTracker,
          originalSource,
          newSource,
          showActionButtons,
          openDiff,
          trans
        };

        await createCodeMirrorSplitDiffWidget(options);
      }
    });
  }
};

/**
 * Unified cell diff plugin
 */
const unifiedCellDiffPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-diff:unified-cell-diff-plugin',
  description: 'Show cell diff using unified view',
  requires: [ICellFooterTracker, INotebookTracker],
  optional: [ITranslator],
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    cellFooterTracker: ICellFooterTracker,
    notebookTracker: INotebookTracker,
    translator: ITranslator | null
  ) => {
    const { commands } = app;
    const trans = (translator ?? nullTranslator).load(TRANSLATION_NAMESPACE);

    // Track active unified diff managers to avoid creating duplicates
    const cellDiffManagers = new Map<string, UnifiedCellDiffManager>();

    commands.addCommand('jupyterlab-diff:unified-cell-diff', {
      label: trans.__('Show Cell Diff (Unified)'),
      describedBy: {
        args: {
          type: 'object',
          properties: {
            cellId: {
              type: 'string',
              description: trans.__('ID of the cell to show diff for')
            },
            originalSource: {
              type: 'string',
              description: trans.__('Original source code to compare against')
            },
            newSource: {
              type: 'string',
              description: trans.__('New source code to compare with')
            },
            showActionButtons: {
              type: 'boolean',
              description: trans.__(
                'Whether to show action buttons for chunk acceptance'
              )
            },
            allowInlineDiffs: {
              type: 'boolean',
              description: trans.__(
                'Enable inline diffs (true) or disable (false)'
              )
            },
            notebookPath: {
              type: 'string',
              description: trans.__('Path to the notebook containing the cell')
            }
          },
          required: ['originalSource', 'newSource']
        }
      },
      execute: async (args: any = {}) => {
        const {
          cellId,
          originalSource,
          newSource,
          showActionButtons = true,
          allowInlineDiffs = false,
          notebookPath
        } = args;

        if (!originalSource || !newSource) {
          console.error(
            trans.__('Missing required arguments: originalSource and newSource')
          );
          return;
        }

        const currentNotebook = findNotebook(notebookTracker, notebookPath);
        if (!currentNotebook) {
          return;
        }

        const cell = findCell(currentNotebook, cellId);
        if (!cell) {
          console.error(
            trans.__(
              'Missing required arguments: cellId (or no active cell found)'
            )
          );
          return;
        }

        // Get the cell widget that corresponds to the found cell
        const cellWidget = currentNotebook.content.widgets.find(
          widget => widget.model.id === cell.id
        );
        if (!cellWidget || !cellWidget.editor) {
          console.error(trans.__('No editor found for cell %1', cell.id));
          return;
        }

        // Dispose any existing manager for this cell
        const existingManager = cellDiffManagers.get(cell.id);
        if (existingManager && !existingManager.isDisposed) {
          existingManager.dispose();
        }

        // Create a new manager
        const manager = await createUnifiedCellDiffView({
          cell: cellWidget,
          editor: cellWidget.editor as CodeMirrorEditor,
          cellFooterTracker,
          originalSource,
          newSource,
          showActionButtons,
          allowInlineDiffs,
          trans
        });
        cellDiffManagers.set(cell.id, manager);

        registerCellManager(currentNotebook.id, manager);
      }
    });
    notebookTracker.widgetAdded.connect((sender, notebookPanel) => {
      const notebookId = notebookPanel.id;

      let floatingPanel: HTMLElement | null = null;

      function createFloatingPanel(): HTMLElement {
        const panel = document.createElement('div');
        panel.classList.add('jp-unified-diff-floating-panel');

        const acceptButton = document.createElement('button');
        acceptButton.classList.add('jp-merge-accept-button');
        acceptButton.textContent = 'Accept All';
        acceptButton.title = trans.__('Accept all changes in this notebook');
        acceptButton.onclick = () => {
          getNotebookManagers(notebookId).forEach(m => m.acceptAll());
          updateFloatingPanel();
        };

        const rejectButton = document.createElement('button');
        rejectButton.classList.add('jp-merge-reject-button');
        rejectButton.textContent = 'Reject All';
        rejectButton.title = trans.__('Reject all changes in this notebook');
        rejectButton.onclick = () => {
          getNotebookManagers(notebookId).forEach(m => m.rejectAll());
          updateFloatingPanel();
        };

        panel.appendChild(acceptButton);
        panel.appendChild(rejectButton);
        return panel;
      }

      function updateFloatingPanel(): void {
        const managers = getNotebookManagers(notebookId);
        const anyPending = managers.some(m => m.hasPendingChanges());

        if (!anyPending) {
          if (floatingPanel && floatingPanel.parentElement) {
            floatingPanel.parentElement.removeChild(floatingPanel);
          }
          floatingPanel = null;
          return;
        }

        if (!floatingPanel) {
          floatingPanel = createFloatingPanel();
          notebookPanel.node.appendChild(floatingPanel);
        }
      }

      notebookPanel.disposed.connect(() => {
        clearNotebookManagers(notebookId);
        if (floatingPanel && floatingPanel.parentElement) {
          floatingPanel.parentElement.removeChild(floatingPanel);
        }
        floatingPanel = null;
      });

      notebookPanel.node.addEventListener('diff-updated', updateFloatingPanel);

      const originalRegister = registerCellManager;
      registerCellManager = (nid: string, manager: UnifiedCellDiffManager) => {
        originalRegister(nid, manager);
        const event = new Event('diff-updated');
        notebookPanel.node.dispatchEvent(event);
      };
    });
  }
};

/**
 * Unified file diff plugin
 */
const unifiedFileDiffPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-diff:unified-file-diff-plugin',
  description: 'Show file diff using unified view',
  requires: [IEditorTracker],
  optional: [ITranslator],
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    editorTracker: IEditorTracker,
    translator: ITranslator | null
  ) => {
    const { commands } = app;
    const trans = (translator ?? nullTranslator).load(TRANSLATION_NAMESPACE);

    // Track active unified diff managers to avoid creating duplicates
    const fileDiffManagers = new Map<string, UnifiedFileDiffManager>();

    commands.addCommand('jupyterlab-diff:unified-file-diff', {
      label: trans.__('Diff File (Unified)'),
      describedBy: {
        args: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: trans.__(
                'Path to the file to diff. Defaults to current file in editor.'
              )
            },
            originalSource: {
              type: 'string',
              description: trans.__('Original source code to compare against')
            },
            newSource: {
              type: 'string',
              description: trans.__('New source code to compare with')
            },
            showActionButtons: {
              type: 'boolean',
              description: trans.__(
                'Whether to show action buttons for chunk acceptance. Defaults to true.'
              )
            },
            allowInlineDiffs: {
              type: 'boolean',
              description: trans.__(
                'Enable inline diffs (true) or disable (false)'
              )
            }
          },
          required: ['originalSource', 'newSource']
        }
      },
      execute: async (args: any = {}) => {
        const {
          filePath,
          originalSource,
          newSource,
          showActionButtons = true,
          allowInlineDiffs = false
        } = args;

        if (!originalSource || !newSource) {
          console.error(
            trans.__('Missing required arguments: originalSource and newSource')
          );
          return;
        }

        // Try to get the file editor widget from the file path or current widget
        const fileEditorWidget: IDocumentWidget<FileEditor> | null | undefined =
          filePath
            ? await app.commands.execute('docmanager:open', {
                path: filePath
              })
            : editorTracker.currentWidget;

        await fileEditorWidget?.revealed;

        if (!fileEditorWidget) {
          console.error(trans.__('No editor found for the file'));
          return;
        }

        // Try to get the editor from the file editor widget
        const editor = fileEditorWidget.content.editor as CodeMirrorEditor;
        if (!editor) {
          console.error(trans.__('No code editor found in the file widget'));
          return;
        }

        // Use the file path as the key
        const managerKey = fileEditorWidget.context.path;

        // Dispose any existing manager for this file
        const existingManager = fileDiffManagers.get(managerKey);
        if (existingManager && !existingManager.isDisposed) {
          existingManager.dispose();
        }

        // Create a new manager
        const manager = await createUnifiedFileDiff({
          editor,
          fileEditorWidget,
          originalSource,
          newSource,
          showActionButtons,
          allowInlineDiffs,
          trans
        });
        fileDiffManagers.set(managerKey, manager);
      }
    });
  }
};

export default [
  splitCellDiffPlugin,
  unifiedCellDiffPlugin,
  unifiedFileDiffPlugin
];

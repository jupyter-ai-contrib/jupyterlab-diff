import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICellModel } from '@jupyterlab/cells';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { ICellFooterTracker } from 'jupyterlab-cell-input-footer';

import { requestAPI } from './handler';
import { IDiffWidgetOptions } from './widget';
import { createNBDimeDiffWidget } from './diff/nbdime';
import { createCodeMirrorDiffWidget } from './diff/codemirror';

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
 * CodeMirror diff plugin
 */
const codeMirrorPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-cell-diff:codemirror-plugin',
  description: 'Expose a command to show cell diffs using CodeMirror',
  requires: [ICellFooterTracker, INotebookTracker],
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    cellFooterTracker: ICellFooterTracker,
    notebookTracker: INotebookTracker
  ) => {
    const { commands } = app;

    commands.addCommand('jupyterlab-cell-diff:show-codemirror', {
      label: 'Show Cell Diff (CodeMirror)',
      describedBy: {
        args: {
          type: 'object',
          properties: {
            cellId: {
              type: 'string',
              description: 'ID of the cell to show diff for'
            },
            originalSource: {
              type: 'string',
              description: 'Original source code to compare against'
            },
            newSource: {
              type: 'string',
              description: 'New source code to compare with'
            },
            showActionButtons: {
              type: 'boolean',
              description: 'Whether to show action buttons in the diff widget'
            },
            notebookPath: {
              type: 'string',
              description: 'Path to the notebook containing the cell'
            },
            openDiff: {
              type: 'boolean',
              description: 'Whether to open the diff widget automatically'
            }
          }
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

        const currentNotebook = findNotebook(notebookTracker, notebookPath);
        if (!currentNotebook) {
          return;
        }

        const cell = findCell(currentNotebook, cellId);
        if (!cell) {
          console.error(
            'Missing required arguments: cellId (or no active cell found)'
          );
          return;
        }

        const footer = cellFooterTracker.getFooter(cell.id);
        if (!footer) {
          console.error(`Footer not found for cell ${cell.id}`);
          return;
        }

        try {
          const options: IDiffWidgetOptions = {
            cell,
            cellFooterTracker,
            originalSource,
            newSource,
            showActionButtons,
            openDiff
          };

          await createCodeMirrorDiffWidget(options);
        } catch (error) {
          console.error('Failed to create diff widget:', error);
        }
      }
    });
  }
};

/**
 * NBDime diff plugin
 */
const nbdimePlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-cell-diff:nbdime-plugin',
  description: 'Expose a command to show cell diffs using NBDime',
  requires: [ICellFooterTracker, INotebookTracker],
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    cellFooterTracker: ICellFooterTracker,
    notebookTracker: INotebookTracker
  ) => {
    const { commands } = app;

    commands.addCommand('jupyterlab-cell-diff:show-nbdime', {
      label: 'Show Cell Diff (NBDime)',
      describedBy: {
        args: {
          type: 'object',
          properties: {
            cellId: {
              type: 'string',
              description: 'ID of the cell to show diff for'
            },
            originalSource: {
              type: 'string',
              description: 'Original source code to compare against'
            },
            newSource: {
              type: 'string',
              description: 'New source code to compare with'
            },
            showActionButtons: {
              type: 'boolean',
              description: 'Whether to show action buttons in the diff widget'
            },
            notebookPath: {
              type: 'string',
              description: 'Path to the notebook containing the cell'
            },
            openDiff: {
              type: 'boolean',
              description: 'Whether to open the diff widget automatically'
            }
          }
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

        const currentNotebook = findNotebook(notebookTracker, notebookPath);
        if (!currentNotebook) {
          return;
        }

        const cell = findCell(currentNotebook, cellId);
        if (!cell) {
          console.error(
            'Missing required arguments: cellId (or no active cell found)'
          );
          return;
        }

        // For NBDime, fetch diff data from server
        let diffData;
        try {
          const response = await requestAPI<any>('api/celldiff', {
            method: 'POST',
            body: JSON.stringify({
              original_source: originalSource,
              new_source: newSource
            })
          });
          diffData = (response as any).diff;
        } catch (error) {
          console.warn('Failed to fetch diff data from server:', error);
        }

        const footer = cellFooterTracker.getFooter(cell.id);
        if (!footer) {
          console.error(`Footer not found for cell ${cell.id}`);
          return;
        }

        try {
          const options: IDiffWidgetOptions = {
            cell,
            cellFooterTracker,
            originalSource,
            newSource,
            diffData: diffData ? { diff: diffData } : undefined,
            cellId: cell.id,
            showActionButtons,
            openDiff
          };

          await createNBDimeDiffWidget(options);
        } catch (error) {
          console.error('Failed to create diff widget:', error);
        }
      }
    });
  }
};

export default [codeMirrorPlugin, nbdimePlugin];

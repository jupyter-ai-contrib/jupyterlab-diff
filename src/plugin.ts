import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICellModel } from '@jupyterlab/cells';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { ICellFooterTracker } from 'jupyterlab-cell-input-footer';

import { IDiffWidgetOptions } from './widget';
import { createCodeMirrorDiffWidget } from './diff/codemirror';

/**
 * The translation namespace for the plugin.
 */
const TRANSLATION_NAMESPACE = 'jupyterlab-cell-diff';

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

    commands.addCommand('jupyterlab-cell-diff:show-codemirror', {
      label: trans.__('Show Cell Diff (CodeMirror)'),
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

        try {
          const options: IDiffWidgetOptions = {
            cell,
            cellFooterTracker,
            originalSource,
            newSource,
            showActionButtons,
            openDiff,
            trans
          };

          await createCodeMirrorDiffWidget(options);
        } catch (error) {
          console.error(trans.__('Failed to create diff widget: %1'), error);
        }
      }
    });
  }
};

export default [codeMirrorPlugin];

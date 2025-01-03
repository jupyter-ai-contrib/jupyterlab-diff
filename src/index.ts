import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { showCellDiffCommand } from './command';

import { ICellFooterTracker } from 'jupyterlab-cell-input-footer';

/**
 * A JupyterLab plugin providing a command for displaying a diff below a cell.
 */
const showDiff: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-cell-diff',
  requires: [ICellFooterTracker],
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    cellFooterTracker: ICellFooterTracker
  ) => {
    console.log('Jupyterlab extension - show cell diff.');
    await app.serviceManager.ready;

    app.commands.addCommand('show-diff', {
      execute: showCellDiffCommand(cellFooterTracker)
    });
  }
};

export default [showDiff];

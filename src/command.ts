import { ICellFooterTracker } from 'jupyterlab-cell-input-footer';
import { IDiffEntry } from 'nbdime/lib/diff/diffentries';
import { createPatchStringDiffModel } from 'nbdime/lib/diff/model';
import { MergeView } from 'nbdime/lib/common/mergeview';
import { ToolbarButton } from '@jupyterlab/ui-components';
import { requestAPI } from './handler';

export namespace ShowDiff {
  export interface ICommandArgs {
    cell_id?: string;
    original_source: string;
    diff: IDiffEntry[];
  }

  export interface IFetchDiff {
    original_source: string;
    new_source: string;
  }
}

/**
 * Adds a Diff UX underneath a JupyterLab cell.
 *
 * @param data
 * @param cellFooterTracker
 */
export function showCellDiff(
  data: ShowDiff.ICommandArgs,
  cellFooterTracker: ICellFooterTracker
) {
  const diff = createPatchStringDiffModel(
    data['original_source'],
    data['diff']
  );

  const mergeView = new MergeView({ remote: diff });
  //
  mergeView.addClass('jp-cell-diff');
  // Add the classes below to pick up the styling from nbdime.
  mergeView.addClass('nbdime-root');
  mergeView.addClass('jp-Notebook-diff');
  mergeView.hide();

  const footer = cellFooterTracker.getFooter(data.cell_id);
  // Try removing any old widget that exists.
  try {
    footer?.removeWidget('jp-cell-diff');
  } finally {
    // Do Nothing
  }

  footer?.addWidget(mergeView);

  if (footer?.isHidden) {
    footer.show();
    footer.update();
  }
  footer?.addToolbarItemOnLeft(
    'compare',
    new ToolbarButton({
      // icon: wandIcon,
      label: 'Compare changes',
      enabled: true,
      onClick: () => {
        if (mergeView.isHidden) {
          mergeView.show();
          return;
        }
        mergeView.hide();
      }
    })
  );
}

export async function fetchDiff(
  data: ShowDiff.IFetchDiff
): Promise<ShowDiff.ICommandArgs> {
  return await requestAPI('api/celldiff');
}

/**
 * Adds a diff to the Cell Footer
 *
 */
export function showCellDiffCommand(cellFooterTracker: ICellFooterTracker) {
  return (args: any) => {
    const data: ShowDiff.ICommandArgs = args as any;
    const cellId = data['cell_id'];
    if (cellId) {
      if (data && data['original_source'] && data['diff']) {
        showCellDiff(data, cellFooterTracker);
      }
    }
  };
}

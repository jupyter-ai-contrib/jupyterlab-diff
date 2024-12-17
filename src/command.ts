import { 
  ICellFooterTracker,
} from 'jupyterlab-cell-input-footer';
import { IDiffEntry } from 'nbdime/lib/diff/diffentries';
import { createPatchStringDiffModel } from 'nbdime/lib/diff/model';
import { MergeView } from 'nbdime/lib/common/mergeview';
import {
  ToolbarButton,
} from '@jupyterlab/ui-components';
import {
  requestAPI
} from './handler';

export namespace ShowDiff {

  export interface ICommandArgs {
    cell_id?: string,
    original_source: string,
    diff: IDiffEntry[]
  }

  export interface IFetchDiff {
    original_source: string,
    new_source: string
  }
}


/**
 * Adds a Diff UX underneath a JupyterLab cell.
 * 
 * @param data 
 * @param cellFooterTracker 
 */
export function showCellDiff(data: ShowDiff.ICommandArgs, cellFooterTracker: ICellFooterTracker) {
  let diff = createPatchStringDiffModel(
    data["original_source"],
    data["diff"]
  )
  
  let mergeView: MergeView;
  mergeView = new MergeView({ remote: diff });
  mergeView.addClass("nbdime-root");
  mergeView.addClass("jp-Notebook-diff");
  mergeView.hide();

  let footer = cellFooterTracker.getFooter(data.cell_id);
  footer?.addWidget(mergeView);

  if (footer?.isHidden) {
    footer.show();
    footer.update();
  }
  footer?.addItemOnLeft(
    'compare',
    new ToolbarButton({
      // icon: wandIcon,
      label: "Compare changes",
      enabled: true,
      onClick: () => { 
        if (mergeView.isHidden) {
          mergeView.show()
          return;
        }
        mergeView.hide()
      }
    })
  );
}


export async function fetchDiff(data: ShowDiff.IFetchDiff): Promise<ShowDiff.ICommandArgs> {
  return await requestAPI('api/celldiff');
}


/**
 * Adds a diff to the Cell Footer
 * 
 */
export function showCellDiffCommand(cellFooterTracker: ICellFooterTracker) {
  return (args: any) => {
    let data: ShowDiff.ICommandArgs = (args as any);
    let cellId = data["cell_id"];
    if (cellId) {

      if (data && data["original_source"] && data["diff"]) {
        
        showCellDiff(data, cellFooterTracker)
      }
    }
  }
}
  
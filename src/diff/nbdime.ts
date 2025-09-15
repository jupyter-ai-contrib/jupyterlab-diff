import { IDiffWidgetOptions } from '../widget';
import { IDiffEntry } from 'nbdime/lib/diff/diffentries';
import { createPatchStringDiffModel } from 'nbdime/lib/diff/model';
import { MergeView } from 'nbdime/lib/common/mergeview';
import { Widget } from '@lumino/widgets';
import { BaseDiffWidget } from '../widget';

/**
 * Options for creating an NBDime diff widget
 */
interface INBDimeDiffWidgetOptions extends IDiffWidgetOptions {
  remote: any;
}

/**
 * Extended NBDime MergeView widget with action buttons support
 */
class NBDimeDiffWidget extends BaseDiffWidget {
  /**
   * Construct a new NBDimeDiffWidget.
   */
  constructor(options: INBDimeDiffWidgetOptions) {
    super(options);

    // Create the NBDime merge view as a child widget
    this._mergeView = new MergeView({ remote: options.remote });
    this._mergeView.addClass('nbdime-diff-widget');
    this._mergeView.addClass('jp-cell-diff');
    this._mergeView.addClass('nbdime-root');
    this._mergeView.addClass('jp-Notebook-diff');

    // Add the merge view to this widget's node
    this.node.appendChild(this._mergeView.node);
    this.addClass('jp-DiffView');
  }
  private _mergeView: MergeView;
}

/**
 * Create a diff widget using NBDime
 */
export async function createNBDimeDiffWidget(
  options: IDiffWidgetOptions
): Promise<Widget> {
  const {
    cell,
    cellFooterTracker,
    originalSource,
    newSource,
    diffData,
    trans,
    showActionButtons = true,
    openDiff = true
  } = options;

  if (!diffData || !diffData.diff) {
    throw new Error(trans.__('NBDime strategy requires diff data'));
  }

  const diff = createPatchStringDiffModel(
    originalSource,
    diffData.diff as IDiffEntry[]
  );

  const diffWidget = new NBDimeDiffWidget({
    remote: diff,
    cell,
    cellFooterTracker,
    originalSource,
    newSource,
    showActionButtons,
    openDiff,
    trans
  });

  diffWidget.addClass('jupyterlab-cell-diff');
  diffWidget.addToFooter();

  return diffWidget;
}

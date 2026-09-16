import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { Cell, ICellModel } from '@jupyterlab/cells';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import {
  INotebookTracker,
  Notebook,
  NotebookPanel
} from '@jupyterlab/notebook';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { ICellFooterTracker } from 'jupyterlab-cell-input-footer';
import { IMapChange } from '@jupyter/ydoc';

import { registerNotebookManager } from '../diff/notebook-registry';
import {
  createUnifiedCellDiffView,
  UnifiedCellDiffManager
} from '../diff/unified-cell';
import {
  computeDiffSources,
  DEFAULT_MARKER_KEY,
  isNoOpDiff,
  readMarker
} from './types';

/**
 * The translation namespace for the plugin.
 */
const TRANSLATION_NAMESPACE = 'jupyterlab-diff';

/**
 * The plugin id (also the settings schema id: `schema/metadata-diff.json`).
 */
const PLUGIN_ID = 'jupyterlab-diff:metadata-diff';

/**
 * Observes metadata-driven diffs for a single notebook panel.
 *
 * The controller is a pure reactive projection of (cell source, marker): it
 * watches each cell's metadata for the marker key and renders/tears down a
 * unified diff accordingly. Because everything is driven by the durable marker
 * and re-scanned on load, pending diffs survive close/reopen/refresh.
 */
class NotebookDiffObserver {
  constructor(
    panel: NotebookPanel,
    cellFooterTracker: ICellFooterTracker,
    markerKey: string,
    trans: ReturnType<ITranslator['load']>
  ) {
    this._panel = panel;
    this._cellFooterTracker = cellFooterTracker;
    this._markerKey = markerKey;
    this._trans = trans;
  }

  /**
   * Start observing the notebook once its context is ready.
   */
  async start(): Promise<void> {
    await this._panel.context.ready;
    if (this._panel.isDisposed || this._disposed) {
      return;
    }

    const model = this._panel.model;
    if (!model) {
      return;
    }

    // Wire every existing cell (scan-on-load restores pending diffs).
    for (let i = 0; i < model.cells.length; i++) {
      this._wireCell(model.cells.get(i));
    }

    // Wire cells added later; drop managers for removed cells.
    model.cells.changed.connect(this._onCellsChanged, this);

    // Notebooks are windowed by default: an off-screen cell has no editor at
    // scan time. Re-sync a cell when it scrolls into the viewport (and thus
    // gains an editor) so its pending diff renders then.
    this._panel.content.cellInViewportChanged.connect(
      this._onCellInViewport,
      this
    );

    this._panel.disposed.connect(this._onPanelDisposed, this);
  }

  /**
   * Dispose the observer and all managed diff views.
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }
    this._disposed = true;

    this._panel.model?.cells.changed.disconnect(this._onCellsChanged, this);
    this._panel.content?.cellInViewportChanged.disconnect(
      this._onCellInViewport,
      this
    );
    this._panel.disposed.disconnect(this._onPanelDisposed, this);

    for (const cellModel of this._wired) {
      cellModel.metadataChanged.disconnect(this._onCellMetadataChanged, this);
    }
    this._wired.clear();

    for (const manager of this._managers.values()) {
      manager.dispose();
    }
    this._managers.clear();
    this._boundModels.clear();
    this._inFlight.clear();
    this._pending.clear();
  }

  private _onPanelDisposed(): void {
    this.dispose();
  }

  /**
   * Dispose the manager for a cell id (if any) and forget its bound model.
   */
  private _disposeManager(cellId: string): void {
    const manager = this._managers.get(cellId);
    if (manager) {
      manager.dispose();
      this._managers.delete(cellId);
    }
    this._boundModels.delete(cellId);
  }

  private _onCellsChanged(): void {
    const model = this._panel.model;
    if (!model) {
      return;
    }

    // A cell can be *replaced* (e.g. a type + source change is applied as a
    // delete+insert that keeps the same id but yields a NEW cell model/widget).
    // Track live models by id so we can detect identity changes, not just
    // added/removed ids.
    const liveModelsById = new Map<string, ICellModel>();
    for (let i = 0; i < model.cells.length; i++) {
      const cellModel = model.cells.get(i);
      liveModelsById.set(cellModel.id, cellModel);
      this._wireCell(cellModel);
    }

    // Dispose managers whose cell was removed, or whose bound model is no
    // longer the live model for that id (a replacement leaves a stale manager
    // bound to the dead widget).
    for (const cellId of Array.from(this._managers.keys())) {
      const live = liveModelsById.get(cellId);
      if (!live || this._boundModels.get(cellId) !== live) {
        this._disposeManager(cellId);
      }
    }

    // Disconnect and forget cell models that are no longer live (removed or
    // replaced) so `_wired` does not grow unbounded and retain dead models.
    for (const cellModel of Array.from(this._wired)) {
      if (liveModelsById.get(cellModel.id) !== cellModel) {
        cellModel.metadataChanged.disconnect(this._onCellMetadataChanged, this);
        this._wired.delete(cellModel);
      }
    }
  }

  private _wireCell(cellModel: ICellModel): void {
    if (this._wired.has(cellModel)) {
      return;
    }
    this._wired.add(cellModel);
    cellModel.metadataChanged.connect(this._onCellMetadataChanged, this);
    void this._syncCell(cellModel);
  }

  private _onCellMetadataChanged(
    cellModel: ICellModel,
    change: IMapChange
  ): void {
    if (change.key !== this._markerKey) {
      return;
    }
    void this._syncCell(cellModel);
  }

  private _onCellInViewport(_sender: Notebook, cell: Cell): void {
    void this._syncCell(cell.model);
  }

  /**
   * Reconcile the diff view for a cell with its current marker state.
   */
  private async _syncCell(cellModel: ICellModel): Promise<void> {
    if (this._disposed) {
      return;
    }

    const cellId = cellModel.id;
    const marker = readMarker(
      cellModel.sharedModel.getMetadata() as Record<string, unknown>,
      this._markerKey
    );
    const existing = this._managers.get(cellId);

    // No marker: tear down any existing diff.
    if (!marker) {
      if (existing) {
        this._disposeManager(cellId);
      }
      return;
    }

    // Marker present. Always dispose any current diff and recreate it against
    // the cell's CURRENT source. Keeping a live merge view in place while
    // further edits arrive lets the incoming splice fight the stale view and
    // corrupt the cell, so we never reuse a view across edits — each change
    // re-renders a fresh diff (original from the marker vs. the settled source).
    // This also covers cell replacement (same id, new model/widget instance).
    if (existing && !existing.isDisposed) {
      this._disposeManager(cellId);
    }

    const sources = computeDiffSources(
      marker,
      cellModel.sharedModel.getSource()
    );

    // No-op guard applies to content edits only: a content-identical `edit` is
    // a spurious marker, so clear it (non-undoable — nothing to restore).
    // Structural ops (add/delete) must still render and resolve even when their
    // content side is empty.
    if (marker.op === 'edit' && isNoOpDiff(sources)) {
      cellModel.sharedModel.deleteMetadata(this._markerKey);
      return;
    }

    // Reserve the slot synchronously so a second _syncCell for the same cell
    // (e.g. a metadata change and a scroll-into-view firing back to back)
    // cannot create a duplicate manager across the awaits below. If another
    // request arrives while in-flight, remember it and reconcile once more.
    if (this._inFlight.has(cellId)) {
      this._pending.add(cellId);
      return;
    }
    this._inFlight.add(cellId);
    try {
      let cellWidget = this._findCellWidget(cellId);
      if (!cellWidget) {
        return;
      }

      // The editor may not exist yet for a freshly created / off-screen cell;
      // it becomes available once the cell is rendered.
      await cellWidget.ready;
      if (this._disposed) {
        return;
      }

      // Re-resolve the widget after awaiting: a replacement during the await
      // would swap it. Only render if the current widget for this id is bound
      // to the exact model we are syncing (guards against a stale-model sync).
      cellWidget = this._findCellWidget(cellId);
      if (!cellWidget || cellWidget.model !== cellModel) {
        return;
      }
      const editor = cellWidget.editor as CodeMirrorEditor | null;
      if (!editor) {
        return;
      }

      // Re-check: the marker may have been cleared, or a manager created, while
      // we awaited.
      const currentMarker = readMarker(
        cellModel.sharedModel.getMetadata() as Record<string, unknown>,
        this._markerKey
      );
      if (!currentMarker) {
        return;
      }
      const current = this._managers.get(cellId);
      if (current && !current.isDisposed) {
        if (this._boundModels.get(cellId) === cellModel) {
          return;
        }
        // Stale manager bound to a replaced model: drop it and recreate.
        this._disposeManager(cellId);
      }

      const manager = createUnifiedCellDiffView({
        cell: cellWidget,
        editor,
        cellFooterTracker: this._cellFooterTracker,
        originalSource: sources.originalSource,
        newSource: sources.newSource,
        op: marker.op,
        notebook: this._panel,
        onResolve: () => cellModel.sharedModel.deleteMetadata(this._markerKey),
        showActionButtons: true,
        // Whole-cell resolution only (footer Accept/Reject) — per-chunk merge
        // controls aren't captured on an undo manager, so they'd not be
        // undoable here.
        showMergeControls: false,
        trans: this._trans
      });
      this._managers.set(cellId, manager);
      this._boundModels.set(cellId, cellModel);

      // Register with the notebook-level Accept All / Reject All panel and
      // notify it so it can recount pending diffs.
      registerNotebookManager(this._panel.id, manager);
      cellWidget.node.dispatchEvent(
        new CustomEvent('diff-updated', { bubbles: true })
      );
    } finally {
      this._inFlight.delete(cellId);
      // A reconciliation was requested while we were in-flight; run it now.
      if (this._pending.delete(cellId) && !this._disposed) {
        void this._syncCell(cellModel);
      }
    }
  }

  private _findCellWidget(cellId: string): Cell | undefined {
    return this._panel.content.widgets.find(w => w.model.id === cellId);
  }

  private _panel: NotebookPanel;
  private _cellFooterTracker: ICellFooterTracker;
  private _markerKey: string;
  private _trans: ReturnType<ITranslator['load']>;
  private _disposed = false;
  private _wired = new Set<ICellModel>();
  private _managers = new Map<string, UnifiedCellDiffManager>();
  private _boundModels = new Map<string, ICellModel>();
  private _inFlight = new Set<string>();
  private _pending = new Set<string>();
}

/**
 * Observer plugin that renders live per-cell diffs from durable markers written
 * into cell metadata by any producer (an extension, a server-side component, a
 * script).
 *
 * Opt-in: disabled by default, enabled via the `enabled` setting.
 */
const metadataDiffPlugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  description: 'Render live per-cell diffs from durable cell-metadata markers.',
  requires: [ICellFooterTracker, INotebookTracker],
  optional: [ITranslator, ISettingRegistry],
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    cellFooterTracker: ICellFooterTracker,
    notebookTracker: INotebookTracker,
    translator: ITranslator | null,
    settingRegistry: ISettingRegistry | null
  ) => {
    const trans = (translator ?? nullTranslator).load(TRANSLATION_NAMESPACE);

    let enabled = false;
    let markerKey = DEFAULT_MARKER_KEY;
    const observers = new Map<string, NotebookDiffObserver>();

    const startObserver = (panel: NotebookPanel): void => {
      if (!enabled || observers.has(panel.id)) {
        return;
      }
      const observer = new NotebookDiffObserver(
        panel,
        cellFooterTracker,
        markerKey,
        trans
      );
      observers.set(panel.id, observer);
      panel.disposed.connect(() => observers.delete(panel.id));
      void observer.start();
    };

    const startAll = (): void => {
      if (!enabled) {
        return;
      }
      notebookTracker.forEach(startObserver);
    };

    const stopAll = (): void => {
      for (const observer of observers.values()) {
        observer.dispose();
      }
      observers.clear();
    };

    notebookTracker.widgetAdded.connect((_sender, panel) => {
      startObserver(panel);
    });

    if (settingRegistry) {
      try {
        const settings = await settingRegistry.load(PLUGIN_ID);
        const readSettings = (): void => {
          enabled = settings.get('enabled').composite as boolean;
          // Note: a runtime `markerKey` change only affects notebooks opened
          // afterwards — each observer captures the key at construction. This
          // is acceptable; changing the key mid-session is not expected.
          markerKey =
            (settings.get('markerKey').composite as string) ||
            DEFAULT_MARKER_KEY;
        };
        readSettings();
        settings.changed.connect(() => {
          const wasEnabled = enabled;
          readSettings();
          if (enabled) {
            startAll();
          } else if (wasEnabled) {
            // Live-disable: tear down all observers and clear diffs.
            stopAll();
          }
        });
      } catch (error) {
        console.warn(`Failed to load settings for ${PLUGIN_ID}`, error);
      }
    }

    // Wire notebooks already open (the widgetAdded signal only fires for
    // notebooks opened after the connection above).
    startAll();
  }
};

export default metadataDiffPlugin;

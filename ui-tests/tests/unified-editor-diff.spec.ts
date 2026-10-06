import { expect, IJupyterLabPageFixture, test } from '@jupyterlab/galata';
import { NotebookPanel } from '@jupyterlab/notebook';

/**
 * The result of a diff, as `UnifiedEditorDiffManager.result` gives it.
 */
interface IResult {
  outcome: string;
  source: string;
}

/**
 * Open a new notebook whose first cell holds the given source. The second
 * cell is the active one, so that the cell toolbar, which shows on the active
 * cell, does not cover the buttons of the diff in the first cell.
 */
async function openNotebook(page: IJupyterLabPageFixture, source: string) {
  await page.notebook.createNew();
  await page.evaluate(source => {
    const panel = window.jupyterapp.shell.currentWidget as NotebookPanel;
    panel.content.widgets[0].model.sharedModel.setSource(source);
    panel.model!.sharedModel.insertCell(1, { cell_type: 'code', source: '' });
    panel.content.activeCellIndex = 1;
  }, source);
}

/**
 * Show a diff in the editor of the first cell, with the exported API. The
 * manager is kept as `window.editorDiff` for the other steps of a test.
 */
async function showDiffInFirstCell(
  page: IJupyterLabPageFixture,
  originalSource: string,
  newSource: string
) {
  await page.evaluate(
    ({ originalSource, newSource }) => {
      const { UnifiedEditorDiffManager } = (window as any).jupyterlabDiff;
      const panel = window.jupyterapp.shell.currentWidget as NotebookPanel;
      (window as any).editorDiff = new UnifiedEditorDiffManager({
        editor: panel.content.widgets[0].editor,
        originalSource,
        newSource
      });
    },
    { originalSource, newSource }
  );
}

/**
 * Wait for the result of the diff shown last.
 */
async function getResult(page: IJupyterLabPageFixture): Promise<IResult> {
  return await page.evaluate(() => (window as any).editorDiff.result);
}

/**
 * Get the source of the first cell in the active notebook.
 */
async function getCellContent(page: IJupyterLabPageFixture): Promise<string> {
  return await page.evaluate(() => {
    const panel = window.jupyterapp.shell.currentWidget as NotebookPanel;
    return panel.content.widgets[0].model.sharedModel.getSource();
  });
}

test.describe('Unified Editor Diff API', () => {
  test.beforeEach(async ({ page }) => {
    await page.sidebar.close();
    // JupyterLab loads the extension from its module federation container,
    // which exposes the main module of the package as `./index`: the module
    // that another extension imports.
    await page.evaluate(async () => {
      const container = (window as any)._JUPYTERLAB['jupyterlab-diff'];
      (window as any).jupyterlabDiff = (await container.get('./index'))();
    });
  });

  test('should keep all changes on accept all', async ({ page }) => {
    const originalSource = 'x = 1';
    const newSource = 'x = 2\nprint(x)';

    await openNotebook(page, originalSource);
    await showDiffInFirstCell(page, originalSource, newSource);

    const cell = page.locator('.jp-Cell').first();
    await expect(cell.locator('.jp-merge-accept-button')).toHaveCount(1);
    await expect(cell.locator('.jp-merge-reject-button')).toHaveCount(1);

    await page.evaluate(() => (window as any).editorDiff.acceptAll());

    expect(await getResult(page)).toEqual({
      outcome: 'accepted',
      source: newSource
    });
    await expect(cell.locator('.jp-merge-accept-button')).toHaveCount(0);
    expect(await getCellContent(page)).toBe(newSource);
  });

  test('should restore the original source on reject all', async ({ page }) => {
    const originalSource = 'x = 1';
    const newSource = 'x = 2\nprint(x)';

    await openNotebook(page, originalSource);
    await showDiffInFirstCell(page, originalSource, newSource);

    await page.evaluate(() => (window as any).editorDiff.rejectAll());

    expect(await getResult(page)).toEqual({
      outcome: 'rejected',
      source: originalSource
    });
    const cell = page.locator('.jp-Cell').first();
    await expect(cell.locator('.jp-merge-reject-button')).toHaveCount(0);
    expect(await getCellContent(page)).toBe(originalSource);
  });

  test('should end once every chunk is accepted or rejected', async ({
    page
  }) => {
    const originalSource = 'a = 1\n \nb = 2';
    const newSource = 'a = 10\n \nb = 20';

    await openNotebook(page, originalSource);
    await showDiffInFirstCell(page, originalSource, newSource);

    const cell = page.locator('.jp-Cell').first();
    await expect(cell.locator('.jp-merge-reject-button')).toHaveCount(2);

    await cell.locator('.jp-merge-reject-button').first().click();
    await expect(cell.locator('.jp-merge-accept-button')).toHaveCount(1);
    expect(
      await page.evaluate(() => (window as any).editorDiff.isResolved)
    ).toBe(false);

    await cell.locator('.jp-merge-accept-button').first().click();

    expect(await getResult(page)).toEqual({
      outcome: 'mixed',
      source: 'a = 1\n \nb = 20'
    });
    await expect(cell.locator('.jp-merge-accept-button')).toHaveCount(0);
  });

  test('should not set the source again when the editor holds it', async ({
    page
  }) => {
    const originalSource = 'x = 1';
    const newSource = 'x = 2';

    // The change is applied first, and the diff is shown on request.
    await openNotebook(page, newSource);
    const changes = await page.evaluate(
      ({ originalSource, newSource }) => {
        const { UnifiedEditorDiffManager } = (window as any).jupyterlabDiff;
        const panel = window.jupyterapp.shell.currentWidget as NotebookPanel;
        const cell = panel.content.widgets[0];
        let count = 0;
        const onChange = () => {
          count++;
        };
        cell.model.sharedModel.changed.connect(onChange);
        (window as any).editorDiff = new UnifiedEditorDiffManager({
          editor: cell.editor,
          originalSource,
          newSource
        });
        cell.model.sharedModel.changed.disconnect(onChange);
        return count;
      },
      { originalSource, newSource }
    );
    expect(changes).toBe(0);

    const cell = page.locator('.jp-Cell').first();
    await expect(cell.locator('.jp-merge-reject-button')).toHaveCount(1);

    await page.evaluate(() => (window as any).editorDiff.rejectAll());

    expect(await getResult(page)).toEqual({
      outcome: 'rejected',
      source: originalSource
    });
  });

  test('should keep the source when disposed', async ({ page }) => {
    const originalSource = 'x = 1';
    const newSource = 'x = 2';

    await openNotebook(page, originalSource);
    await showDiffInFirstCell(page, originalSource, newSource);

    await page.evaluate(() => (window as any).editorDiff.dispose());

    expect(await getResult(page)).toEqual({
      outcome: 'disposed',
      source: newSource
    });
    const cell = page.locator('.jp-Cell').first();
    await expect(cell.locator('.jp-merge-accept-button')).toHaveCount(0);
  });

  test('should show a diff in a file editor', async ({ page }) => {
    const originalSource = 'x = 1';
    const newSource = 'x = 2';

    await page.menu.clickMenuItem('File>New>Python File');
    const fileEditor = page.locator('.jp-FileEditor');
    await expect(fileEditor).toBeVisible();

    await page.evaluate(
      ({ originalSource, newSource }) => {
        const { UnifiedEditorDiffManager } = (window as any).jupyterlabDiff;
        const widget = window.jupyterapp.shell.currentWidget as any;
        (window as any).editorDiff = new UnifiedEditorDiffManager({
          editor: widget.content.editor,
          originalSource,
          newSource
        });
      },
      { originalSource, newSource }
    );

    await fileEditor.locator('.jp-merge-accept-button').click();

    expect(await getResult(page)).toEqual({
      outcome: 'accepted',
      source: newSource
    });
    await expect(fileEditor.locator('.jp-merge-accept-button')).toHaveCount(0);
  });
});

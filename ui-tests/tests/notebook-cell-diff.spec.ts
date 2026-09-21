import { expect, IJupyterLabPageFixture, test } from '@jupyterlab/galata';

const UNIFIED_DIFF_COMMAND = 'jupyterlab-diff:unified-cell-diff';

/**
 * Add a cell to the notebook and mark it as 'added'.
 * Starts with a fresh notebook (1 default cell) then adds a second cell so
 * rejecting the added cell doesn't hit the single-cell edge case.
 */
async function setupAddedCell(
  page: IJupyterLabPageFixture,
  cellSource: string
): Promise<void> {
  await page.notebook.createNew();
  await page.notebook.addCell('code', cellSource);

  await page.evaluate(
    async ({ command }) => {
      const notebookPanel = window.jupyterapp.shell.currentWidget as any;
      const notebook = notebookPanel.content;
      // The new cell is the last one.
      notebook.activeCellIndex = notebook.widgets.length - 1;
      const cellId = notebook.activeCell?.model.id;
      await window.jupyterapp.commands.execute(command, {
        action: 'add',
        cellId,
        showActionButtons: true
      });
    },
    { command: UNIFIED_DIFF_COMMAND }
  );
}

async function setupDeletedCell(
  page: IJupyterLabPageFixture,
  cellSource: string,
  insertIndex = 0,
  cellType = 'code'
): Promise<void> {
  await page.notebook.createNew();

  await page.evaluate(
    async ({ source, insertIndex, cellType, command }) => {
      await window.jupyterapp.commands.execute(command, {
        action: 'delete',
        originalSource: source,
        cellType,
        insertIndex,
        showActionButtons: true
      });
    },
    { source: cellSource, insertIndex, cellType, command: UNIFIED_DIFF_COMMAND }
  );
}

/**
 * Locate a button by its text label inside the deleted cell ghost panel.
 * The ghost panel is attached outside Lumino's tracked widget tree so
 * aria-hidden may be set on its ancestors; use a CSS locator instead of
 * getByRole to avoid that restriction.
 */
function deletedCellButton(page: IJupyterLabPageFixture, label: string) {
  return page
    .locator('.jp-diff-deleted-cell button')
    .filter({ hasText: label });
}

test.describe('Added Cell Diff', () => {
  test.beforeEach(async ({ page }) => {
    await page.sidebar.close();
  });

  test('should show added cell with styling', async ({ page }) => {
    await setupAddedCell(page, 'print("new cell")');
    await expect(page.locator('.jp-diff-added-cell')).toBeVisible();
  });

  test('should show accept and reject buttons', async ({ page }) => {
    await setupAddedCell(page, 'x = 42');
    await page.pause();
    await expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reject' })).toBeVisible();
  });

  test('should keep cell in notebook after accepting', async ({ page }) => {
    await setupAddedCell(page, 'x = 1');
    const countBefore = await page.notebook.getCellCount();

    await page.getByRole('button', { name: 'Accept' }).click();

    await expect(page.locator('.jp-diff-added-cell')).not.toBeVisible();
    expect(await page.notebook.getCellCount()).toBe(countBefore);
  });

  test('should remove cell from notebook after rejecting', async ({ page }) => {
    await setupAddedCell(page, 'x = 1');
    const countBefore = await page.notebook.getCellCount();

    await page.getByRole('button', { name: 'Reject' }).click();

    await expect(page.locator('.jp-diff-added-cell')).not.toBeVisible();
    expect(await page.notebook.getCellCount()).toBe(countBefore - 1);
  });
});

test.describe('Deleted Cell Diff', () => {
  test.beforeEach(async ({ page }) => {
    await page.sidebar.close();
  });

  test('should show ghost cell for deleted cell', async ({ page }) => {
    await setupDeletedCell(page, 'print("deleted")');
    await expect(page.locator('.jp-diff-deleted-cell')).toBeVisible();
  });

  test('should show accept and reject buttons', async ({ page }) => {
    await setupDeletedCell(page, 'y = 10');
    await expect(deletedCellButton(page, 'Accept')).toBeVisible();
    await expect(deletedCellButton(page, 'Reject')).toBeVisible();
  });

  test('should display the deleted cell source', async ({ page }) => {
    await setupDeletedCell(page, 'def my_function():\n    pass');
    await expect(page.locator('.jp-diff-deleted-cell')).toContainText(
      'my_function'
    );
  });

  test('should remove ghost cell after accepting deletion', async ({
    page
  }) => {
    await setupDeletedCell(page, 'z = 99');
    const countBefore = await page.notebook.getCellCount();

    await deletedCellButton(page, 'Accept').click({ force: true });

    await expect(page.locator('.jp-diff-deleted-cell')).not.toBeVisible();
    expect(await page.notebook.getCellCount()).toBe(countBefore);
  });

  test('should restore cell at correct index after rejecting', async ({
    page
  }) => {
    const source = 'restored = True';
    const insertIndex = 0;
    await setupDeletedCell(page, source, insertIndex);
    const countBefore = await page.notebook.getCellCount();

    await deletedCellButton(page, 'Reject').click({ force: true });

    await expect(page.locator('.jp-diff-deleted-cell')).not.toBeVisible();
    expect(await page.notebook.getCellCount()).toBe(countBefore + 1);
    expect(await page.notebook.getCellTextInput(insertIndex)).toBe(source);
  });
});

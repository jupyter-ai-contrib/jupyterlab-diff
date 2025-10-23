import { expect, IJupyterLabPageFixture, test } from '@jupyterlab/galata';
import { NotebookPanel } from '@jupyterlab/notebook';

/**
 * The command to open the cell split diff view.
 */
const SPLIT_CELL_DIFF_COMMAND = 'jupyterlab-diff:split-cell-diff';

/**
 * Setup a notebook cell with diff view.
 */
async function setupCellWithDiff(
  page: IJupyterLabPageFixture,
  originalSource: string,
  newSource: string
) {
  await page.notebook.createNew();
  await page.notebook.setCell(0, 'code', originalSource);

  await page.evaluate(
    async ({ originalSource, newSource, command }) => {
      await window.jupyterapp.commands.execute(command, {
        originalSource,
        newSource,
        showActionButtons: true,
        openDiff: true
      });
    },
    { originalSource, newSource, command: SPLIT_CELL_DIFF_COMMAND }
  );

  return page.locator('.cm-mergeView');
}

/**
 * Get the content of the first cell in the active notebook.
 */
async function getCellContent(page: IJupyterLabPageFixture): Promise<string> {
  return await page.evaluate(() => {
    const nbPanel = window.jupyterapp.shell.currentWidget as NotebookPanel;
    return nbPanel.content.widgets[0].model.sharedModel.getSource();
  });
}

test.describe('Cell Diff Extension', () => {
  test.beforeEach(async ({ page }) => {
    await page.sidebar.close();
  });

  test('should show diff with action buttons', async ({ page }) => {
    const originalSource = 'print("Hello, World!")';
    const newSource = 'print("Hello, JupyterLab!")\nprint("Testing diffs")';

    const diffWidget = await setupCellWithDiff(page, originalSource, newSource);
    await expect(diffWidget).toBeVisible();

    const toggleButton = page.getByRole('button', { name: 'Compare changes' });
    await expect(toggleButton).toBeVisible();

    const acceptButton = page.getByRole('button', { name: 'Accept Changes' });
    await expect(acceptButton).toBeVisible();

    const rejectButton = page.getByRole('button', { name: 'Reject Changes' });
    await expect(rejectButton).toBeVisible();
  });

  test('should accept changes when accept button is clicked', async ({
    page
  }) => {
    const originalSource = 'x = 1';
    const newSource = 'x = 2';

    const diffWidget = await setupCellWithDiff(page, originalSource, newSource);
    await expect(diffWidget).toBeVisible();

    const acceptButton = page.getByRole('button', { name: 'Accept Changes' });
    await acceptButton.click();

    const cellContent = await getCellContent(page);
    expect(cellContent).toBe(newSource);
  });

  test('should reject changes when reject button is clicked', async ({
    page
  }) => {
    const originalSource = 'y = 10';
    const newSource = 'y = 20';

    const diffWidget = await setupCellWithDiff(page, originalSource, newSource);
    await expect(diffWidget).toBeVisible();

    const rejectButton = page.getByRole('button', { name: 'Reject Changes' });
    await rejectButton.click();

    const cellContent = await getCellContent(page);
    expect(cellContent).toBe(originalSource);
  });

  test('should toggle diff visibility', async ({ page }) => {
    const originalSource = 'z = 100';
    const newSource = 'z = 200';

    const diffWidget = await setupCellWithDiff(page, originalSource, newSource);
    await expect(diffWidget).toBeVisible();

    const toggleButton = page
      .getByRole('button', { name: 'Compare changes' })
      .first();
    await toggleButton.click({ force: true });

    await expect(diffWidget).toBeHidden();

    await toggleButton.click({ force: true });

    await expect(diffWidget).toBeVisible();
  });
});

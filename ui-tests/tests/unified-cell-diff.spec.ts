import { expect, IJupyterLabPageFixture, test } from '@jupyterlab/galata';
import { NotebookPanel } from '@jupyterlab/notebook';

/**
 * The command to open the cell unified diff view.
 */
const UNIFIED_CELL_DIFF_COMMAND = 'jupyterlab-diff:unified-cell-diff';

/**
 * Setup a notebook cell with unified diff view.
 */
async function setupCellWithUnifiedDiff(
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
        showActionButtons: true
      });
    },
    { originalSource, newSource, command: UNIFIED_CELL_DIFF_COMMAND }
  );
}

/**
 * Get the content of the first cell in the active notebook.
 *
 * TODO: use getCellTextInput from galata?
 * See https://github.com/jupyterlab/jupyterlab/blob/1abbdf39fb204e47941e8d8021d85366a0ecece9/galata/src/helpers/notebook.ts#L677-L707
 */
async function getCellContent(page: IJupyterLabPageFixture): Promise<string> {
  return await page.evaluate(() => {
    const nbPanel = window.jupyterapp.shell.currentWidget as NotebookPanel;
    return nbPanel.content.widgets[0].model.sharedModel.getSource();
  });
}

test.describe('Unified Cell Diff Extension', () => {
  test.beforeEach(async ({ page }) => {
    await page.sidebar.close();
  });

  test('should show unified diff with action buttons', async ({ page }) => {
    const originalSource = 'print("Hello, World!")';
    const newSource = 'print("Hello, JupyterLab!")\nprint("Testing diffs")';

    await setupCellWithUnifiedDiff(page, originalSource, newSource);

    const acceptButton = page.getByRole('button', { name: 'Accept All' });
    await expect(acceptButton).toBeVisible();

    const rejectButton = page.getByRole('button', { name: 'Reject All' });
    await expect(rejectButton).toBeVisible();
  });

  test('should accept all changes when the accept button is clicked', async ({
    page
  }) => {
    const originalSource = 'x = 1';
    const newSource = 'x = 2';

    await setupCellWithUnifiedDiff(page, originalSource, newSource);

    const acceptButton = page.getByText('Accept All');
    await acceptButton.click();

    await expect(acceptButton).not.toBeVisible();

    const cellContent = await getCellContent(page);
    expect(cellContent).toBe(newSource);
  });

  test('should reject all changes when the reject button is clicked', async ({
    page
  }) => {
    const originalSource = 'y = 10';
    const newSource = 'y = 20';

    await setupCellWithUnifiedDiff(page, originalSource, newSource);

    const rejectButton = page.getByText('Reject All');
    await rejectButton.click();

    await expect(rejectButton).not.toBeVisible();

    const cellContent = await getCellContent(page);
    expect(cellContent).toBe(originalSource);
  });
});

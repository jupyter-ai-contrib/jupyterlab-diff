import { expect, IJupyterLabPageFixture, test } from '@jupyterlab/galata';

/**
 * The command to open the file unified diff view.
 */
const UNIFIED_FILE_DIFF_COMMAND = 'jupyterlab-diff:unified-file-diff';

/**
 * Default name for new Python files.
 */
const DEFAULT_NAME = 'untitled.py';

/**
 * Setup a file editor with unified diff view.
 */
async function setupFileWithUnifiedDiff(
  page: IJupyterLabPageFixture,
  originalSource: string,
  newSource: string
) {
  await page.evaluate(
    async ({ originalSource, newSource, command }) => {
      await window.jupyterapp.commands.execute(command, {
        originalSource,
        newSource,
        showActionButtons: true
      });
    },
    { originalSource, newSource, command: UNIFIED_FILE_DIFF_COMMAND }
  );
}

/**
 * Get the content of the current file in the editor.
 *
 * TODO: follow the same approach as in JupyterLab, with getEditorText?
 * See https://github.com/jupyterlab/jupyterlab/blob/1abbdf39fb204e47941e8d8021d85366a0ecece9/galata/test/jupyterlab/file-edit.test.ts#L73-L85
 */
async function getFileContent(page: IJupyterLabPageFixture): Promise<string> {
  return await page.evaluate(() => {
    const widget = window.jupyterapp.shell.currentWidget;
    if (widget && 'content' in widget) {
      const editor = (widget as any).content.editor;
      return editor.model.sharedModel.getSource();
    }
    return '';
  });
}

test.describe('Unified File Diff Extension', () => {
  test.beforeEach(async ({ page }) => {
    await page.menu.clickMenuItem('File>New>Python File');
    await page.sidebar.close();
  });

  test('should show unified diff with action buttons', async ({ page }) => {
    const originalSource = 'print("Hello, World!")';
    const newSource = 'print("Hello, JupyterLab!")\nprint("Testing diffs")';

    await setupFileWithUnifiedDiff(page, originalSource, newSource);

    const acceptButton = page.getByRole('button', { name: 'Accept All' });
    await expect(acceptButton).toBeVisible();

    const rejectButton = page.getByRole('button', { name: 'Reject All' });
    await expect(rejectButton).toBeVisible();
  });

  test('should accept all changes when accept button is clicked', async ({
    page
  }) => {
    const originalSource = 'x = 1';
    const newSource = 'x = 2';

    await setupFileWithUnifiedDiff(page, originalSource, newSource);

    const acceptButton = page.getByText('Accept All');
    await acceptButton.click();

    const fileContent = await getFileContent(page);
    expect(fileContent).toBe(newSource);
  });

  test('should reject all changes when reject button is clicked', async ({
    page
  }) => {
    const originalSource = 'y = 10';
    const newSource = 'y = 20';

    await setupFileWithUnifiedDiff(page, originalSource, newSource);

    const rejectButton = page.getByText('Reject All');
    await rejectButton.click();

    const fileContent = await getFileContent(page);
    expect(fileContent).toBe(originalSource);
  });
});

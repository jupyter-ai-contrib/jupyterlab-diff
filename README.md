# jupyterlab-cell-diff

[![Github Actions Status](https://github.com/jupyter-ai-contrib/jupyterlab-cell-diff/workflows/Build/badge.svg)](https://github.com/jupyter-ai-contrib/jupyterlab-cell-diff/actions/workflows/build.yml)

A JupyterLab extension for showing cell diffs with multiple diffing strategies.

## Requirements

- JupyterLab >= 4.0.0

## Installation

### PyPI Installation

```bash
pip install jupyterlab_cell_diff
```

### Development Installation

```bash
# Clone the repository
git clone https://github.com/jupyter-ai-contrib/jupyterlab-cell-diff.git
cd jupyterlab-cell-diff

# Install the extension in development mode
pip install -e .
jupyter labextension develop . --overwrite
```

## Usage

### Commands

The extension provides a command to show cell diffs:

- `jupyterlab-cell-diff:show-codemirror` - Show diff using `@codemirror/merge`

https://github.com/user-attachments/assets/0dacd7f0-5963-4ebe-81da-2958f0117071

### Programmatic Usage

```typescript
app.commands.execute('jupyterlab-cell-diff:show-codemirror', {
  cellId: 'cell-id',
  originalSource: 'print("Hello")',
  newSource: 'print("Hello, World!")'
});
```

#### Command Arguments

The `jupyterlab-cell-diff:show-codemirror` command accepts the following arguments:

| Argument            | Type      | Required | Description                                                                          |
| ------------------- | --------- | -------- | ------------------------------------------------------------------------------------ |
| `cellId`            | `string`  | No       | ID of the cell to show diff for. If not provided, uses the active cell               |
| `originalSource`    | `string`  | Yes      | Original source code to compare against                                              |
| `newSource`         | `string`  | Yes      | New source code to compare with                                                      |
| `showActionButtons` | `boolean` | No       | Whether to show action buttons in the diff widget (default: `true`)                  |
| `notebookPath`      | `string`  | No       | Path to the notebook containing the cell. If not provided, uses the current notebook |
| `openDiff`          | `boolean` | No       | Whether to open the diff widget automatically (default: `true`)                      |

## Uninstall

To remove the extension, execute:

```bash
pip uninstall jupyterlab_cell_diff
```

## Troubleshoot

To check the frontend extension is installed:

```bash
jupyter labextension list
```

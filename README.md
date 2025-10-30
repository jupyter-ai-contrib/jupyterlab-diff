# jupyterlab-diff

[![Github Actions Status](https://github.com/jupyter-ai-contrib/jupyterlab-diff/workflows/Build/badge.svg)](https://github.com/jupyter-ai-contrib/jupyterlab-diff/actions/workflows/build.yml)

A JupyterLab extension for showing cell diffs with multiple diffing strategies.

## Requirements

- JupyterLab >= 4.0.0

## Installation

### PyPI Installation

```bash
pip install jupyterlab_diff
```

### Development Installation

```bash
# Clone the repository
git clone https://github.com/jupyter-ai-contrib/jupyterlab-diff.git
cd jupyterlab-diff

# Install the extension in development mode
pip install -e .
jupyter labextension develop . --overwrite
```

## Usage

### Commands

The extension provides commands to show diffs in multiple formats:

- `jupyterlab-diff:split-cell-diff` - Show cell diff using split view (side-by-side comparison)
- `jupyterlab-diff:unified-cell-diff` - Show cell diff using unified view
- `jupyterlab-diff:unified-file-diff` - Show file diff using unified view for regular Python files and other text files

<https://github.com/user-attachments/assets/0dacd7f0-5963-4ebe-81da-2958f0117071>

### Programmatic Usage

#### Split Cell Diff (Side-by-side View)

```typescript
app.commands.execute('jupyterlab-diff:split-cell-diff', {
  cellId: 'cell-id',
  originalSource: 'print("Hello")',
  newSource: 'print("Hello, World!")',
  showActionButtons: true,
  openDiff: true
});
```

#### Unified Cell Diff

```typescript
app.commands.execute('jupyterlab-diff:unified-cell-diff', {
  cellId: 'cell-id',
  originalSource: 'print("Hello")',
  newSource: 'print("Hello, World!")',
  showActionButtons: true
});
```

#### Unified File Diff

```typescript
app.commands.execute('jupyterlab-diff:unified-file-diff', {
  filePath: '/path/to/file.py',
  originalSource: 'print("Hello")',
  newSource: 'print("Hello, World!")',
  showActionButtons: true
});
```

### Browser console via `window.jupyterapp`

The commands can also be run from the browser console (for example during development) via the `app` object exposed as `window.jupyterapp`. The commands can be executed exactly the same way using `window.jupyterapp.commands.execute(...)`.

First JupyterLab needs to be started with the `--expose-app-in-browser` flag to expose `window.jupyterapp`:

```bash
jupyter lab --expose-app-in-browser
```

Then, in the browser dev tools console:

```javascript
window.jupyterapp.commands.execute('jupyterlab-diff:split-cell-diff', {
  originalSource: `def add():\n  return\n`,
  newSource: `def add(a, b):\n  return a + b\n`,
  showActionButtons: true
});
```

### Command Arguments

#### `jupyterlab-diff:split-cell-diff` (Split View)

| Argument            | Type      | Required | Description                                                                          |
| ------------------- | --------- | -------- | ------------------------------------------------------------------------------------ |
| `cellId`            | `string`  | No       | ID of the cell to show diff for. If not provided, uses the active cell               |
| `originalSource`    | `string`  | Yes      | Original source code to compare against                                              |
| `newSource`         | `string`  | Yes      | New source code to compare with                                                      |
| `showActionButtons` | `boolean` | No       | Whether to show action buttons in the diff widget (default: `true`)                  |
| `notebookPath`      | `string`  | No       | Path to the notebook containing the cell. If not provided, uses the current notebook |
| `openDiff`          | `boolean` | No       | Whether to open the diff widget automatically (default: `true`)                      |

#### `jupyterlab-diff:unified-cell-diff` (Unified View)

| Argument            | Type      | Required | Description                                                                          |
| ------------------- | --------- | -------- | ------------------------------------------------------------------------------------ |
| `cellId`            | `string`  | No       | ID of the cell to show diff for. If not provided, uses the active cell               |
| `originalSource`    | `string`  | Yes      | Original source code to compare against                                              |
| `newSource`         | `string`  | Yes      | New source code to compare with                                                      |
| `showActionButtons` | `boolean` | No       | Whether to show action buttons for chunk acceptance (default: `true`)                |
| `allowInlineDiffs`  | `boolean` | No       | Whether to show inline diffs in the diff widget (default: `false`)                   |
| `notebookPath`      | `string`  | No       | Path to the notebook containing the cell. If not provided, uses the current notebook |

#### `jupyterlab-diff:unified-file-diff` (File Diff)

| Argument            | Type      | Required | Description                                                           |
| ------------------- | --------- | -------- | --------------------------------------------------------------------- |
| `filePath`          | `string`  | No       | Path to the file to diff. Defaults to current file in editor.         |
| `originalSource`    | `string`  | Yes      | Original source code to compare against                               |
| `newSource`         | `string`  | Yes      | New source code to compare with                                       |
| `showActionButtons` | `boolean` | No       | Whether to show action buttons for chunk acceptance (default: `true`) |
| `allowInlineDiffs`  | `boolean` | No       | Whether to show inline diffs in the diff widget (default: `false`)    |

## Architecture

### Diff Strategies

The extension provides two diff viewing strategies:

- **Split diff** (`split-cell-diff`): Uses CodeMirror's two-pane view. Displays original and modified code side-by-side in separate panels with diff highlighting.

- **Unified diff** (`unified-cell-diff`/`unified-file-diff`): Uses CodeMirror's `unifiedMergeView`. Displays changes in a single unified view with added/removed lines clearly marked. Can be used for both cell diffs and regular file diffs.

## Contributing

We welcome contributions from the community! To contribute:

- Fork the repository
- Make a development install of jupyterlab-diff
- Create a new branch
- Make your changes
- Submit a pull request
  For more details, check out our [CONTRIBUTING.md](https://github.com/jupyter-ai-contrib/jupyterlab-diff?tab=contributing-ov-file#contributing).

## Uninstall

To remove the extension, execute:

```bash
pip uninstall jupyterlab_diff
```

## Troubleshoot

To check the frontend extension is installed:

```bash
jupyter labextension list
```

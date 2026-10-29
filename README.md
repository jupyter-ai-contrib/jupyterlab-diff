# jupyterlab-diff

[![Github Actions Status](https://github.com/jupyter-ai-contrib/jupyterlab-diff/workflows/Build/badge.svg)](https://github.com/jupyter-ai-contrib/jupyterlab-diff/actions/workflows/build.yml)
[![version on npm](https://img.shields.io/npm/v/jupyterlab-diff.svg)](https://www.npmjs.com/package/jupyterlab-diff)
[![version on PyPI](https://img.shields.io/pypi/v/jupyterlab-diff.svg)](https://pypi.org/project/jupyterlab-diff/)
[![version on conda-forge](https://img.shields.io/conda/vn/conda-forge/jupyterlab-diff.svg)](https://anaconda.org/conda-forge/jupyterlab-diff)
[![lite-badge](https://jupyterlite.rtfd.io/en/latest/_static/badge.svg)](https://jupyter-ai-contrib.github.io/jupyterlab-diff/lab/index.html?path=diff-demo.ipynb)

A JupyterLab extension for showing cell diffs with multiple diffing strategies.

It offers two ways to drive a diff: **imperative commands** (you pass the
original/new source directly), and a **metadata-driven observer** (a diff is
rendered automatically from a durable marker written into a cell's metadata, so
it survives reload/disconnect). See [Metadata-driven cell diffs](#metadata-driven-cell-diffs).

## Requirements

- JupyterLab >= 4.0.0

## Try it in your browser

You can try the extension directly in your browser using JupyterLite:

[![lite-badge](https://jupyterlite.rtfd.io/en/latest/_static/badge.svg)](https://jupyter-ai-contrib.github.io/jupyterlab-diff/lab/index.html?path=diff-demo.ipynb)

The demo site is deployed to GitHub Pages from the [demo](./demo) folder and includes a
notebook demonstrating the different diff commands.

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
jupyter-builder develop . --overwrite
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

## Metadata-driven cell diffs

In addition to the imperative commands above, the extension ships an opt-in
plugin (`jupyterlab-diff:metadata-diff`) that renders a per-cell diff
**automatically** from a marker stored in a cell's metadata. Because the diff is
a projection of durable metadata rather than transient UI state, it survives
notebook close/reopen, refresh, and disconnect, and is re-derived on load.

This is a generic mechanism: any producer — a JupyterLab extension, a
server-side component, or a script — can write the marker to request a diff.
It is not tied to any particular tool or workflow.

### Enabling

Off by default. Enable via Settings (or `overrides.json`):

```json
{
  "jupyterlab-diff:metadata-diff": {
    "enabled": true,
    "markerKey": "jupyterlab-diff"
  }
}
```

- `enabled` — turn the observer on.
- `markerKey` — the cell-metadata key the observer watches (default
  `"jupyterlab-diff"`).

The whole-cell Accept/Reject buttons render in the cell's input footer, provided
by [`jupyterlab-cell-input-footer`](https://www.npmjs.com/package/jupyterlab-cell-input-footer).

### Marker schema

A producer applies a change to a cell **in place** and writes a marker under the
`markerKey`. The cell already holds the _new_ content; the marker carries what
the UI can't otherwise recover (the original) and how to resolve it:

```jsonc
// cell.metadata[markerKey]
{
  "op": "edit" | "add" | "delete", // required; any other value is ignored
  "original_source": "def add(a):\n    return a\n" // the cell's source BEFORE the change ("" for add)
}
```

Producers may include extra fields for their own bookkeeping; the observer
ignores anything it doesn't recognize.

How the diff is derived and resolved per op:

| `op`     | original side     | new side         | Accept          | Reject                     |
| -------- | ----------------- | ---------------- | --------------- | -------------------------- |
| `edit`   | `original_source` | live cell source | keep new        | restore `original_source`  |
| `add`    | `""`              | live cell source | keep the cell   | remove the cell            |
| `delete` | `original_source` | `""`             | remove the cell | keep the cell (restore it) |

Notes:

- `delete` is a **soft delete**: the cell stays in place carrying the marker
  until the user resolves it.
- On repeated edits, a producer should preserve the _first_ `original_source` so
  the diff always reflects the change versus the true pre-change state.
- Resolution is **whole-cell** (Accept/Reject in the footer), applied through
  the cell's shared model so a single edit-mode undo restores the content and
  the marker together. Resolving clears the marker.

Per-op examples:

```jsonc
// edit — cell now holds the new source; diff shows original -> current
"jupyterlab-diff": { "op": "edit", "original_source": "x = 1\n" }

// add — brand-new cell; whole cell shown as added
"jupyterlab-diff": { "op": "add", "original_source": "" }

// delete — cell still present, shown as fully removed; accept confirms deletion
"jupyterlab-diff": { "op": "delete", "original_source": "print('bye')\n" }
```

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

# jupyterlab-cell-diff

[![Github Actions Status](https://github.com/Zsailer/jupyterlab-cell-diff/workflows/Build/badge.svg)](https://github.com/Zsailer/jupyterlab-cell-diff/actions/workflows/build.yml)
[![PyPI version](https://badge.fury.io/py/jupyterlab-cell-diff.svg)](https://badge.fury.io/py/jupyterlab-cell-diff)

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

The extension provides several commands:

- `jupyterlab-cell-diff:show-codemirror` - Show diff using `@codemirror/merge`
- `jupyterlab-cell-diff:show-nbdime` - Show diff using NBDime

### Programmatic Usage

```typescript
app.commands.execute('jupyterlab-cell-diff:show-codemirror', {
  cellId: 'cell-id',
  originalSource: 'print("Hello")',
  newSource: 'print("Hello, World!")'
});

app.commands.execute('jupyterlab-cell-diff:show-nbdime', {
  cellId: 'cell-id',
  originalSource: 'print("Hello")',
  newSource: 'print("Hello, World!")'
});
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall jupyterlab_cell_diff
```

## Troubleshoot

If you are seeing the frontend extension, but it is not working, check
that the server extension is enabled:

```bash
jupyter server extension list
```

If the server extension is installed and enabled, but you are not seeing
the frontend extension, check the frontend extension is installed:

```bash
jupyter labextension list
```

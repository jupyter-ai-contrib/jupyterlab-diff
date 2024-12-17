# JupyterLab Plugin: Show a Cell Diff

[![Github Actions Status](https://github.com/Zsailer/jupyterlab-cell-diff/workflows/Build/badge.svg)](https://github.com/Zsailer/jupyterlab-cell-diff/actions/workflows/build.yml)

A JupyterLab Extension for showing cell (git) diffs.

This extension is composed of a Python package named `jupyterlab_cell_diff`
for the server extension and a NPM package named `jupyterlab-cell-diff`
for the frontend extension.

## Requirements

- JupyterLab >= 4.0.0

## Install

To install the extension, execute:

```bash
pip install jupyterlab_cell_diff
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

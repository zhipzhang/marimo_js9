# marimo-js9

`marimo-js9` displays a FITS image in a fully interactive
[JS9](https://js9.si.edu/) viewer directly inside a
[marimo](https://marimo.io/) notebook output cell.

```python
from marimo_js9 import JS9

viewer = JS9(
    "image.fits",
    regions="source.reg",
)

viewer
```

No separate JS9 application or helper server is started. The package reads the
FITS and optional DS9 region files in Python, transfers their original contents
to the cell, and lets JS9 process them in the browser. The input files are not
converted.

## Install

```bash
pip install marimo-js9
```

Then run the notebook as usual with marimo. A `JS9` instance is an anywidget,
which marimo renders directly; importing `marimo` or wrapping the viewer in a
marimo UI element is not necessary.

## Options

Set the canvas size and pass JSON-compatible JS9 load options when needed:

```python
viewer = JS9(
    "image.fits.gz",
    width=700,
    height=600,
    options={
        "scale": "log",
        "colormap": "heat",
    },
)
```
The viewer shrinks to fit a narrow output column by default. Set `fit=False`
to use the exact requested dimensions with horizontal scrolling.

`regions` accepts either a region-file path or literal DS9 region text:

```python
JS9("image.fits", regions="fk5; circle(12.3, -4.5, 2\")")
```

The browser-facing JS9 3.9 assets are loaded from an immutable jsDelivr URL,
so displaying a viewer requires network access by default. For an offline or
restricted environment, host the unmodified JS9 3.9 distribution on an HTTP
server already available to the browser and set its directory:

```python
JS9("image.fits", asset_base="https://notebooks.example/js9/")
```

The directory must contain `js9-allinone.css`, `js9support.min.js`,
`js9.min.js`, `js9plugins.min.js`, `astroemw.js`, `astroemw.wasm`, and the
image/font assets referenced by JS9's stylesheet.

## Scope and limitations

- FITS handling, image controls, region editing, and other browser-side JS9
  features work inside the cell.
- The full FITS file is transferred to the browser and kept in memory, just as
  when a local file is opened in JS9. Very large files may be expensive.
- JS9 features that explicitly require its optional Node helper or server-side
  analysis are unavailable. No helper is required for normal viewing.
- JS9 3.9 is the final archived JS9 release. The package pins that release to
  avoid unexpected upstream changes.

## Development

```bash
python -m pip install -e '.[dev]'
pytest
ruff check .
python -m build
```

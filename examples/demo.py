import marimo

__generated_with = "0.25.0"
app = marimo.App(width="full")


@app.cell
def _():
    from marimo_js9 import JS9

    DATA_DIR = "/Users/zhipz/CodeProjects/Learnning/_02_Xray_Visualize"

    viewer = JS9(
        f"{DATA_DIR}/2-7_flux.img",
        regions=f"{DATA_DIR}/ds9.reg",
        options={"scale": "log"},
    )
    viewer
    return DATA_DIR, JS9


@app.cell
def _(DATA_DIR, JS9):
    # Chandra event files (FITS binary tables) load directly: JS9 bins the
    # event table into an image in the browser. This file is ~52 MB, so the
    # initial transfer can take a little while.
    events = JS9(
        f"{DATA_DIR}/acisf03843_repro_evt2.fits",
        options={"scale": "log", "colormap": "heat"},
    )
    events
    return


if __name__ == "__main__":
    app.run()

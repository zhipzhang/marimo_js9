from pathlib import Path

import pytest

from marimo_js9 import JS9
from marimo_js9._widget import DEFAULT_ASSET_BASE


@pytest.fixture
def fits_file(tmp_path: Path) -> Path:
    path = tmp_path / "tiny.fits"
    path.write_bytes(b"SIMPLE  =                    T" + bytes(96))
    return path


def test_reads_fits_and_regions(fits_file: Path, tmp_path: Path) -> None:
    region_file = tmp_path / "source.reg"
    region_file.write_text(
        "# Region file format: DS9 version 4.1\nimage\ncircle(10,10,3)\n",
        encoding="utf-8",
    )

    viewer = JS9(
        fits_file,
        regions=region_file,
        width=640,
        height=480,
        fit=False,
        options={"scale": "log"},
    )

    assert viewer.image_data == fits_file.read_bytes()
    assert viewer.filename == "tiny.fits"
    assert viewer.region_filename == "source.reg"
    assert "circle(10,10,3)" in viewer.region_text
    assert viewer.width == 640
    assert viewer.height == 480
    assert viewer.fit is False
    assert viewer.options == {"scale": "log", "zoom": "to fit"}
    assert viewer.asset_base == DEFAULT_ASSET_BASE


def test_accepts_literal_region_text(fits_file: Path) -> None:
    viewer = JS9(fits_file, regions="fk5; circle(12.3, -4.5, 2\")")

    assert viewer.region_filename == "regions.reg"
    assert viewer.region_text.startswith("fk5;")


def test_default_size_and_zoom_fit(fits_file: Path) -> None:
    viewer = JS9(fits_file)

    assert viewer.width == 800
    assert viewer.height == 640
    assert viewer.zoom_fit is True
    assert viewer.options == {"zoom": "to fit"}


def test_zoom_fit_can_be_disabled_or_overridden(fits_file: Path) -> None:
    viewer = JS9(fits_file, zoom_fit=False)
    assert viewer.options == {}

    viewer = JS9(fits_file, options={"zoom": 2})
    assert viewer.options == {"zoom": 2}


def test_rejects_non_boolean_zoom_fit(fits_file: Path) -> None:
    with pytest.raises(TypeError, match="zoom_fit"):
        JS9(fits_file, zoom_fit=1)  # type: ignore[arg-type]


def test_normalizes_asset_base(fits_file: Path) -> None:
    viewer = JS9(fits_file, asset_base="http://localhost:8000/js9")

    assert viewer.asset_base == "http://localhost:8000/js9/"


@pytest.mark.parametrize("dimension", [True, 0, 63, 3.5, "512"])
def test_rejects_invalid_dimensions(fits_file: Path, dimension: object) -> None:
    with pytest.raises(ValueError):
        JS9(fits_file, width=dimension)  # type: ignore[arg-type]



def test_rejects_non_boolean_fit(fits_file: Path) -> None:
    with pytest.raises(TypeError, match="fit"):
        JS9(fits_file, fit=1)  # type: ignore[arg-type]


def test_rejects_missing_input_files(tmp_path: Path, fits_file: Path) -> None:
    with pytest.raises(FileNotFoundError, match="FITS file"):
        JS9(tmp_path / "missing.fits")

    with pytest.raises(FileNotFoundError, match="Region file"):
        JS9(fits_file, regions="missing.reg")


def test_rejects_non_json_options(fits_file: Path) -> None:
    with pytest.raises(TypeError, match="JSON-serializable"):
        JS9(fits_file, options={"callback": object()})


@pytest.mark.parametrize("asset_base", ["", "./assets", "file:///tmp/js9"])
def test_rejects_non_http_asset_base(fits_file: Path, asset_base: str) -> None:
    with pytest.raises(ValueError, match="absolute"):
        JS9(fits_file, asset_base=asset_base)


def test_widget_frontend_files_are_packaged() -> None:
    assert Path(JS9._esm._path).is_file()
    assert Path(JS9._css._path).is_file()
    frontend = Path(JS9._esm._path).read_text(encoding="utf-8")
    assert "marimoJS9Resize" in frontend
    assert "SetZoom" in frontend
    assert "GaussBlurData" not in frontend

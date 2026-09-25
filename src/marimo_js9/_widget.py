"""The Python side of the marimo JS9 widget."""

from __future__ import annotations

import json
import os
import re
from collections.abc import Mapping
from pathlib import Path
from typing import Any, Optional, Union
from urllib.parse import urlparse

import anywidget
import traitlets

PathLike = Union[str, os.PathLike[str]]

_PACKAGE_DIR = Path(__file__).parent
_JS9_COMMIT = "ee8c8fda8adb22b80f7379bfcf33eeae8e3fe6d4"
DEFAULT_ASSET_BASE = (
    "https://cdn.jsdelivr.net/gh/ericmandel/js9@" f"{_JS9_COMMIT}/"
)
_REGION_EXPRESSION = re.compile(
    r"(?:annulus|box|circle|ellipse|line|polygon|point|text)\s*\(", re.I
)


def _file_bytes(path: PathLike, *, kind: str) -> tuple[Path, bytes]:
    source = Path(path).expanduser()
    if not source.is_file():
        raise FileNotFoundError(f"{kind} file does not exist: {source}")
    try:
        return source, source.read_bytes()
    except OSError as exc:
        raise OSError(f"Could not read {kind} file {source}: {exc}") from exc


def _region_source(regions: Optional[PathLike]) -> tuple[str, str]:
    if regions is None:
        return "", ""

    if isinstance(regions, os.PathLike):
        path, data = _file_bytes(regions, kind="Region")
        return path.name, data.decode("utf-8-sig")

    # A newline or a DS9 shape makes a string unambiguously region content.
    # Other strings are treated as paths so a typo such as "source.reg" fails
    # early instead of being sent to JS9 as malformed region syntax.
    if "\n" in regions or "\r" in regions or _REGION_EXPRESSION.search(regions):
        return "regions.reg", regions

    path, data = _file_bytes(regions, kind="Region")
    return path.name, data.decode("utf-8-sig")


def _asset_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("asset_base must be an absolute http:// or https:// URL")
    return value if value.endswith("/") else f"{value}/"


class JS9(anywidget.AnyWidget):
    """An interactive JS9 viewer that renders directly in a notebook output.

    Parameters
    ----------
    image:
        Path to a FITS image. The original bytes are sent to the browser; the
        package does not parse or convert the file.
    regions:
        Optional path to a DS9 region file. A literal DS9 region string is also
        accepted when it contains a shape expression or a newline.
    width, height:
        Size of the JS9 image canvas in CSS pixels.
    fit:
        Shrink the viewer to fit a narrow notebook output while preserving its
        aspect ratio.
    options:
        JSON-serializable options forwarded to ``JS9.Load`` (for example,
        ``{"scale": "log", "colormap": "heat"}``).
    asset_base:
        Base URL containing JS9 3.9 browser assets. The default is an immutable
        jsDelivr URL. Set this to an equivalent self-hosted asset directory when
        working offline.

    Notes
    -----
    The complete FITS file is held once by Python and transferred to the
    browser when the widget is displayed. JS9's optional server-side analysis
    features are not available; its browser-side viewing and region tools are.
    """

    _esm = _PACKAGE_DIR / "static" / "widget.js"
    _css = _PACKAGE_DIR / "static" / "widget.css"

    image_data = traitlets.Bytes().tag(sync=True)
    filename = traitlets.Unicode().tag(sync=True)
    region_text = traitlets.Unicode("").tag(sync=True)
    region_filename = traitlets.Unicode("").tag(sync=True)
    width = traitlets.Int(512).tag(sync=True)
    height = traitlets.Int(512).tag(sync=True)
    fit = traitlets.Bool(True).tag(sync=True)
    options = traitlets.Dict(default_value={}).tag(sync=True)
    asset_base = traitlets.Unicode(DEFAULT_ASSET_BASE).tag(sync=True)
    status = traitlets.Unicode("loading").tag(sync=True)
    error = traitlets.Unicode("").tag(sync=True)

    def __init__(
        self,
        image: PathLike,
        *,
        regions: Optional[PathLike] = None,
        width: int = 512,
        height: int = 512,
        fit: bool = True,
        options: Optional[Mapping[str, Any]] = None,
        asset_base: str = DEFAULT_ASSET_BASE,
        **kwargs: Any,
    ) -> None:
        if isinstance(width, bool) or not isinstance(width, int) or width < 64:
            raise ValueError("width must be an integer of at least 64 pixels")
        if isinstance(height, bool) or not isinstance(height, int) or height < 64:
            raise ValueError("height must be an integer of at least 64 pixels")
        if not isinstance(fit, bool):
            raise TypeError("fit must be a boolean")

        image_path, image_data = _file_bytes(image, kind="FITS")
        region_filename, region_text = _region_source(regions)
        load_options = dict(options or {})
        try:
            json.dumps(load_options)
        except (TypeError, ValueError) as exc:
            raise TypeError("options must be JSON-serializable") from exc

        super().__init__(
            image_data=image_data,
            filename=image_path.name,
            region_text=region_text,
            region_filename=region_filename,
            width=width,
            height=height,
            fit=fit,
            options=load_options,
            asset_base=_asset_url(asset_base),
            **kwargs,
        )

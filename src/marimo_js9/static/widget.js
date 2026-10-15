const MESSAGE_NAMESPACE = "marimo-js9";

function asUint8Array(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof DataView) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (Array.isArray(value)) {
    return Uint8Array.from(value);
  }
  throw new TypeError("The FITS payload is not binary data");
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function frameDocument({ assetBase, token, width, height }) {
  const base = escapeAttribute(assetBase);
  const safeToken = JSON.stringify(token).replaceAll("<", "\\u003c");
  const preferences = JSON.stringify({
    globalOpts: {
      alerts: false,
      helperType: "none",
      installDir: assetBase,
      useWasm: true,
    },
  }).replaceAll("<", "\\u003c");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="${base}js9-allinone.css">
    <style>
      html, body { margin: 0; padding: 0; background: white; }
      body { width: ${width}px; overflow: hidden; }
      #marimo-js9-viewer { width: ${width}px; }
      .JS9 { width: ${width}px; height: ${height}px; }
    </style>
    <script>window.JS9Prefs = ${preferences};<\/script>
    <script src="${base}js9support.min.js"><\/script>
    <script src="${base}js9.min.js"><\/script>
    <script src="${base}js9plugins.min.js"><\/script>
  </head>
  <body>
    <main id="marimo-js9-viewer">
      <div class="JS9Menubar" id="JS9Menubar"></div>
      <div class="JS9Toolbar" id="JS9Toolbar"></div>
      <div class="JS9" id="JS9" data-width="${width}" data-height="${height}"></div>
      <div class="JS9Statusbar" id="JS9Statusbar"></div>
    </main>
    <script>
      (() => {
        const token = ${safeToken};
        let js9Ready = false;
        let payload = null;
        let loaded = false;
        let requestedSize = { width: ${width}, height: ${height} };

        const report = (kind, detail = "") => {
          window.parent.postMessage(
            { namespace: "${MESSAGE_NAMESPACE}", token, kind, detail },
            "*"
          );
        };

        const fail = (error) => {
          const message = error instanceof Error ? error.message : String(error);
          report("error", message);
        };

        const finish = () => {
          resize();
          report("loaded");
        };

        const chromeHeight = () =>
          ["JS9Menubar", "JS9Toolbar", "JS9Statusbar"].reduce(
            (total, id) =>
              total + (document.getElementById(id)?.offsetHeight ?? 0),
            0
          );

        const resize = (refit = false) => {
          if (!js9Ready) return;
          const nextWidth = Math.max(64, Math.floor(requestedSize.width));
          const nextHeight = Math.max(64, Math.floor(requestedSize.height));
          const viewer = document.getElementById("marimo-js9-viewer");
          const chrome = chromeHeight();
          document.body.style.width = nextWidth + "px";
          document.documentElement.style.width = nextWidth + "px";
          document.documentElement.style.height = (nextHeight + chrome) + "px";
          document.body.style.height = (nextHeight + chrome) + "px";
          viewer.style.width = nextWidth + "px";
          // JS9 3.9 sizes the statusbar once at init and never updates it on
          // display.resize(), which clips the status text at the default
          // 512 px once the viewer is wider. Keep it in sync ourselves.
          const statusbar = document.getElementById("JS9Statusbar");
          if (statusbar) statusbar.style.width = nextWidth + "px";
          report("chrome", String(chrome));
          try {
            const display = window.JS9.lookupDisplay("JS9");
            if (!display) throw new Error("JS9 display is not available");
            display.resize(nextWidth, nextHeight, { center: true });
            if (refit && display.image) {
              window.JS9.SetZoom("to fit", { display: "JS9" });
            }
          } catch (error) {
            fail(error);
          }
        };

        window.marimoJS9Resize = (width, height, refit) => {
          requestedSize = { width: Number(width), height: Number(height) };
          resize(refit === true);
        };

        const load = () => {
          if (!js9Ready || !payload || loaded) return;
          loaded = true;
          try {
            const bytes = new Uint8Array(payload.image);
            const image = new File([bytes], payload.filename, {
              type: "application/fits",
            });
            const options = {
              ...payload.options,
              file: payload.filename,
              onload: (im) => {
                if (payload.zoomFit) {
                  try {
                    window.JS9.SetZoom("to fit", { display: im.display });
                  } catch (error) {
                    fail(error);
                  }
                }
                if (!payload.regions) {
                  finish();
                  return;
                }
                try {
                  const regionFile = new File(
                    [payload.regions],
                    payload.regionFilename || "regions.reg",
                    { type: "text/plain" }
                  );
                  window.JS9.LoadRegions(regionFile, {
                    display: im.display,
                    onload: finish,
                  });
                } catch (error) {
                  fail(error);
                }
              },
            };
            report("loading-image");
            window.JS9.Load(image, options, { display: "JS9" });
          } catch (error) {
            fail(error);
          }
        };

        window.addEventListener("message", (event) => {
          const data = event.data;
          if (
            !data ||
            data.namespace !== "${MESSAGE_NAMESPACE}" ||
            data.token !== token
          ) return;
          if (data.kind === "load") {
            payload = data;
            load();
          } else if (data.kind === "resize") {
            requestedSize = {
              width: Number(data.width),
              height: Number(data.height),
            };
            resize(data.refit === true);
          }
        });

        window.addEventListener("error", (event) => {
          fail(event.error || event.message || "Unknown JS9 error");
        });
        window.addEventListener("unhandledrejection", (event) => {
          fail(event.reason || "Unhandled JS9 promise rejection");
        });

        window.jQuery(document).on("JS9:ready", () => {
          js9Ready = true;
          resize();
          report("ready");
          load();
        });
      })();
    <\/script>
  </body>
</html>`;
}

function render({ model, el }) {
  const token = globalThis.crypto?.randomUUID?.()
    ?? `viewer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const width = model.get("width");
  const height = model.get("height");
  const fit = model.get("fit");
  let chromeHeight = 92;
  const root = document.createElement("div");
  const controls = document.createElement("div");
  const filename = document.createElement("span");
  const expand = document.createElement("button");
  const frame = document.createElement("iframe");
  const notice = document.createElement("div");
  let frameReady = false;

  root.className = "marimo-js9";
  controls.className = "marimo-js9__controls";
  filename.className = "marimo-js9__filename";
  filename.textContent = model.get("filename");
  filename.title = model.get("filename");
  expand.className = "marimo-js9__button";
  expand.type = "button";
  expand.title = "Toggle fullscreen";
  expand.setAttribute("aria-label", "Toggle fullscreen");
  expand.innerHTML =
    '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M1.5 6V1.5H6M10 1.5h4.5V6M14.5 10v4.5H10M6 14.5H1.5V10"/></svg>';
  notice.className = "marimo-js9__notice";
  notice.textContent = "Starting JS9…";
  frame.className = "marimo-js9__frame";
  frame.title = `JS9 viewer: ${model.get("filename")}`;
  frame.width = String(width);
  frame.height = String(height + chromeHeight);
  frame.setAttribute(
    "sandbox",
    "allow-downloads allow-modals allow-popups allow-same-origin allow-scripts"
  );

  root.style.width = `${width}px`;
  root.style.maxWidth = fit ? "100%" : "none";
  controls.append(filename, expand);
  root.append(controls, notice, frame);
  el.append(root);

  const isFullscreen = () => root.classList.contains("marimo-js9--fullscreen");

  const sendResize = (displayWidth, displayHeight, refit = false) => {
    if (!frameReady || !frame.contentWindow) return;
    try {
      if (typeof frame.contentWindow.marimoJS9Resize === "function") {
        frame.contentWindow.marimoJS9Resize(displayWidth, displayHeight, refit);
        return;
      }
    } catch (_) {
      // Fall back to postMessage when direct same-origin access is blocked.
    }
    frame.contentWindow.postMessage(
      {
        namespace: MESSAGE_NAMESPACE,
        token,
        kind: "resize",
        width: displayWidth,
        height: displayHeight,
        refit,
      },
      "*"
    );
  };

  const syncSize = (refit = false) => {
    if (isFullscreen()) return;
    let displayWidth = width;
    let displayHeight = height;
    if (fit) {
      const available = Math.max(
        160,
        Math.floor(el.getBoundingClientRect().width) - 2
      );
      if (available < width) {
        displayWidth = available;
        displayHeight = Math.max(64, Math.round(height * available / width));
      }
    }
    root.style.width = displayWidth + "px";
    frame.width = String(displayWidth);
    frame.height = String(displayHeight + chromeHeight);
    frame.style.width = displayWidth + "px";
    frame.style.height = (displayHeight + chromeHeight) + "px";
    sendResize(displayWidth, displayHeight, refit);
  };

  const layoutFullscreen = () => {
    const chrome = Math.ceil(controls.getBoundingClientRect().height);
    const displayWidth = Math.max(160, window.innerWidth - 16);
    const displayHeight = Math.max(
      64,
      window.innerHeight - chrome - chromeHeight - 16
    );
    frame.width = String(displayWidth);
    frame.height = String(displayHeight + chromeHeight);
    frame.style.width = displayWidth + "px";
    frame.style.height = (displayHeight + chromeHeight) + "px";
    sendResize(displayWidth, displayHeight, true);
  };

  expand.addEventListener("click", () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (typeof root.requestFullscreen === "function") {
      root.requestFullscreen();
    }
  });
  document.addEventListener("fullscreenchange", () => {
    const fullscreen =
      root.matches?.(":fullscreen") || document.fullscreenElement === root;
    if (fullscreen) {
      root.classList.add("marimo-js9--fullscreen");
      layoutFullscreen();
    } else {
      root.classList.remove("marimo-js9--fullscreen");
      syncSize(true);
    }
  });

  const setStatus = (status, error = "") => {
    model.set("status", status);
    model.set("error", error);
    model.save_changes();
  };

  const onMessage = (event) => {
    const data = event.data;
    if (
      event.source !== frame.contentWindow ||
      !data ||
      data.namespace !== MESSAGE_NAMESPACE ||
      data.token !== token
    ) return;

    if (data.kind === "ready") {
      frameReady = true;
      try {
        const source = asUint8Array(model.get("image_data"));
        const image = new Uint8Array(source);
        frame.contentWindow.postMessage(
          {
            namespace: MESSAGE_NAMESPACE,
            token,
            kind: "load",
            image: image.buffer,
            filename: model.get("filename"),
            regions: model.get("region_text"),
            regionFilename: model.get("region_filename"),
            options: model.get("options"),
            zoomFit: model.get("zoom_fit"),
          },
          "*",
          [image.buffer]
        );
        notice.textContent = "Loading FITS image…";
        setStatus("loading");
        syncSize();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        notice.textContent = `Could not send FITS image: ${message}`;
        notice.classList.add("marimo-js9__notice--error");
        if (!notice.isConnected) root.append(notice);
        setStatus("error", message);
      }
    } else if (data.kind === "chrome") {
      const next = Number(data.detail);
      if (Number.isFinite(next) && next > 0 && next !== chromeHeight) {
        chromeHeight = next;
        if (isFullscreen()) {
          layoutFullscreen();
        } else {
          syncSize();
        }
      }
    } else if (data.kind === "loading-image") {
      notice.textContent = "Loading FITS image…";
    } else if (data.kind === "loaded") {
      notice.remove();
      setStatus("ready");
    } else if (data.kind === "error") {
      const message = data.detail || "Unknown JS9 error";
      notice.textContent = `JS9 error: ${message}`;
      notice.classList.add("marimo-js9__notice--error");
      if (!notice.isConnected) root.append(notice);
      setStatus("error", message);
    }
  };


  const resizeObserver = new ResizeObserver(syncSize);
  resizeObserver.observe(el);
  window.addEventListener("resize", syncSize);
  window.addEventListener("message", onMessage);
  frame.srcdoc = frameDocument({
    assetBase: model.get("asset_base"),
    token,
    width,
    height,
  });
  setStatus("loading");
  requestAnimationFrame(syncSize);

  return () => {
    resizeObserver.disconnect();
    window.removeEventListener("resize", syncSize);
    window.removeEventListener("message", onMessage);
    frame.remove();
  };
}

export default { render };

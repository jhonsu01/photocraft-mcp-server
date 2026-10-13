<p align="center"><img src="icon.png" width="120" alt="PhotoCraft Bridge icon"></p>

<h1 align="center">PhotoCraft MCP Server</h1>

<p align="center">
  <b>English</b> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  Let Claude edit photos with the <b>PhotoCraft</b> installed on your computer — <b>Windows, macOS and Linux</b>:<br>
  adjustments, filters, background removal, text and layer styles, new designs and conversion between PSD, TIFF, PNG, JPEG, WebP and more.
</p>

---

## Why

[PhotoCraft](https://github.com/storytold/photocraft) is an open-source, Photoshop-class image editor written in Rust, with a headless CLI (`photocraft-cli`), 817 engine commands and an MCP mode. This [Model Context Protocol](https://modelcontextprotocol.io) server turns that engine into **file-in / file-out tools** for Claude, so you can ask things like:

> *"Resize every photo in `D:\shoot` to 2000 px, add auto contrast and a little sharpening, and save them as JPEG at quality 85."*
> *"Remove the background of `product.jpg`, crop it to the product and put it on white."*
> *"Make a 1080×1080 post with this photo, a purple gradient and the title 'SALE' with a drop shadow; also give me the PSD."*
> *"Add my logo in the bottom-right corner of all these images at 70 % opacity."*
> *"Convert these PSDs to WebP and tell me which layers and fonts each one uses."*

Sibling of [filmcraft-mcp-server](https://github.com/jhonsu01/filmcraft-mcp-server), [pdfcraft-mcp-server](https://github.com/jhonsu01/pdfcraft-mcp-server), [vectorcraft-mcp-server](https://github.com/jhonsu01/vectorcraft-mcp-server) and [audacity-mcp-server](https://github.com/jhonsu01/audacity-mcp-server).

## Platforms

| OS | PhotoCraft package to install | Where the server finds it (no setup needed) | Status |
| --- | --- | --- | --- |
| **Windows** 10/11 (x64, x86, arm64) | MSI or portable zip | `C:\Program Files\PhotoCraft`, `%LOCALAPPDATA%\Programs\PhotoCraft`, `PATH` | ✅ Verified (Windows 11) |
| **Linux** (x86_64, aarch64) | `.deb`, `.rpm` or `.tar.gz` | `/usr/bin`, `/usr/local/bin`, `/opt/photocraft/bin`, `~/.local/bin`, `PATH` | ✅ Verified (Debian 12, headless) |
| **macOS** 11+ (Apple silicon and Intel) | `.dmg` (the app) **plus** `photocraft-cli-<version>-macos-universal.zip` | `/Applications/PhotoCraft.app`, `/usr/local/bin`, `/opt/homebrew/bin`, `~/.local/bin`, `~/bin`, `PATH` | 🟡 Supported, not yet tested on a Mac |

All downloads: [PhotoCraft releases](https://github.com/storytold/photocraft/releases) (there is also a FreeBSD tar.gz; set `PHOTOCRAFT_DIR` to it). Anywhere else: set `PHOTOCRAFT_DIR` (folder, `.tar.gz` root or `PhotoCraft.app`) or `PHOTOCRAFT_CLI`.

- **macOS:** the DMG contains only the app. Unzip the separate `photocraft-cli` zip and move `photocraft-cli` to `/usr/local/bin` (or point `PHOTOCRAFT_CLI` at it). The first run checks Apple's notarization online.
- **Linux:** the AppImage and Flatpak contain only the app, not `photocraft-cli`; use the deb, rpm or tar.gz. For an AppImage app, set `PHOTOCRAFT_APP` so `open_in_photocraft` can start it. On a server without a GPU, the verified setup used `libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 fontconfig`.

## How it works

| Part | What it is |
| --- | --- |
| **PhotoCraft engine** (`photocraft-cli mcp`) | PhotoCraft's own engine: importers, adjustments, filters, Select Subject, type, shapes, layer styles and exporters. Started fresh and **headless** for each job, so it never edits a PhotoCraft window you have open. |
| **MCP server** (Node.js) | 10 high-level tools. The engine only reads and writes inside a private folder, so the server copies your files in, works on the copies and moves the results to where you asked: **your originals are never opened in place**. It validates paths and never overwrites. |
| **Live app** (optional) | `open_in_photocraft control=true` starts the app with its authenticated, loopback-only control channel (port 7878, token kept in the connector's own folder) and `run_photo_commands live=true` drives it. |

## Tools

| Tool | What it does |
| --- | --- |
| `edit_image` | A list of operations on one image, a list or a whole folder: resize (size, %, fit), crop, canvas, rotate, flip, trim, auto tone / contrast / colour, 21 adjustments (levels, curves, exposure, hue/saturation, black & white, photo filter...) as pixels or adjustment layers, Camera Raw, 122 filters, remove background, selections (subject, sky, colour, rectangle, ellipse), fills, text, shapes, fill layers, placed images, layer styles, mode / bit depth, any engine command |
| `create_image` | New image of any size and background with the same operations: gradients, shapes, text, photos, logos, layer styles — PNG / JPEG / WebP plus an editable PSD or `.pcraft` |
| `remove_background` | Cut out the subject: transparent PNG / WebP, trimmed, on a new colour, or PSD with the editable mask; batches too |
| `convert_image` | Between PSD, PSB, TIFF (flat or layered), PNG, JPEG, WebP (lossy or lossless), GIF, BMP, TGA, ICO, QOI, PPM, OpenEXR, HDR and `.pcraft`; several formats at once, optional shrink to fit |
| `get_image_info` | Size, colour mode, bit depth, resolution, layer tree (text and font, shapes, masks, styles), layer comps, import warnings |
| `render_preview` | Any image or layered document as a PNG shown to Claude (and saved if you want) |
| `list_photo_catalog` | 817 commands, filters, adjustments, layer styles, style and shape presets, formats — with their parameters |
| `run_photo_commands` | Any engine commands in one session (`$steps[N].layer` references), headless or in the live app |
| `open_in_photocraft` | Open images in the PhotoCraft app (optionally with the control channel) |
| `get_photocraft_status` | Platform, installation, version, commands, app / control port |

| | |
| --- | --- |
| **Reads** | PSD, PSB, `.pcraft`, TIFF, PNG, JPEG, WebP, GIF, BMP, TGA, ICO, QOI, PNM, OpenEXR, HDR, SVG, HEIC / HEIF (iPhone), Affinity (`.af`, `.afphoto`, `.afdesign`, `.afpub`) |
| **Writes** | PSD, PSB, `.pcraft` (layered), TIFF (flat or layered), PNG, JPEG, WebP, GIF, BMP, TGA, ICO (≤ 256 px), QOI, PPM, OpenEXR, HDR |
| **Filters** | blur (Gaussian, motion, radial, surface, lens, tilt-shift, iris...), sharpen (unsharp mask, smart sharpen), noise, distort, pixelate, stylize, render (clouds, lens flare, lighting), 47 artistic gallery filters, Camera Raw, liquify... |

Coordinates are **pixels from the top-left corner**. Adjustments and filters act on the active layer (the last one created) and on the selection, if any; they need a pixel layer, so apply them before adding text and shapes (or add `{"op": "flatten"}` first).

## Example

```json
{
  "input_path": "C:\\Photos\\beach.jpg",
  "operations": [
    { "op": "resize", "width": 1600 },
    { "op": "auto", "kind": "contrast" },
    { "op": "camera_raw", "params": { "vibrance": 25, "clarity": 15 } },
    { "op": "filter", "id": "sharpen.unsharpMask", "params": { "amount": 60, "radius": 1.2 } },
    { "op": "text", "text": "Summer 2026", "x": 800, "y": 1000, "size": 72, "color": "#ffffff", "align": "center", "effects": [ { "kind": "dropShadow", "distance": 6, "size": 10 } ] },
    { "op": "place_image", "path": "C:\\Brand\\logo.png", "x": 1380, "y": 40, "width": 180, "opacity": 70 }
  ],
  "formats": ["jpg", "psd"],
  "quality": 88
}
```

## Requirements

- **PhotoCraft** with `photocraft-cli` (tested with **0.5.0**); see [Platforms](#platforms)
- Node.js ≥ 20 (bundled with Claude Desktop for `.mcpb` installs)

## Installation

### Claude Desktop (recommended, all platforms)

1. Download `photocraft-mcp-server.mcpb` from the [latest release](https://github.com/jhonsu01/photocraft-mcp-server/releases/latest).
2. Double-click it (or drag it into Claude Desktop → *Settings → Extensions*) and click **Install**.
3. Optional: if PhotoCraft is not in a standard location, fill in its folder or the `photocraft-cli` path in the extension settings.

### Codex (OpenAI)

**Recommended — the marketplace (gets updates):** *Plugins → Add → Add marketplace*, source `jhonsu01/craft-marketplace`, reference `main`, then install **PhotoCraft Bridge** from **Craft Bridges** ([craft-marketplace](https://github.com/jhonsu01/craft-marketplace)). New versions arrive by refreshing the marketplace. Or upload the zip (Codex then keeps it in your account and refuses a newer zip with the same name):

1. Download `photocraft-mcp-server-<version>-codex.zip` from the [latest release](https://github.com/jhonsu01/photocraft-mcp-server/releases/latest).
2. In Codex: *Plugins → Add → New plugin*, choose the zip and click **Add plugin**.
3. Codex starts the server with `node`, so Node.js ≥ 20 must be on `PATH`. If PhotoCraft is not in a standard location, set `PHOTOCRAFT_DIR` or `PHOTOCRAFT_CLI` as system environment variables (Codex has no settings form for local plugins).

### Claude Code / other MCP clients

```bash
git clone https://github.com/jhonsu01/photocraft-mcp-server.git
cd photocraft-mcp-server
npm install
npm run build
```

Windows:

```bash
claude mcp add photocraft -- node "%CD%\dist\bundle.cjs"
```

macOS / Linux:

```bash
claude mcp add photocraft -- node "$PWD/dist/bundle.cjs"
```

## Configuration

| Variable | Meaning |
| --- | --- |
| `PHOTOCRAFT_DIR` | PhotoCraft folder, one of its executables, a `.tar.gz` root (with `bin/`) or `PhotoCraft.app`. Default: auto-detect |
| `PHOTOCRAFT_CLI` | Path of `photocraft-cli` / `photocraft-cli.exe` (wins over `PHOTOCRAFT_DIR`) |
| `PHOTOCRAFT_APP` | Path of the desktop app when it lives elsewhere (e.g. a Linux AppImage) |
| `PHOTOCRAFT_CONTROL_PORT` | Control port of the desktop app (default 7878) |
| `PHOTOCRAFT_MCP_TIMEOUT` | Maximum seconds per engine call (default 3600) |

## Safety

- Files are **never overwritten** unless `overwrite: true`: a free name (`_2`) is used in folders and an existing `output_path` is an error. Inputs are never modified: the engine works on private copies.
- All paths must be absolute. The engine runs headless and never edits an open PhotoCraft window unless `live: true`. Engine commands that read or write files by raw path (`file.open`, `file.placeEmbedded`, batch...) are refused by PhotoCraft itself; the tools of this server do the file work.
- Everything runs locally with no network access. Each job uses a private engine in a temporary folder that is deleted at the end. The live-app token lives in `%APPDATA%\photocraft-mcp-server` (Windows), `~/Library/Application Support/photocraft-mcp-server` (macOS) or `~/.config/photocraft-mcp-server` (Linux).

## Development

```bash
npm run build       # TypeScript + single-file bundle (dist/bundle.cjs)
npm test            # unit tests (Windows, macOS and Linux path logic)
npm run test:e2e    # 24 end-to-end checks over real MCP stdio (synthetic images)
npm run pack:mcpb   # photocraft-mcp-server.mcpb
npm run pack:codex  # Codex plugin zip
```

Linux test in Docker (unpack `photocraft-<version>-linux-x86_64.tar.gz` first):

```bash
docker run --rm -v "$PWD:/work:ro" -v "/path/to/photocraft-0.5.0-linux-x86_64:/opt/photocraft:ro" -w /work node:22-bookworm bash -c "apt-get update && apt-get install -y libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 fontconfig && node scripts/e2e.mjs"
```

## License

Apache-2.0. PhotoCraft is © its authors (Storytold), MIT or Apache-2.0.
This project is not affiliated with or endorsed by PhotoCraft or Storytold. Photoshop is a trademark of Adobe.

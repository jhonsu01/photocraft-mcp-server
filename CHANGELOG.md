# Changelog

## [1.0.2] - 2026-10-13
### Added
- Every result that names output files now carries `files_markdown`: ready-made links (percent-encoded `file:///`
  URLs) to each file and folder written, and the server instructions ask the assistant to show them as given. Paths
  with spaces, accents or parentheses no longer break the links, so agent apps (Codex, SunsamCode, Claude...) can
  open every output from the chat, also when a tool writes many files.
### Verified
- Windows 11 and Debian 12 (Docker): 24/24 end-to-end checks each (new: every `files_markdown` link is a valid
  `file:///` URL to an existing output); the `.mcpb` and the Codex plugin tested unpacked.

## [1.0.1] - 2026-10-10
### Added
- Codex (OpenAI) plugin: each release also ships `photocraft-mcp-server-<version>-codex.zip` with
  `.codex-plugin/plugin.json` and `.mcp.json` (a local stdio server, `node ./dist/bundle.cjs`), built by
  `npm run pack:codex` from the same bundle and manifest as the `.mcpb`. The plugin is also listed in the
  [Craft Bridges](https://github.com/jhonsu01/craft-marketplace) Codex marketplace, which delivers updates.
### Fixed
- Output names keep their dots: `create_image` with `name: "banner-1.0.1"` now writes `banner-1.0.1.png`
  (before, the `.1` was taken for an extension). A real image extension in the name is still dropped.
- Claude Desktop settings: the PhotoCraft folder hint shows `C:\Program Files\PhotoCraft` (the backslashes were
  missing).
### Verified
- Windows 11 and Debian 12 (Docker): all end-to-end checks pass; the `.mcpb` and the Codex plugin tested
  unpacked; the plugin installed from the marketplace with the Codex CLI and a tool call answered.

## [1.0.0] - 2026-10-09
### Added
- MCP server on PhotoCraft's own engine (`photocraft-cli mcp`): one private, headless engine per job. The engine only
  reads and writes inside its automation roots, so each job gets a temporary exchange folder: inputs are copied in,
  results are saved there and moved to their destination. Originals are never opened in place.
- 10 tools: `edit_image`, `create_image`, `remove_background`, `convert_image`, `get_image_info`, `render_preview`,
  `list_photo_catalog`, `run_photo_commands`, `open_in_photocraft`, `get_photocraft_status`.
- One operation list shared by `edit_image` and `create_image`: resize (size, %, fit), crop, canvas, rotate, flip,
  trim, auto tone / contrast / colour, 21 adjustments as pixels or adjustment layers, Camera Raw, 122 filters (short
  names such as `watercolor` resolve to `filter.gallery.watercolor`), remove background, selections, fills, text,
  shapes with gradients and strokes, fill layers, placed images scaled into an exact box, layer styles, mode and bit
  depth, and any engine command.
- Batches: one image, a list or a whole folder in a single engine session.
- Live app: `open_in_photocraft control=true` starts PhotoCraft with its authenticated, loopback-only control channel
  (token and exchange folder in the connector's own per-user folder) and `run_photo_commands live=true` drives it.
- Never overwrites: a free `_2` name in folders, an error for an existing `output_path` unless `overwrite: true`.
- Windows, macOS and Linux install detection (MSI, portable zip, DMG + CLI zip, deb, rpm, tar.gz, AppImage via
  `PHOTOCRAFT_APP`, PATH).
- README in 9 languages.
### Verified
- Windows 11 and Debian 12 (Docker, headless): 22/22 end-to-end checks each, with synthetic images.
- Live mode on Windows 11: the app opened a file, ran a command from the connector and exported the result.

# Changelog

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

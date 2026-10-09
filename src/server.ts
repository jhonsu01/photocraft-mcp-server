import { readFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAdvancedTools } from './tools/advanced.js';
import { registerImageTools } from './tools/image.js';

/** serverInfo.version comes from package.json (reachable as ../package.json from dist/ and src/). */
export function readPackageVersion(): string {
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(path.resolve(dir, '../package.json'), 'utf-8')) as { version?: unknown };
    if (typeof pkg.version === 'string' && pkg.version) return pkg.version;
  } catch {
    // package.json not shipped next to the bundle: still start
  }
  return '0.0.0-unknown';
}

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'photocraft-mcp-server', version: readPackageVersion() },
    {
      instructions:
        'Edits photos and images with the engine of the locally installed PhotoCraft (Windows, macOS, Linux), an open-source ' +
        'Photoshop-class editor: resize, crop, rotate, adjustments and Camera Raw, 122 filters, remove backgrounds, text, shapes, ' +
        'placed images and layer styles, new designs, and conversion between PSD, PSB, TIFF, PNG, JPEG, WebP, EXR, HEIC (read) and ' +
        'more, for one file or whole folders. Coordinates are pixels from the top-left. All paths must be absolute; files are never ' +
        'overwritten unless overwrite is true; inputs are never modified. The engine runs headless and never touches an open PhotoCraft ' +
        'window unless live=true. list_photo_catalog lists the 817 commands, filters, adjustments and styles; run_photo_commands runs any of them.',
    },
  );
  registerImageTools(server);
  registerAdvancedTools(server);
  return server;
}

import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { cleanEnv, connectorDir, resolveInstall, resolveInt } from '../../src/config.js';
import { resolveOutputPath, sameFile } from '../../src/paths.js';
import { substitute } from '../../src/tools/advanced.js';
import { collectInputs, defaultFormat, formatOfPath } from '../../src/tools/common.js';
import { filterId, operationSchema } from '../../src/tools/image.js';

describe('config', () => {
  it('treats unfilled MCPB placeholders as unset', () => {
    expect(cleanEnv('${user_config.photocraft_dir}')).toBeUndefined();
    expect(resolveInt('${user_config.control_port}', 7878, 65535)).toBe(7878);
  });
  it('Windows: install folder, an .exe inside it, or nothing', () => {
    const exists = (p: string) => /^D:\\PC\\photocraft(-cli)?\.exe$/i.test(p);
    const r = resolveInstall({ PHOTOCRAFT_DIR: 'D:\\PC' }, exists, 'win32', 'C:\\Users\\u');
    expect([r.cli, r.app]).toEqual(['D:\\PC\\photocraft-cli.exe', 'D:\\PC\\photocraft.exe']);
    expect(resolveInstall({ PHOTOCRAFT_DIR: 'D:\\PC\\photocraft.exe' }, exists, 'win32').cli).toBe('D:\\PC\\photocraft-cli.exe');
    const pf = (p: string) => p === 'C:\\Program Files\\PhotoCraft\\photocraft-cli.exe';
    expect(resolveInstall({ ProgramFiles: 'C:\\Program Files' }, pf, 'win32').cli).toBe('C:\\Program Files\\PhotoCraft\\photocraft-cli.exe');
  });
  it('Linux: deb/rpm, tar.gz root, PATH, AppImage app', () => {
    const deb = new Set(['/usr/bin/photocraft-cli', '/usr/bin/photocraft']);
    expect(Object.values(resolveInstall({}, (p) => deb.has(p), 'linux', '/home/u')).slice(2, 4)).toEqual(['/usr/bin/photocraft-cli', '/usr/bin/photocraft']);
    const tar = new Set(['/opt/x/photocraft-0.5.0-linux-x86_64/bin/photocraft-cli']);
    expect(resolveInstall({ PHOTOCRAFT_DIR: '/opt/x/photocraft-0.5.0-linux-x86_64' }, (p) => tar.has(p), 'linux', '/home/u').cli).toBe('/opt/x/photocraft-0.5.0-linux-x86_64/bin/photocraft-cli');
    const onPath = new Set(['/srv/photocraft-cli']);
    expect(resolveInstall({ PATH: '/usr/sbin:/srv' }, (p) => onPath.has(p), 'linux', '/home/u').cli).toBe('/srv/photocraft-cli');
    const img = '/home/u/photocraft-0.5.0-linux-x86_64.AppImage';
    expect(resolveInstall({ PHOTOCRAFT_APP: img }, (p) => p === img, 'linux', '/home/u').app).toBe(img);
  });
  it('macOS: PhotoCraft.app plus the separate CLI zip', () => {
    const files = new Set(['/Applications/PhotoCraft.app/Contents/MacOS/PhotoCraft', '/usr/local/bin/photocraft-cli']);
    const r = resolveInstall({}, (p) => files.has(p), 'darwin', '/Users/u');
    expect([r.cli, r.app]).toEqual(['/usr/local/bin/photocraft-cli', '/Applications/PhotoCraft.app/Contents/MacOS/PhotoCraft']);
  });
  it('keeps its own files in the per-user config folder', () => {
    expect(connectorDir({ APPDATA: 'C:\\Users\\u\\AppData\\Roaming' }, 'win32', 'C:\\Users\\u')).toBe('C:\\Users\\u\\AppData\\Roaming\\photocraft-mcp-server');
    expect(connectorDir({}, 'darwin', '/Users/u')).toBe('/Users/u/Library/Application Support/photocraft-mcp-server');
    expect(connectorDir({}, 'linux', '/home/u')).toBe('/home/u/.config/photocraft-mcp-server');
  });
});

describe('paths and formats', () => {
  it('never overwrites, POSIX case-sensitive', () => {
    const exists = (p: string) => p === 'D:\\a\\foto.png';
    expect(resolveOutputPath({ inputPath: 'D:\\a\\foto.jpg', ext: 'png', exists, platform: 'win32' })).toEqual({ path: 'D:\\a\\foto_2.png' });
    expect(resolveOutputPath({ inputPath: 'D:\\a\\foto.png', ext: 'png', platform: 'win32', exists: () => false })).toEqual({ path: 'D:\\a\\foto_2.png' });
    expect(resolveOutputPath({ inputPath: '/a/foto.png', ext: 'png', outputPath: '/a/out.jpg', platform: 'linux' })).toHaveProperty('error');
    expect(sameFile('/a/A.png', '/a/a.png', 'linux')).toBe(false);
  });
  it('maps extensions to writable formats', () => {
    expect(formatOfPath('x.JPEG')).toBe('jpg');
    expect(formatOfPath('x.tif')).toBe('tiff');
    expect(formatOfPath('x.psb')).toBe('psb');
    expect(formatOfPath('x.heic')).toBeUndefined();
    expect(defaultFormat('C:\\f\\x.heic')).toBe('png');
    expect(defaultFormat('C:\\f\\x.PSD')).toBe('psd');
  });
  it('collects only images from a folder', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pc-unit-'));
    for (const f of ['b.png', 'a.JPG', 'c.psd', 'd.txt', 'e.mp4']) writeFileSync(join(dir, f), 'x');
    expect(collectInputs([], dir).map((p) => p.slice(dir.length + 1))).toEqual(['a.JPG', 'b.png', 'c.psd']);
    expect(() => collectInputs(['relative.png'])).toThrow(/absolute/);
  });
});

describe('operations', () => {
  it('resolves short filter names', () => {
    const known = ['filter.blur.gaussianBlur', 'filter.blur.motionBlur', 'filter.gallery.watercolor', 'filter.sharpen.sharpen', 'filter.sharpen.sharpenMore'];
    expect(filterId('blur.gaussianBlur', known)).toBe('filter.blur.gaussianBlur');
    expect(filterId('filter.blur.motionBlur', known)).toBe('filter.blur.motionBlur');
    expect(filterId('watercolor', known)).toBe('filter.gallery.watercolor');
    expect(() => filterId('glow', known)).toThrow(/Unknown filter/);
  });
  it('keeps the operation schema free of tuples', () => {
    expect(JSON.stringify(z.toJSONSchema(operationSchema))).not.toContain('prefixItems');
    expect(operationSchema.parse({ op: 'text', text: 'Hola', x: 10, y: 50 }).op).toBe('text');
  });
});

describe('run_photo_commands references', () => {
  it('replaces $steps values', () => {
    expect(substitute({ layer: '$steps[0].layer', ids: ['$steps[1].layers[1]'], x: '$x' }, [{ layer: 4 }, { layers: [7, 9] }])).toEqual({ layer: 4, ids: [9], x: '$x' });
    expect(() => substitute('$steps[3].layer', [])).toThrow();
  });
});

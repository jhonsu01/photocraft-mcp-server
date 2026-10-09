import { existsSync } from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * An unfilled MCPB user_config placeholder ("${user_config.x}") reaches the process
 * literally when the user left the field empty, so treat it as unset.
 */
export function cleanEnv(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim().replace(/^"(.*)"$/, '$1');
  if (!v || v.includes('${')) return undefined;
  return v;
}

export type Platform = 'win32' | 'darwin' | 'linux';

export function currentPlatform(): Platform {
  return process.platform === 'win32' || process.platform === 'darwin' ? process.platform : 'linux';
}

/** Path helpers of the given platform (lets the tests check every OS from any OS). */
export function pathFor(platform: Platform): path.PlatformPath {
  return platform === 'win32' ? path.win32 : path.posix;
}

export interface PhotoCraftInstall {
  platform: Platform;
  /** Where we looked first (PHOTOCRAFT_DIR or the platform default). */
  dir: string;
  cli: string | undefined;
  app: string | undefined;
  searched: string[];
}

/** Executable names of the headless CLI and the desktop app. */
export function exeNames(platform: Platform): { cli: string; app: string[] } {
  if (platform === 'win32') return { cli: 'photocraft-cli.exe', app: ['photocraft.exe'] };
  // macOS: the app binary inside PhotoCraft.app is "PhotoCraft"; Linux packages install "photocraft"
  return { cli: 'photocraft-cli', app: platform === 'darwin' ? ['PhotoCraft', 'photocraft'] : ['photocraft'] };
}

/** Folders PhotoCraft installs into on each OS (the official MSI, DMG, deb/rpm and tar.gz layouts). */
export function defaultDirs(platform: Platform, env: NodeJS.ProcessEnv, home = os.homedir()): string[] {
  const p = pathFor(platform);
  if (platform === 'win32') {
    const local = env['LOCALAPPDATA'] || p.join(home, 'AppData', 'Local');
    return [
      p.join(env['ProgramFiles'] || 'C:\\Program Files', 'PhotoCraft'),
      p.join(env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'PhotoCraft'),
      p.join(local, 'Programs', 'PhotoCraft'),
    ];
  }
  if (platform === 'darwin') {
    return [
      '/Applications/PhotoCraft.app/Contents/MacOS',
      p.join(home, 'Applications', 'PhotoCraft.app', 'Contents', 'MacOS'),
      '/usr/local/bin',
      '/opt/homebrew/bin',
      p.join(home, '.local', 'bin'),
      p.join(home, 'bin'),
    ];
  }
  return ['/usr/bin', '/usr/local/bin', '/opt/photocraft/bin', '/opt/photocraft', p.join(home, '.local', 'bin'), p.join(home, 'bin')];
}

/**
 * Find photocraft-cli and the desktop app.
 *  - PHOTOCRAFT_CLI: the CLI executable itself (wins).
 *  - PHOTOCRAFT_DIR: install folder, one of its executables, a tar.gz root (with bin/) or PhotoCraft.app.
 *  - PHOTOCRAFT_APP: the desktop app executable (e.g. an AppImage) when it lives elsewhere.
 *  - otherwise the platform's default folders, then PATH.
 */
export function resolveInstall(
  env: NodeJS.ProcessEnv = process.env,
  exists: (p: string) => boolean = existsSync,
  platform: Platform = currentPlatform(),
  home = os.homedir(),
): PhotoCraftInstall {
  const p = pathFor(platform);
  const names = exeNames(platform);
  const dirs: string[] = [];
  const fromEnv = cleanEnv(env['PHOTOCRAFT_DIR']);
  if (fromEnv) {
    let d = fromEnv;
    if (/\.app\/?$/i.test(d)) d = p.join(d, 'Contents', 'MacOS');
    else if (/\.(exe|appimage)$/i.test(d) || /(^|[\\/])(photocraft|photocraft-cli|PhotoCraft)$/.test(d)) d = p.dirname(d);
    dirs.push(d, p.join(d, 'bin'));
  }
  dirs.push(...defaultDirs(platform, env, home));
  const sep = platform === 'win32' ? ';' : ':';
  for (const d of (env['PATH'] || env['Path'] || '').split(sep)) if (d) dirs.push(d.replace(/"/g, ''));
  const searched = [...new Set(dirs)];

  const cliEnv = cleanEnv(env['PHOTOCRAFT_CLI']);
  const cli = [cliEnv, ...searched.map((d) => p.join(d, names.cli))].filter((x): x is string => !!x).find((x) => exists(x));

  const appEnv = cleanEnv(env['PHOTOCRAFT_APP']);
  const appDirs = [...(cli ? [p.dirname(cli)] : []), ...searched];
  if (platform === 'darwin') appDirs.unshift('/Applications/PhotoCraft.app/Contents/MacOS', p.join(home, 'Applications', 'PhotoCraft.app', 'Contents', 'MacOS'));
  const app = [appEnv, ...appDirs.flatMap((d) => names.app.map((n) => p.join(d, n)))]
    .filter((x): x is string => !!x)
    .find((x) => exists(x));

  return { platform, dir: searched[0], cli, app, searched };
}

/** Positive integer from an env var, otherwise the default. */
export function resolveInt(envValue: string | undefined, def: number, max = 86400): number {
  if (!envValue || !/^\d+$/.test(envValue.trim())) return def;
  const n = Number(envValue.trim());
  return n > 0 && n <= max ? n : def;
}

/** Longest single engine call (large filters, Content-Aware Fill or big PSDs can take a while). */
export const COMMAND_TIMEOUT_SEC = resolveInt(process.env['PHOTOCRAFT_MCP_TIMEOUT'], 3600);

/** Control port of the live PhotoCraft app (`photocraft --control PORT`). */
export const CONTROL_PORT = resolveInt(cleanEnv(process.env['PHOTOCRAFT_CONTROL_PORT']), 7878, 65535);

/**
 * Folder of this connector's own files (the control token for the live app and its exchange folder):
 * %APPDATA%\photocraft-mcp-server on Windows, ~/Library/Application Support/photocraft-mcp-server on macOS,
 * $XDG_CONFIG_HOME (or ~/.config)/photocraft-mcp-server on Linux.
 */
export function connectorDir(env: NodeJS.ProcessEnv = process.env, platform: Platform = currentPlatform(), home = os.homedir()): string {
  const p = pathFor(platform);
  if (platform === 'win32') return p.join(env['APPDATA'] || p.join(home, 'AppData', 'Roaming'), 'photocraft-mcp-server');
  if (platform === 'darwin') return p.join(home, 'Library', 'Application Support', 'photocraft-mcp-server');
  return p.join(env['XDG_CONFIG_HOME'] || p.join(home, '.config'), 'photocraft-mcp-server');
}

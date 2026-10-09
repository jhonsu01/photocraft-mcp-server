import { execFile, spawn } from 'child_process';
import { mkdirSync } from 'fs';
import * as net from 'net';
import * as path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { COMMAND_TIMEOUT_SEC, CONTROL_PORT, connectorDir, resolveInstall } from '../config.js';
import { Bridge, runCli, withSession } from '../engine.js';
import { READ, READABLE, WRITABLE, collectInputs, errorResult, formatOfPath, json, outputFor, preview, withPreview } from './common.js';
import { ADJUSTMENTS, LAYER_STYLES } from './image.js';

interface CommandDef {
  id: string;
  label: string;
  menu?: string[];
  params: string | null;
  shortcut?: string | null;
}

let commandCache: CommandDef[] | undefined;
async function engineCommands(): Promise<CommandDef[]> {
  if (!commandCache) commandCache = JSON.parse(await runCli(['commands', '--json'])) as CommandDef[];
  return commandCache;
}

export function controlPortOpen(port = CONTROL_PORT, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port });
    const done = (ok: boolean) => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs, () => done(false));
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
  });
}

function appRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      execFile('tasklist', ['/FI', 'IMAGENAME eq photocraft.exe', '/NH'], { windowsHide: true }, (err, out) => resolve(!err && /photocraft\.exe/i.test(out)));
    } else {
      // exact process name: never matches our own photocraft-cli engines
      execFile('pgrep', ['-xi', 'photocraft'], (err, out) => resolve(!err && out.trim().length > 0));
    }
  });
}

/** The live app's control channel as this connector starts it: token file and exchange folder of our own. */
export function liveBridge(): Bridge {
  const dir = connectorDir();
  return { address: `127.0.0.1:${CONTROL_PORT}`, tokenFile: path.join(dir, 'control.token'), root: path.join(dir, 'live') };
}

/**
 * Replace "$steps[N].path.to[0]" with a value returned by step N (0-based), e.g. "$steps[0].layer".
 */
export function substitute(value: unknown, steps: unknown[] = []): unknown {
  if (typeof value === 'string') {
    const st = /^\$steps\[(\d+)\]((?:\.[A-Za-z_]\w*|\[\d+\])*)$/.exec(value);
    if (st) {
      let cur: unknown = steps[Number(st[1])];
      for (const part of st[2].match(/\.[A-Za-z_]\w*|\[\d+\]/g) ?? []) {
        const key = part.startsWith('.') ? part.slice(1) : Number(part.slice(1, -1));
        cur = cur && typeof cur === 'object' ? (cur as Record<string | number, unknown>)[key] : undefined;
      }
      if (cur === undefined) throw new Error(`${value} is not available (step results so far: ${steps.length}).`);
      return cur;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => substitute(v, steps));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, steps)]));
  return value;
}

export function registerAdvancedTools(server: McpServer): void {
  server.registerTool(
    'list_photo_catalog',
    {
      title: 'List commands, filters, adjustments, styles, formats',
      description:
        'What PhotoCraft can do: commands (817 engine commands with their parameters, for run_photo_commands or op=command; filter by ' +
        'id / label / menu), filters (122, with parameters), adjustments (with parameters), layer_styles, style_presets, shape_presets ' +
        '(custom shapes), formats (readable and writable).',
      inputSchema: {
        kind: z.enum(['commands', 'filters', 'adjustments', 'layer_styles', 'style_presets', 'shape_presets', 'formats']),
        filter: z.string().optional().describe('Case-insensitive text to match.'),
      },
      annotations: READ,
    },
    async (args) => {
      try {
        const f = (args.filter ?? '').toLowerCase();
        const match = (...parts: unknown[]) => !f || parts.some((p) => String(p ?? '').toLowerCase().includes(f));
        if (args.kind === 'formats') return json({ success: true, readable: READABLE, writable: WRITABLE, layered: ['psd', 'psb', 'pcraft', 'tiff (tiff_layers)'] });
        const all = await engineCommands();
        const list = (pred: (c: CommandDef) => boolean, strip = '') => {
          const l = all.filter((c) => pred(c) && match(c.id, c.label, (c.menu ?? []).join(' ')));
          return { success: true, count: l.length, items: l.slice(0, 250).map((c) => ({ id: strip ? c.id.slice(strip.length) : c.id, label: c.label.replace(/…$/, ''), ...(strip ? {} : { menu: (c.menu ?? []).join(' › ') }), params: c.params })), truncated: l.length > 250 };
        };
        if (args.kind === 'commands') return json(list(() => true));
        if (args.kind === 'filters') return json(list((c) => c.id.startsWith('filter.') && c.id !== 'filter.lastFilter', 'filter.'));
        if (args.kind === 'adjustments') return json({ ...list((c) => (ADJUSTMENTS as readonly string[]).includes(c.id.replace('image.adjustments.', '')) && c.id.startsWith('image.adjustments.'), 'image.adjustments.'), auto: ['tone', 'contrast', 'color'] });
        if (args.kind === 'layer_styles') return json(list((c) => (LAYER_STYLES as readonly string[]).some((k) => c.id === `layer.layerStyle.${k}`), 'layer.layerStyle.'));
        return json(
          await withSession(async (s) => {
            await s.json('doc_new', { width: 64, height: 64 });
            const r = await s.cmd(args.kind === 'style_presets' ? 'style.presets.list' : 'shape.presets.list');
            const groups = ((r?.groups ?? []) as any[])
              .map((g) => ({ group: g.name, presets: ((args.kind === 'style_presets' ? g.presets : g.shapes) ?? []).map((p: any) => p.name).filter((n: string) => match(g.name, n)) }))
              .filter((g) => g.presets.length);
            return { success: true, groups };
          }),
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'run_photo_commands',
    {
      title: 'Run PhotoCraft engine commands',
      description:
        'Advanced: open an image (or start a new document) and run any of PhotoCraft\'s 817 engine commands in order in one session — ' +
        'layers, masks, selections, channels, paths, type styles, smart objects and warps, liquify, content-aware fill / scale, layer ' +
        'comps, actions... Parameters can use "$steps[N].layer" (or any other field) for a value returned by step N (0-based). Then ' +
        'save to the given files. Commands that read or write files by path (file.open, file.placeEmbedded, batch...) are refused by ' +
        'the engine: use the tools of this server for files. live=true runs them in the open PhotoCraft app instead (started with ' +
        'open_in_photocraft control=true).',
      inputSchema: {
        open_path: z.string().optional().describe('Absolute image to open first.'),
        new_document: z
          .object({ width: z.number().int().positive(), height: z.number().int().positive(), background: z.string().optional() })
          .optional()
          .describe('Start from a new document (default 1920 × 1080 white when neither open_path nor live).'),
        steps: z.array(z.object({ id: z.string(), params: z.record(z.string(), z.any()).optional() })).max(500).default([]),
        stop_on_error: z.boolean().default(true),
        exports: z
          .array(z.object({ path: z.string().describe('Absolute file; its extension picks the format.'), quality: z.number().int().min(1).max(100).optional(), tiff_layers: z.boolean().optional() }))
          .optional(),
        overwrite: z.boolean().default(false),
        preview: z.boolean().default(false),
        live: z.boolean().default(false).describe(`Drive the running PhotoCraft app (control port ${CONTROL_PORT}).`),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (args) => {
      try {
        if (args.open_path) collectInputs([args.open_path]);
        if (args.live && !(await controlPortOpen())) throw new Error(`PhotoCraft is not listening on port ${CONTROL_PORT}: call open_in_photocraft with control=true first.`);
        return await withSession(
          async (s) => {
            if (args.open_path) await s.openFile(args.open_path);
            else if (args.new_document || !args.live) await s.json('doc_new', { width: args.new_document?.width ?? 1920, height: args.new_document?.height ?? 1080, ...(args.new_document?.background ? { background: args.new_document.background } : {}) });
            const values: unknown[] = [];
            const results: Record<string, unknown>[] = [];
            let failed = 0;
            for (const step of args.steps) {
              try {
                const out = await s.cmd(step.id, substitute(step.params ?? {}, values) as Record<string, unknown>);
                values.push(out);
                results.push({ id: step.id, ok: true, result: out });
              } catch (e) {
                failed++;
                values.push(undefined);
                results.push({ id: step.id, ok: false, error: e instanceof Error ? e.message : String(e) });
                if (args.stop_on_error) break;
              }
            }
            const exported: Record<string, unknown>[] = [];
            if (failed === 0 || !args.stop_on_error) {
              for (const ex of args.exports ?? []) {
                const format = formatOfPath(ex.path);
                if (!format) throw new Error(`Can't write ${ex.path}: unknown extension.`);
                const out = outputFor(ex.path + '.__src', WRITABLE[format], '', { output_path: ex.path, overwrite: args.overwrite });
                exported.push({ ...(await s.saveTo(out, { quality: ex.quality, tiffLayers: ex.tiff_layers })), format });
              }
            }
            const body = { success: failed === 0, completed: results.length - failed, failed, results, ...(exported.length ? { exported } : {}) };
            return withPreview(body, args.preview ? await preview(s, 1024) : undefined, failed > 0);
          },
          args.live ? liveBridge() : undefined,
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'open_in_photocraft',
    {
      title: 'Open in PhotoCraft',
      description:
        'Open images in the PhotoCraft desktop app for manual editing. With control=true the app also starts its authenticated control ' +
        'channel (loopback only, token kept in this connector\'s folder) so run_photo_commands live=true can drive it.',
      inputSchema: {
        paths: z.array(z.string()).max(50).default([]).describe('Absolute paths of files PhotoCraft reads.'),
        control: z.boolean().default(false),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => {
      try {
        const files = args.paths.length ? collectInputs(args.paths) : [];
        const install = resolveInstall();
        if (!install.app) throw new Error('PhotoCraft desktop app not found. Set PHOTOCRAFT_DIR (or PHOTOCRAFT_APP for an AppImage).');
        let extra: string[] = [];
        if (args.control && !(await controlPortOpen())) {
          const b = liveBridge();
          mkdirSync(b.root, { recursive: true });
          extra = ['--control', String(CONTROL_PORT), '--control-token-file', b.tokenFile, '--automation-read-root', b.root, '--automation-write-root', b.root];
        }
        // run it from this connector's folder: GPU drivers drop log folders into the working directory
        const cwd = connectorDir();
        mkdirSync(cwd, { recursive: true });
        const child = spawn(install.app, [...extra, ...files], { cwd, detached: true, stdio: 'ignore', windowsHide: false });
        child.on('error', () => undefined);
        child.unref();
        return json({ success: true, app: install.app, opened: files, ...(extra.length ? { control_port: CONTROL_PORT } : {}) });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'get_photocraft_status',
    {
      title: 'PhotoCraft status',
      description: 'Check the PhotoCraft installation: platform, executables, version, number of engine commands, whether the app is running / listening for control, formats.',
      inputSchema: {},
      annotations: READ,
    },
    async () => {
      const install = resolveInstall();
      const status: Record<string, unknown> = {
        ready: !!install.cli,
        platform: `${install.platform} ${process.arch}`,
        install_dir: install.dir,
        cli: install.cli ?? null,
        app: install.app ?? null,
      };
      try {
        if (!install.cli) throw new Error(`photocraft-cli not found (searched ${install.searched.length} folders). Install PhotoCraft or set PHOTOCRAFT_DIR / PHOTOCRAFT_CLI.`);
        status['version'] = (await runCli(['--version'])).split('\n')[0].trim();
        status['commands'] = (await engineCommands()).length;
        status['app_running'] = await appRunning();
        status['control_port'] = CONTROL_PORT;
        status['control_listening'] = await controlPortOpen();
        status['readable'] = READABLE;
        status['writable'] = Object.keys(WRITABLE);
        status['timeout_sec'] = COMMAND_TIMEOUT_SEC;
        return json(status);
      } catch (e) {
        return json({ ...status, ready: false, error: e instanceof Error ? e.message : String(e) }, true);
      }
    },
  );
}

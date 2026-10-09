import { ChildProcessWithoutNullStreams, execFile, spawn } from 'child_process';
import { constants, copyFileSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, statSync, unlinkSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createInterface } from 'readline';
import { COMMAND_TIMEOUT_SEC, resolveInstall } from './config.js';

/** A PhotoCraft tool call the engine rejected (unknown command, bad parameters, file problems...). */
export class PhotoCraftToolError extends Error {
  constructor(
    public readonly tool: string,
    message: string,
  ) {
    super(`${tool}: ${message}`);
    this.name = 'PhotoCraftToolError';
  }
}

let running = 0;
/** Engine sessions still open (index.ts waits for them before exiting). */
export function pendingRuns(): number {
  return running;
}

export function requireCli(): string {
  const install = resolveInstall();
  if (!install.cli) {
    throw new Error(
      `photocraft-cli not found (looked in ${install.searched.slice(0, 6).join(', ')} and PATH). Install PhotoCraft ` +
        '(https://github.com/storytold/photocraft/releases; on macOS also the photocraft-cli zip) or set PHOTOCRAFT_DIR / PHOTOCRAFT_CLI.',
    );
  }
  return install.cli;
}

export interface ContentItem {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface ToolOutput {
  /** The tool's JSON result (structuredContent, or the parsed text). */
  value: any;
  content: ContentItem[];
}

interface RpcResponse {
  result?: { content?: ContentItem[]; structuredContent?: Record<string, any>; isError?: boolean };
  error?: { message: string };
}

interface Pending {
  resolve: (v: RpcResponse) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

/** Bridge to the running app: its control address, token file and the exchange folder it was started with. */
export interface Bridge {
  address: string;
  tokenFile: string;
  root: string;
}

/**
 * One PhotoCraft engine: `photocraft-cli mcp` over stdio. Documents stay open in it, so layer ids and the
 * active document carry over to the next calls. Calls are sent one at a time.
 *
 * The engine only reads and writes relative paths inside its automation roots, so each session has its own
 * exchange folder: inputs are copied in (stage), results are saved there and then moved to their real place
 * (saveTo). The folder is removed when the session closes; the user's files are never opened in place.
 */
export class PhotoCraftSession {
  private proc: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private stderr = '';
  private closed = false;
  private readonly ownRoot: boolean;
  readonly root: string;
  private readonly prefix: string;
  private staged = new Map<string, string>();
  private counter = 0;
  private queue: Promise<unknown> = Promise.resolve();

  private constructor(cli: string, bridge?: Bridge) {
    this.ownRoot = !bridge;
    this.root = bridge ? bridge.root : mkdtempSync(path.join(os.tmpdir(), 'pcmcp-'));
    // in the shared live folder every session works in its own subfolder
    this.prefix = bridge ? `s${process.pid}-${Date.now().toString(36)}` : '';
    mkdirSync(path.join(this.root, this.prefix), { recursive: true });
    const args = bridge
      ? ['mcp', '--bridge', bridge.address, '--control-token-file', bridge.tokenFile]
      : ['mcp', '--automation-read-root', this.root, '--automation-write-root', this.root];
    this.proc = spawn(cli, args, { cwd: this.root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    running++;
    this.proc.stderr.setEncoding('utf-8');
    this.proc.stderr.on('data', (d: string) => {
      this.stderr = (this.stderr + d).slice(-4000);
    });
    createInterface({ input: this.proc.stdout }).on('line', (line) => this.onLine(line));
    this.proc.on('error', (e) => this.failAll(e));
    this.proc.on('exit', (code) => this.failAll(new Error(`PhotoCraft engine exited (code ${code}). ${this.stderr.trim()}`.trim())));
  }

  static async open(bridge?: Bridge): Promise<PhotoCraftSession> {
    const s = new PhotoCraftSession(requireCli(), bridge);
    try {
      await s.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'photocraft-mcp-server', version: '1' } });
      s.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    } catch (e) {
      s.close();
      throw e;
    }
    return s;
  }

  private send(msg: unknown): void {
    this.proc.stdin.write(JSON.stringify(msg) + '\n');
  }

  private onLine(line: string): void {
    let msg: { id?: number } & RpcResponse;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (typeof msg.id !== 'number') return;
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    clearTimeout(p.timer);
    p.resolve(msg);
  }

  private failAll(e: Error): void {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(e);
    }
    this.pending.clear();
    this.finish();
  }

  private finish(): void {
    if (this.closed) return;
    this.closed = true;
    running--;
    // the live app may still hold its staged copies open: they are small and the next session's cleanup is not needed
    try {
      rmSync(this.ownRoot ? this.root : path.join(this.root, this.prefix), { recursive: true, force: true });
    } catch {
      // still locked: the OS temp cleanup takes it later
    }
  }

  private rpc(method: string, params: unknown, timeoutSec = COMMAND_TIMEOUT_SEC): Promise<RpcResponse> {
    const run = () =>
      new Promise<RpcResponse>((resolve, reject) => {
        if (this.closed) return reject(new Error('PhotoCraft engine is closed.'));
        const id = this.nextId++;
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`PhotoCraft engine timed out after ${timeoutSec} s (${method}).`));
        }, timeoutSec * 1000);
        this.pending.set(id, { resolve, reject, timer });
        this.send({ jsonrpc: '2.0', id, method, params });
      });
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** Call one of the engine's MCP tools (doc_open, doc_save, command_run, doc_inspect...). */
  async call(tool: string, args: Record<string, unknown> = {}): Promise<ToolOutput> {
    const r = await this.rpc('tools/call', { name: tool, arguments: args });
    if (r.error) throw new PhotoCraftToolError(tool, r.error.message);
    const result = r.result ?? {};
    const content = result.content ?? [];
    const text = content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n')
      .trim();
    if (result.isError) throw new PhotoCraftToolError(tool, text || 'failed');
    let value: any = result.structuredContent;
    if (value === undefined && text) {
      try {
        value = JSON.parse(text);
      } catch {
        value = { text };
      }
    }
    return { value: value ?? null, content };
  }

  /** The JSON result only. */
  async json<T = any>(tool: string, args: Record<string, unknown> = {}): Promise<T> {
    return (await this.call(tool, args)).value as T;
  }

  /** Run one engine command (see command_list) and return its JSON result (null for commands without one). */
  async cmd<T = any>(id: string, params: Record<string, unknown> = {}): Promise<T> {
    try {
      return await this.json<T>('command_run', { id, params });
    } catch (e) {
      if (e instanceof PhotoCraftToolError) throw new PhotoCraftToolError(id, e.message.replace(/^command_run: /, ''));
      throw e;
    }
  }

  private rel(name: string): string {
    return this.prefix ? `${this.prefix}/${name}` : name;
  }

  /** Copy a file into the exchange folder (once per path) and return the engine-relative path. */
  stage(file: string): string {
    const known = this.staged.get(file);
    if (known) return known;
    const dir = this.rel(`in${++this.counter}`);
    mkdirSync(path.join(this.root, dir), { recursive: true });
    const rel = `${dir}/${path.basename(file)}`;
    copyFileSync(file, path.join(this.root, rel), constants.COPYFILE_FICLONE);
    this.staged.set(file, rel);
    return rel;
  }

  /** Open a file (staged copy) and make it the active document. */
  async openFile(file: string): Promise<{ index: number; width: number; height: number; layers: number; name: string; warnings: string[] }> {
    return this.json('doc_open', { path: this.stage(file) });
  }

  /**
   * Save the active (or given) document as `target` (its extension picks the format): written in the exchange
   * folder, then moved. Callers check `target` against overwriting first.
   */
  async saveTo(target: string, opts: { quality?: number; tiffLayers?: boolean; index?: number } = {}): Promise<{ path: string; bytes: number; warnings: string[] }> {
    const ext = path.extname(target).slice(1).toLowerCase() || 'png';
    const rel = this.rel(`out${++this.counter}.${ext}`);
    const r = await this.json('doc_save', {
      path: rel,
      ...(opts.quality ? { quality: opts.quality } : {}),
      ...(opts.tiffLayers ? { tiffLayers: true } : {}),
      ...(opts.index !== undefined ? { index: opts.index } : {}),
    });
    mkdirSync(path.dirname(target), { recursive: true });
    moveFile(path.join(this.root, rel), target);
    return { path: target, bytes: statSync(target).size, warnings: r?.warnings ?? [] };
  }

  close(): void {
    if (this.closed) return;
    try {
      this.proc.stdin.end();
    } catch {
      // already gone
    }
    const p = this.proc;
    setTimeout(() => {
      if (p.exitCode === null) p.kill();
    }, 2000).unref();
    this.finish();
  }
}

/** Rename, or copy + delete across drives; replaces an existing target (callers check overwrite first). */
export function moveFile(src: string, dst: string): void {
  if (existsSync(dst)) unlinkSync(dst);
  try {
    renameSync(src, dst);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e;
    copyFileSync(src, dst);
    unlinkSync(src);
  }
}

/** Open a session, run fn, always close. */
export async function withSession<T>(fn: (s: PhotoCraftSession) => Promise<T>, bridge?: Bridge): Promise<T> {
  const s = await PhotoCraftSession.open(bridge);
  try {
    return await fn(s);
  } finally {
    s.close();
  }
}

/** One-shot CLI call (--version, commands): stdout as text. */
export function runCli(args: string[], timeoutSec = 120): Promise<string> {
  const cli = requireCli();
  return new Promise((resolve, reject) => {
    const cwd = mkdtempSync(path.join(os.tmpdir(), 'pcmcp-'));
    execFile(
      cli,
      args,
      { cwd, windowsHide: true, timeout: timeoutSec * 1000, maxBuffer: 64 * 1024 * 1024, encoding: 'utf-8' },
      (err, stdout, stderr) => {
        try {
          rmSync(cwd, { recursive: true, force: true });
        } catch {
          // ignore
        }
        if (err) reject(new Error(`photocraft-cli ${args[0]}: ${(stderr || stdout || err.message).toString().trim()}`));
        else resolve(stdout);
      },
    );
  });
}

import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { PhotoCraftSession } from '../engine.js';
import { resolveOutputPath, stemOf } from '../paths.js';
import { withFileLinks } from '../links.js';

export type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string };
export type ToolResult = { content: Content[]; isError?: boolean };

export function json(obj: unknown, isError = false): ToolResult {
  const out: ToolResult = { content: [{ type: 'text', text: JSON.stringify(withFileLinks(obj), null, 2) }] };
  if (isError) out.isError = true;
  return out;
}

export function errorResult(e: unknown): ToolResult {
  return json({ success: false, error: e instanceof Error ? e.message : String(e) }, true);
}

export const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;
export const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

// ---------------------------------------------------------------- formats

/** What PhotoCraft opens (README › Formats; HEIC and Affinity read-only). */
export const READABLE = [
  'pcraft', 'psd', 'psb', 'png', 'jpg', 'jpeg', 'jpe', 'tif', 'tiff', 'webp', 'gif', 'bmp', 'tga', 'ico', 'qoi',
  'pbm', 'pgm', 'ppm', 'pnm', 'pam', 'exr', 'hdr', 'svg', 'heic', 'heif', 'af', 'afdesign', 'afphoto', 'afpub',
];

/** What it writes: format id → file extension. */
export const WRITABLE = {
  png: 'png',
  jpg: 'jpg',
  webp: 'webp',
  tiff: 'tif',
  gif: 'gif',
  bmp: 'bmp',
  tga: 'tga',
  ico: 'ico',
  qoi: 'qoi',
  ppm: 'ppm',
  exr: 'exr',
  hdr: 'hdr',
  psd: 'psd',
  psb: 'psb',
  pcraft: 'pcraft',
} as const;
export type WritableFormat = keyof typeof WRITABLE;
export const WRITABLE_IDS = Object.keys(WRITABLE) as [WritableFormat, ...WritableFormat[]];
/** Formats that keep layers, masks, text and effects. */
export const LAYERED: WritableFormat[] = ['psd', 'psb', 'pcraft'];

export const formatsSchema = z
  .array(z.enum(WRITABLE_IDS))
  .min(1)
  .max(12)
  .describe(
    'Output formats: png, jpg, webp, tiff, gif, bmp, tga, ico (max 256 px), qoi, ppm, exr, hdr (flat), psd, psb, pcraft (layered, editable). ' +
      'Default: the input format when PhotoCraft can write it, else png.',
  );

// ---------------------------------------------------------------- schemas

/** Plain arrays only: some model APIs reject JSON Schema tuples. */
export const colorSchema = z.string().describe('"#rrggbb".');

export const inputsSchema = {
  input_path: z.string().optional().describe('Absolute path of one image.'),
  input_paths: z.array(z.string()).max(1000).optional().describe('Absolute paths of several images.'),
  input_dir: z.string().optional().describe('Absolute folder: every image directly inside it (non-recursive).'),
};

export const saveOptionsSchema = {
  quality: z.number().int().min(1).max(100).optional().describe('JPEG / WebP quality (a WebP without quality is lossless).'),
  tiff_layers: z.boolean().optional().describe('TIFF: keep the layers (default flat).'),
  overwrite: z.boolean().default(false).describe('Replace existing output files.'),
};

// ---------------------------------------------------------------- inputs

/** Absolute, existing files from explicit paths plus every image directly inside dir. */
export function collectInputs(paths: string[], dir?: string, exts = READABLE): string[] {
  const out: string[] = [];
  for (const p of paths) {
    if (!path.isAbsolute(p)) throw new Error(`Paths must be absolute: ${p}`);
    if (!existsSync(p) || !statSync(p).isFile()) throw new Error(`File not found: ${p}`);
    out.push(p);
  }
  if (dir) {
    if (!path.isAbsolute(dir)) throw new Error(`input_dir must be an absolute path: ${dir}`);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`Folder not found: ${dir}`);
    for (const name of readdirSync(dir).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
      const full = path.join(dir, name);
      if (exts.includes(path.extname(name).slice(1).toLowerCase()) && statSync(full).isFile()) out.push(full);
    }
  }
  if (out.length === 0) throw new Error('No input files: give input_path, input_paths or input_dir.');
  return out;
}

export function inputsOf(a: { input_path?: string; input_paths?: string[]; input_dir?: string }, exts = READABLE): string[] {
  return collectInputs([...(a.input_path ? [a.input_path] : []), ...(a.input_paths ?? [])], a.input_dir, exts);
}

/** Decide where a result goes (never overwriting unless asked). */
export function outputFor(
  input: string,
  ext: string,
  suffix: string,
  o: { output_path?: string; output_dir?: string; overwrite?: boolean },
): string {
  if (o.output_dir) mkdirSync(o.output_dir, { recursive: true });
  const r = resolveOutputPath({ inputPath: input, ext, suffix, outputPath: o.output_path, outputDir: o.output_dir, overwrite: o.overwrite });
  if ('error' in r) throw new Error(r.error);
  mkdirSync(path.dirname(r.path), { recursive: true });
  return r.path;
}

/** The format a path's extension asks for. */
export function formatOfPath(p: string): WritableFormat | undefined {
  const e = path.extname(p).slice(1).toLowerCase();
  const map: Record<string, WritableFormat> = { jpeg: 'jpg', jpe: 'jpg', tif: 'tiff', pnm: 'ppm' };
  const f = (map[e] ?? e) as WritableFormat;
  return f in WRITABLE ? f : undefined;
}

/** Default output format for an input: its own when writable (flat formats stay flat), else png. */
export function defaultFormat(input: string | undefined): WritableFormat {
  return (input && formatOfPath(input)) || 'png';
}

// ---------------------------------------------------------------- engine helpers

export interface SaveOpts {
  quality?: number;
  tiff_layers?: boolean;
}

export interface Saved {
  path: string;
  format: string;
  bytes: number;
  warnings: string[];
}

/** A file name given by the user: kept as is (dots included), except a trailing image extension. */
export function nameStem(name: string): string {
  const exts = new Set<string>([...Object.values(WRITABLE), 'tiff', 'jpeg']);
  const m = /\.([^.\\/]+)$/.exec(name);
  return m && exts.has(m[1].toLowerCase()) ? name.slice(0, -m[0].length) : name;
}

/**
 * Save the active document once per format: output_path for the format matching its extension,
 * the others as <output_dir or input folder>/<stem><suffix>.<ext>, never replacing anything.
 */
export async function saveAll(
  s: PhotoCraftSession,
  base: { input: string; suffix: string; output_dir?: string; output_path?: string; overwrite?: boolean },
  formats: WritableFormat[],
  o: SaveOpts,
): Promise<Saved[]> {
  const out: Saved[] = [];
  const named = base.output_path ? formatOfPath(base.output_path) : undefined;
  if (base.output_path && !named) throw new Error(`output_path has an extension PhotoCraft can't write: ${base.output_path}`);
  for (const f of formats) {
    const target =
      named === f
        ? outputFor(base.output_path + '.__src', WRITABLE[f], '', { output_path: base.output_path, overwrite: base.overwrite })
        : outputFor(base.output_path ? path.join(path.dirname(base.output_path), stemOf(base.output_path) + '.__src') : base.input, WRITABLE[f], base.output_path ? '' : base.suffix, {
            output_dir: base.output_dir ?? (base.output_path ? path.dirname(base.output_path) : undefined),
            overwrite: base.overwrite,
          });
    const r = await s.saveTo(target, { quality: o.quality, tiffLayers: f === 'tiff' && o.tiff_layers });
    out.push({ ...r, format: f });
  }
  return out;
}

/** PNG preview of the active document, returned as an MCP image. */
export async function preview(s: PhotoCraftSession, maxSide = 1024): Promise<{ data: string; mimeType: string } | undefined> {
  const r = await s.call('doc_render_preview', { max_side: Math.min(2048, Math.max(64, Math.round(maxSide))) });
  const img = r.content.find((c) => c.type === 'image');
  return img?.data ? { data: img.data, mimeType: img.mimeType ?? 'image/png' } : undefined;
}

export function withPreview(body: unknown, img: { data: string; mimeType: string } | undefined, isError = false): ToolResult {
  const res = json(body, isError);
  if (img) res.content.push({ type: 'image', ...img });
  return res;
}

/** Layer tree of doc_inspect, trimmed to what a caller needs. */
export function summarizeLayers(layers: any[] | undefined): any[] {
  return (layers ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    kind: l.kind,
    visible: l.visible,
    opacity: l.opacity,
    blend: l.blend,
    bounds: l.bounds,
    ...(l.text ? { text: l.text } : {}),
    ...(l.hasMask ? { mask: true } : {}),
    ...(l.effects?.items?.length ? { effects: l.effects.items.map((e: any) => e.kind) } : {}),
    ...(l.children?.length ? { children: summarizeLayers(l.children) } : {}),
  }));
}

export { stemOf };

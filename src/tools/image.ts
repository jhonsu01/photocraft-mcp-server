import { statSync, writeFileSync } from 'fs';
import * as path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PhotoCraftSession, withSession } from '../engine.js';
import {
  LAYERED, READ, WRITABLE, WRITE, WritableFormat, collectInputs, colorSchema, defaultFormat, errorResult, formatsSchema, inputsOf,
  inputsSchema, json, nameStem, outputFor, preview, saveAll, saveOptionsSchema, Saved, summarizeLayers, withPreview,
} from './common.js';

// ---------------------------------------------------------------- operations

/** Adjustments: image.adjustments.<kind>; the first 16 also exist as adjustment layers (as_layer). */
export const ADJUSTMENTS = [
  'brightnessContrast', 'levels', 'curves', 'exposure', 'vibrance', 'hueSaturation', 'colorBalance', 'blackWhite', 'photoFilter',
  'channelMixer', 'invert', 'posterize', 'threshold', 'gradientMap', 'selectiveColor', 'colorLookup',
  'desaturate', 'equalize', 'shadowsHighlights', 'replaceColor', 'hdrToning',
] as const;
const LAYER_ADJUSTMENTS = new Set<string>(ADJUSTMENTS.slice(0, 16));

export const LAYER_STYLES = ['dropShadow', 'innerShadow', 'outerGlow', 'innerGlow', 'stroke', 'colorOverlay', 'gradientOverlay', 'patternOverlay', 'bevelEmboss', 'satin'] as const;

const OPS = [
  'resize', 'crop', 'canvas', 'rotate', 'flip', 'trim', 'auto', 'adjust', 'camera_raw', 'filter', 'remove_background', 'select', 'fill',
  'text', 'shape', 'fill_layer', 'place_image', 'style', 'flatten', 'mode', 'command',
] as const;

const effectSchema = z.object({
  kind: z.enum(LAYER_STYLES),
  color: z.string().optional(),
  opacity: z.number().min(0).max(100).optional().describe('0-100.'),
  size: z.number().min(0).optional().describe('Blur size / stroke width in px.'),
  distance: z.number().min(0).optional(),
  angle: z.number().optional(),
  spread: z.number().min(0).max(100).optional(),
  position: z.enum(['outside', 'inside', 'center']).optional().describe('stroke.'),
  colors: z.array(z.string()).min(2).max(2).optional().describe('gradientOverlay / stroke gradient: [from, to].'),
  params: z.record(z.string(), z.any()).optional().describe('Any other layer.layerStyle.<kind> parameter (list_photo_catalog kind=layer_styles).'),
});

export const operationSchema = z.object({
  op: z.enum(OPS).describe(
    'resize (width/height/percent, fit), crop (x,y,width,height), canvas (width,height,anchor,color), rotate (angle 90/180/270), ' +
      'flip (direction), trim, auto (kind tone|contrast|color), adjust (kind + params, as_layer), camera_raw (params: exposure, contrast, ' +
      'highlights, shadows, whites, blacks, temperature, tint, texture, clarity, dehaze, vibrance, saturation...), filter (id e.g. ' +
      'blur.gaussianBlur, sharpen.unsharpMask, gallery.watercolor + params), remove_background, select (kind subject|sky|all|none|inverse|' +
      'rect|ellipse|color), fill (color into the selection), text, shape, fill_layer (color or gradient), place_image (path), style ' +
      '(effects on the active layer), flatten, mode (to, bits), command (any engine id + params).',
  ),
  // geometry
  x: z.number().optional().describe('px from the left (text: start of the baseline; align center: its centre).'),
  y: z.number().optional().describe('px from the top (text: baseline).'),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  x2: z.number().optional().describe('line: end x.'),
  y2: z.number().optional().describe('line: end y.'),
  percent: z.number().positive().max(1000).optional().describe('resize: scale in %.'),
  fit: z.boolean().optional().describe('resize: fit inside width × height keeping the aspect ratio (never enlarges unless enlarge).'),
  enlarge: z.boolean().optional(),
  resample: z.enum(['bicubic', 'bilinear', 'nearest', 'lanczos', 'preserveDetails']).optional(),
  anchor: z.enum(['topLeft', 'top', 'topRight', 'left', 'center', 'right', 'bottomLeft', 'bottom', 'bottomRight']).optional(),
  angle: z.number().optional().describe('rotate: 90, 180, 270 (or -90).'),
  direction: z.enum(['horizontal', 'vertical']).optional(),
  // what / how
  kind: z.string().optional().describe('auto: tone|contrast|color. adjust: ' + ADJUSTMENTS.join(', ') + '. shape: rect|rounded_rect|ellipse|polygon|star|line. select: subject|sky|all|none|inverse|rect|ellipse|color. mode: see "to".'),
  id: z.string().optional().describe('filter: e.g. blur.gaussianBlur (list_photo_catalog kind=filters). command: any engine command id.'),
  params: z.record(z.string(), z.any()).optional().describe('Engine parameters of the adjustment / filter / camera_raw / command (list_photo_catalog shows them).'),
  as_layer: z.boolean().optional().describe('adjust: add an editable adjustment layer instead of changing pixels.'),
  refine: z.boolean().optional().describe('remove_background: refine the edge (default true).'),
  trim: z.boolean().optional().describe('remove_background: crop to the subject.'),
  to: z.enum(['rgb', 'grayscale', 'cmyk', 'lab', 'indexed', 'bitmap']).optional().describe('mode.'),
  bits: z.union([z.literal(8), z.literal(16), z.literal(32)]).optional().describe('mode: bit depth.'),
  feather: z.number().min(0).optional().describe('select rect/ellipse: feather px.'),
  fuzziness: z.number().min(0).max(200).optional().describe('select color.'),
  // content
  text: z.string().optional(),
  size: z.number().positive().optional().describe('text: font size in pt (= px at 72 ppi).'),
  font: z.string().optional().describe('text: font family, e.g. Arial, Georgia.'),
  align: z.enum(['left', 'center', 'right', 'justify']).optional(),
  color: colorSchema.optional().describe('text / fill / fill_layer / canvas colour ("transparent" for canvas).'),
  fill: z.string().optional().describe('shape fill "#rrggbb" or "none".'),
  gradient: z
    .object({
      colors: z.array(z.string()).min(2).max(16),
      angle: z.number().optional(),
      style: z.enum(['linear', 'radial', 'angle', 'reflected', 'diamond']).optional(),
    })
    .optional()
    .describe('shape / fill_layer gradient, colours evenly spaced.'),
  stroke_color: z.string().optional(),
  stroke_width: z.number().min(0).optional(),
  radius: z.number().min(0).optional().describe('rounded_rect corner radius.'),
  sides: z.number().int().min(3).max(100).optional().describe('polygon / star points.'),
  star_ratio: z.number().min(0).max(1).optional(),
  path: z.string().optional().describe('place_image: absolute path of the image to place.'),
  // layer
  name: z.string().optional().describe('Layer name.'),
  opacity: z.number().min(0).max(100).optional().describe('Layer opacity 0-100.'),
  blend: z.string().optional().describe('Layer blend mode: normal, multiply, screen, overlay, softLight...'),
  effects: z.array(effectSchema).max(10).optional().describe('Layer styles for the new layer (or the active layer with op=style).'),
});
export type Operation = z.infer<typeof operationSchema>;

export interface OpContext {
  /** Index of the document being edited. */
  doc: number;
  /** Files whose paths were placed (for errors). */
  log: string[];
}

function need(o: Operation, ...keys: (keyof Operation)[]): void {
  const missing = keys.filter((k) => o[k] === undefined);
  if (missing.length) throw new Error(`${o.op} needs ${missing.join(', ')}.`);
}

/** Size of the active document. */
async function docSize(s: PhotoCraftSession): Promise<{ width: number; height: number }> {
  const d = await s.json('doc_inspect', {});
  return { width: d.width, height: d.height };
}

/** Layer opacity / blend / name and layer styles on a layer just created. */
async function finishLayer(s: PhotoCraftSession, layer: number | undefined, o: Operation): Promise<void> {
  if (layer === undefined) return;
  const props: Record<string, unknown> = {};
  if (o.name) props['name'] = o.name;
  if (o.opacity !== undefined) props['opacity'] = o.opacity / 100;
  if (o.blend) props['blend'] = o.blend.charAt(0).toUpperCase() + o.blend.slice(1);
  if (Object.keys(props).length) await s.cmd('layer.setProps', { layer, ...props });
  await applyEffects(s, layer, o.effects);
}

export async function applyEffects(s: PhotoCraftSession, layer: number | undefined, effects: Operation['effects']): Promise<void> {
  for (const e of effects ?? []) {
    const p: Record<string, unknown> = { ...(layer !== undefined ? { layer } : {}) };
    if (e.color) p['color'] = e.color;
    if (e.opacity !== undefined) p['opacity'] = e.opacity;
    if (e.size !== undefined) p['size'] = e.size;
    if (e.distance !== undefined) p['distance'] = e.distance;
    if (e.angle !== undefined) p['angle'] = e.angle;
    if (e.spread !== undefined) p['spread'] = e.spread;
    if (e.position) p['position'] = e.position;
    if (e.colors) Object.assign(p, { from: e.colors[0], to: e.colors[1] });
    await s.cmd(`layer.layerStyle.${e.kind}`, { ...p, ...(e.params ?? {}) });
  }
}

function gradientFill(g: NonNullable<Operation['gradient']>): Record<string, unknown> {
  const n = g.colors.length - 1;
  return { gradient: { stops: g.colors.map((c, i) => [i / n, c]), angle: g.angle ?? 90, style: g.style ?? 'linear' } };
}

/** "blur.gaussianBlur", "filter.blur.gaussianBlur" or just "gaussianBlur" → the engine id. */
export function filterId(id: string, known: string[]): string {
  const full = id.startsWith('filter.') ? id : `filter.${id}`;
  if (known.includes(full)) return full;
  const short = known.filter((k) => k.toLowerCase().endsWith('.' + id.toLowerCase()) && k.startsWith('filter.'));
  if (short.length === 1) return short[0];
  throw new Error(`Unknown filter "${id}" (list_photo_catalog kind=filters).${short.length ? ' Did you mean ' + short.join(', ') + '?' : ''}`);
}

let filterIds: string[] | undefined;
async function knownFilters(s: PhotoCraftSession): Promise<string[]> {
  if (!filterIds) {
    const r = await s.json('command_list', { filter: 'filter.' });
    filterIds = ((Array.isArray(r) ? r : r?.commands) ?? []).map((c: any) => c.id).filter((i: string) => i.startsWith('filter.'));
  }
  return filterIds!;
}

/** Apply one operation to the active document (ctx.doc). */
export async function applyOp(s: PhotoCraftSession, o: Operation, ctx: OpContext): Promise<unknown> {
  switch (o.op) {
    case 'resize': {
      const cur = await docSize(s);
      let w: number;
      let h: number;
      if (o.percent) {
        w = (cur.width * o.percent) / 100;
        h = (cur.height * o.percent) / 100;
      } else if (o.fit) {
        need(o, 'width', 'height');
        let k = Math.min(o.width! / cur.width, o.height! / cur.height);
        if (!o.enlarge) k = Math.min(k, 1);
        w = cur.width * k;
        h = cur.height * k;
      } else if (o.width && o.height) {
        w = o.width;
        h = o.height;
      } else if (o.width) {
        w = o.width;
        h = (cur.height * o.width) / cur.width;
      } else if (o.height) {
        h = o.height;
        w = (cur.width * o.height) / cur.height;
      } else throw new Error('resize needs width, height or percent.');
      return s.cmd('image.imageSize', { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)), ...(o.resample ? { resample: o.resample } : {}) });
    }
    case 'crop':
      need(o, 'x', 'y', 'width', 'height');
      return s.cmd('image.crop', { x: Math.round(o.x!), y: Math.round(o.y!), width: Math.round(o.width!), height: Math.round(o.height!) });
    case 'canvas': {
      need(o, 'width', 'height');
      return s.cmd('image.canvasSize', {
        width: Math.round(o.width!),
        height: Math.round(o.height!),
        anchor: o.anchor ?? 'center',
        extensionColor: o.color ?? 'white',
      });
    }
    case 'rotate': {
      const a = (((o.angle ?? 90) % 360) + 360) % 360;
      const id = { 90: 'image.imageRotation.90cw', 180: 'image.imageRotation.180', 270: 'image.imageRotation.90ccw' }[a as 90 | 180 | 270];
      if (!id) throw new Error('rotate supports 90, 180 and 270 degrees (use command edit.transform for other angles).');
      return s.cmd(id);
    }
    case 'flip':
      return s.cmd(o.direction === 'vertical' ? 'image.imageRotation.flipCanvasVertical' : 'image.imageRotation.flipCanvasHorizontal');
    case 'trim':
      return s.cmd('image.trim', { basedOn: o.kind === 'topLeft' || o.kind === 'bottomRight' ? o.kind : 'transparent' });
    case 'auto': {
      const k = o.kind ?? 'tone';
      if (!['tone', 'contrast', 'color'].includes(k)) throw new Error('auto kind: tone, contrast or color.');
      return s.cmd(`image.auto${k.charAt(0).toUpperCase()}${k.slice(1)}`);
    }
    case 'adjust': {
      need(o, 'kind');
      if (!(ADJUSTMENTS as readonly string[]).includes(o.kind!)) throw new Error(`Unknown adjustment "${o.kind}": ${ADJUSTMENTS.join(', ')}.`);
      if (o.as_layer) {
        if (!LAYER_ADJUSTMENTS.has(o.kind!)) throw new Error(`${o.kind} has no adjustment layer; drop as_layer.`);
        const r = await s.cmd(`layer.newAdjustmentLayer.${o.kind}`, o.params ?? {});
        await finishLayer(s, r?.layer, o);
        return r;
      }
      return s.cmd(`image.adjustments.${o.kind}`, o.params ?? {});
    }
    case 'camera_raw':
      return s.cmd('filter.cameraRaw', o.params ?? {});
    case 'filter': {
      need(o, 'id');
      return s.cmd(filterId(o.id!, await knownFilters(s)), o.params ?? {});
    }
    case 'remove_background': {
      const r = await s.cmd('layer.removeBackground', { refine: o.refine ?? true });
      if (o.trim) {
        await s.cmd('layer.layerMask.apply', { layer: r?.layer });
        await s.cmd('image.trim', { basedOn: 'transparent' });
      }
      return r;
    }
    case 'select': {
      const k = o.kind ?? 'all';
      if (k === 'subject') return s.cmd('select.subject', o.params ?? {});
      if (k === 'sky') return s.cmd('select.sky', o.params ?? {});
      if (k === 'all') return s.cmd('select.all');
      if (k === 'none') return s.cmd('select.deselect');
      if (k === 'inverse') return s.cmd('select.inverse');
      if (k === 'rect' || k === 'ellipse') {
        need(o, 'x', 'y', 'width', 'height');
        return s.cmd('select.rect', { x: Math.round(o.x!), y: Math.round(o.y!), width: Math.round(o.width!), height: Math.round(o.height!), ellipse: k === 'ellipse', feather: o.feather ?? 0, ...(o.params ?? {}) });
      }
      if (k === 'color') {
        need(o, 'color');
        return s.cmd('select.colorRange', { select: 'sampledColors', color: o.color, fuzziness: o.fuzziness ?? 40, ...(o.params ?? {}) });
      }
      throw new Error('select kind: subject, sky, all, none, inverse, rect, ellipse or color.');
    }
    case 'fill':
      need(o, 'color');
      return s.cmd('edit.fill', { contents: 'color', color: o.color, ...(o.opacity !== undefined ? { opacity: o.opacity } : {}), ...(o.blend ? { mode: o.blend } : {}) });
    case 'text': {
      need(o, 'text', 'x', 'y');
      const p: Record<string, unknown> = { x: o.x, y: o.y, text: o.text, size: o.size ?? 36, color: o.color ?? '#000000' };
      if (o.font) p['font'] = o.font;
      if (o.align) p['align'] = o.align;
      if (o.width && o.height) p['box'] = [o.x, o.y, o.width, o.height];
      const r = await s.cmd('type.create', { ...p, ...(o.params ?? {}) });
      await finishLayer(s, r?.layer, o);
      return r;
    }
    case 'shape': {
      const kind = { rounded_rect: 'roundedRect', rect: 'rect', ellipse: 'ellipse', polygon: 'polygon', star: 'star', line: 'line' }[o.kind ?? 'rect'];
      if (!kind) throw new Error('shape kind: rect, rounded_rect, ellipse, polygon, star or line.');
      const p: Record<string, unknown> = { kind };
      if (kind === 'line') {
        need(o, 'x', 'y', 'x2', 'y2');
        Object.assign(p, { from: [o.x, o.y], to: [o.x2, o.y2], weight: o.stroke_width ?? 2 });
      } else {
        need(o, 'x', 'y', 'width', 'height');
        p['rect'] = [o.x, o.y, o.width, o.height];
      }
      if (o.radius !== undefined) p['radii'] = o.radius;
      if (o.sides) p['sides'] = o.sides;
      if (o.star_ratio !== undefined) p['starRatio'] = o.star_ratio;
      if (o.gradient) p['fill'] = gradientFill(o.gradient);
      else if (o.fill === 'none') p['fill'] = null;
      else p['fill'] = o.fill ?? o.color ?? (kind === 'line' ? o.stroke_color ?? '#000000' : '#000000');
      if (o.stroke_color && kind !== 'line') p['stroke'] = { width: o.stroke_width ?? 2, color: o.stroke_color };
      const r = await s.cmd('shape.create', { ...p, ...(o.params ?? {}) });
      await finishLayer(s, r?.layer, o);
      return { layer: r?.layer, bounds: r?.bounds, kind: r?.kind };
    }
    case 'fill_layer': {
      let r: any;
      if (o.gradient) {
        r = await s.cmd('layer.newFillLayer.gradient', { from: o.gradient.colors[0], to: o.gradient.colors[o.gradient.colors.length - 1], angle: o.gradient.angle ?? 90, style: o.gradient.style ?? 'linear' });
      } else {
        need(o, 'color');
        r = await s.cmd('layer.newFillLayer.solidColor', { color: o.color });
      }
      const layer = r?.layer ?? (await s.json('doc_inspect', {})).activeLayer;
      await finishLayer(s, layer, o);
      return { layer };
    }
    case 'place_image':
      return placeImage(s, o, ctx);
    case 'style': {
      const layer = (await s.json('doc_inspect', {})).activeLayer;
      await applyEffects(s, layer, o.effects);
      return { layer };
    }
    case 'flatten':
      return s.cmd('layer.flattenImage');
    case 'mode': {
      const out: unknown[] = [];
      if (o.to) out.push(await s.cmd(o.to === 'indexed' ? 'image.mode.indexedColor' : `image.mode.${o.to}`, o.params ?? {}));
      if (o.bits) out.push(await s.cmd(`image.mode.bits${o.bits}`));
      if (!out.length) throw new Error('mode needs "to" and/or "bits".');
      return out;
    }
    case 'command':
      need(o, 'id');
      return s.cmd(o.id!, o.params ?? {});
  }
}

/**
 * Place an image as a new layer: open it, flatten it, copy it into the document, then scale it into
 * x, y, width, height (one of width/height keeps the aspect ratio; none: centred, shrunk to fit).
 */
async function placeImage(s: PhotoCraftSession, o: Operation, ctx: OpContext): Promise<unknown> {
  need(o, 'path');
  const [file] = collectInputs([o.path!]);
  const canvas = await docSize(s);
  const src = await s.openFile(file);
  if (src.layers > 1) await s.cmd('layer.flattenImage');
  const copied = await s.cmd('layer.copyToDocument', { document: ctx.doc, source: src.index, center: true });
  await s.json('doc_close', { index: src.index });
  await s.json('doc_select', { index: ctx.doc });
  const layer: number = copied?.layers?.[0];
  ctx.log.push(file);

  const sw = src.width;
  const sh = src.height;
  let w = o.width;
  let h = o.height;
  if (w && !h) h = (sh * w) / sw;
  else if (h && !w) w = (sw * h) / sh;
  else if (!w && !h) {
    const k = Math.min(1, canvas.width / sw, canvas.height / sh);
    w = sw * k;
    h = sh * k;
  }
  const x = o.x ?? (canvas.width - w!) / 2;
  const y = o.y ?? (canvas.height - h!) / 2;
  const x0 = (canvas.width - sw) / 2;
  const y0 = (canvas.height - sh) / 2;
  const unchanged = Math.abs(w! - sw) < 0.5 && Math.abs(h! - sh) < 0.5 && Math.abs(x - x0) < 0.5 && Math.abs(y - y0) < 0.5;
  if (!unchanged) {
    // affine: scale (w/sw, h/sh) then move the source's top-left (x0, y0) to (x, y)
    const a = w! / sw;
    const d = h! / sh;
    await s.cmd('edit.transform', { layer, matrix: [a, 0, 0, d, x - a * x0, y - d * y0] });
  }
  await finishLayer(s, layer, o);
  return { layer, placed: path.basename(file), box: [Math.round(x), Math.round(y), Math.round(w!), Math.round(h!)] };
}

/** Run every operation; returns per-operation results. */
export async function applyOps(s: PhotoCraftSession, ops: Operation[], ctx: OpContext): Promise<{ op: string; result: unknown }[]> {
  const out: { op: string; result: unknown }[] = [];
  for (const [i, o] of ops.entries()) {
    try {
      out.push({ op: o.op, result: await applyOp(s, o, ctx) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const hint = /need a pixel layer/i.test(msg) ? ' Add {"op":"flatten"} (or command layer.rasterize.layer) before it, or apply it before adding text and shapes.' : '';
      throw new Error(`operation ${i + 1} (${o.op}): ${msg}${hint}`);
    }
  }
  return out;
}

/** Short summary of results (layer ids and the like), dropping null results. */
function brief(results: { op: string; result: unknown }[]): unknown[] {
  return results.map((r) => (r.result === null || r.result === undefined ? r.op : { op: r.op, result: r.result }));
}

// ---------------------------------------------------------------- tools

const outputSchema = {
  output_path: z.string().optional().describe('Absolute output file (single input; its extension must be one of formats).'),
  output_dir: z.string().optional().describe('Absolute output folder (default: next to each input).'),
};

export function registerImageTools(server: McpServer): void {
  server.registerTool(
    'get_image_info',
    {
      title: 'Image information',
      description:
        'Size, colour mode, bit depth, resolution, layer tree (type layers with their text and font, shapes, smart objects, masks, ' +
        'layer styles), layer comps and import warnings of an image or document (PSD, PSB, TIFF, PNG, JPEG, WebP, EXR, HEIC, ' +
        '.pcraft, Affinity...).',
      inputSchema: { input_path: z.string().describe('Absolute path.') },
      annotations: READ,
    },
    async (args) => {
      try {
        const [file] = collectInputs([args.input_path]);
        return json(
          await withSession(async (s) => {
            const opened = await s.openFile(file);
            const d = await s.json('doc_inspect', {});
            return {
              success: true,
              path: file,
              bytes: statSync(file).size,
              width: d.width,
              height: d.height,
              mode: d.mode,
              depth: d.depth,
              resolution: d.resolution,
              channels: d.channels?.alpha?.length ? { alpha: d.channels.alpha.map((c: any) => c.name) } : undefined,
              layer_count: opened.layers,
              layers: summarizeLayers(d.layers),
              layer_comps: d.layerComps?.length ? d.layerComps : undefined,
              warnings: opened.warnings,
            };
          }),
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'convert_image',
    {
      title: 'Convert images',
      description:
        'Convert images between formats — PSD, PSB, TIFF (flat or layered), PNG, JPEG, WebP (lossy or lossless), GIF, BMP, TGA, ICO, ' +
        'QOI, PPM, OpenEXR, Radiance HDR and the native .pcraft — one file, a list or a whole folder, several formats at once, ' +
        'optionally shrinking to max_width × max_height. Reads also HEIC, SVG and Affinity files.',
      inputSchema: {
        ...inputsSchema,
        formats: formatsSchema,
        max_width: z.number().int().positive().optional().describe('Shrink to fit (never enlarges).'),
        max_height: z.number().int().positive().optional(),
        flatten: z.boolean().default(false).describe('Merge the layers first (layered formats keep them otherwise).'),
        ...outputSchema,
        ...saveOptionsSchema,
      },
      annotations: WRITE,
    },
    async (args) => {
      try {
        const inputs = inputsOf(args);
        if (args.output_path && inputs.length > 1) throw new Error('output_path needs a single input; use output_dir.');
        return json(
          await withSession(async (s) => {
            const done: { input: string; outputs: Saved[] }[] = [];
            const errors: { input: string; error: string }[] = [];
            for (const input of inputs) {
              try {
                const opened = await s.openFile(input);
                if (args.max_width || args.max_height) {
                  await applyOp(s, { op: 'resize', fit: true, width: args.max_width ?? 1e6, height: args.max_height ?? 1e6 }, { doc: opened.index, log: [] });
                }
                if (args.flatten) await s.cmd('layer.flattenImage');
                const outputs = await saveAll(s, { input, suffix: '', output_dir: args.output_dir, output_path: args.output_path, overwrite: args.overwrite }, args.formats, args);
                done.push({ input, outputs });
                await s.json('doc_close', {});
              } catch (e) {
                errors.push({ input, error: e instanceof Error ? e.message : String(e) });
                await s.json('doc_close', {}).catch(() => undefined);
              }
            }
            return { success: errors.length === 0, converted: done.length, results: done, ...(errors.length ? { errors } : {}) };
          }),
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'edit_image',
    {
      title: 'Edit images',
      description:
        'Apply a list of operations, in order, to one image, a list or a whole folder, and save the results: resize, crop, canvas size, ' +
        'rotate, flip, trim, auto tone/contrast/colour, adjustments (levels, curves, exposure, hue/saturation, black & white, photo ' +
        'filter, colour balance, vibrance... as pixels or editable adjustment layers), Camera Raw, any of the 122 filters (blur, sharpen, ' +
        'noise, distort, stylize, artistic gallery...), remove background, selections (subject, sky, colour, rectangle), fills, text, ' +
        'shapes, fill layers, placed images (watermarks, logos), layer styles (drop shadow, stroke, glow, bevel...), mode and bit depth, ' +
        'or any engine command. Adjustments and filters act on the active layer (the last one created) and the selection, if any; ' +
        'they need a pixel layer, so put them before text / shapes or add a flatten first. ' +
        'Coordinates are pixels from the top-left. Saved next to each input as <name>_edit.<ext> unless output_dir / output_path.',
      inputSchema: {
        ...inputsSchema,
        operations: z.array(operationSchema).min(1).max(200),
        formats: formatsSchema.optional(),
        suffix: z.string().default('_edit').describe('Added to the file name when no output_path.'),
        ...outputSchema,
        ...saveOptionsSchema,
        preview: z.boolean().default(true).describe('Return a preview of the (first) result.'),
      },
      annotations: WRITE,
    },
    async (args) => {
      try {
        const inputs = inputsOf(args);
        if (args.output_path && inputs.length > 1) throw new Error('output_path needs a single input; use output_dir.');
        return await withSession(async (s) => {
          const done: { input: string; outputs: Saved[]; applied: unknown[] }[] = [];
          const errors: { input: string; error: string }[] = [];
          let img: { data: string; mimeType: string } | undefined;
          for (const input of inputs) {
            try {
              const opened = await s.openFile(input);
              const applied = brief(await applyOps(s, args.operations, { doc: opened.index, log: [] }));
              const formats = args.formats ?? [defaultFormat(input)];
              const outputs = await saveAll(s, { input, suffix: args.suffix, output_dir: args.output_dir, output_path: args.output_path, overwrite: args.overwrite }, formats, args);
              if (args.preview && !img) img = await preview(s, 1024);
              done.push({ input, outputs, applied });
              await s.json('doc_close', {});
            } catch (e) {
              errors.push({ input, error: e instanceof Error ? e.message : String(e) });
              await s.json('doc_close', {}).catch(() => undefined);
            }
          }
          const body = inputs.length === 1 && done.length === 1
            ? { success: true, input: done[0].input, applied: done[0].applied, outputs: done[0].outputs }
            : { success: errors.length === 0, edited: done.length, results: done.map((d) => ({ input: d.input, outputs: d.outputs })), ...(errors.length ? { errors } : {}) };
          return withPreview(body, img, done.length === 0);
        });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'create_image',
    {
      title: 'Create an image',
      description:
        'New image of any size: background colour, then the same operations as edit_image — fill and gradient layers, shapes ' +
        '(rectangle, rounded rectangle, ellipse, polygon, star, line), text with any installed font, placed photos and logos, layer ' +
        'styles, adjustments and filters — saved as PNG / JPEG / WebP and, to keep it editable, PSD or .pcraft. Use it for social posts, ' +
        'banners, thumbnails, covers, collages and mock-ups.',
      inputSchema: {
        name: z.string().default('image').describe('File name without extension.'),
        width: z.number().int().positive().max(30000).default(1920),
        height: z.number().int().positive().max(30000).default(1080),
        background: z.string().default('white').describe('white | black | transparent | #rrggbb.'),
        mode: z.enum(['rgb', 'gray', 'cmyk', 'lab']).optional(),
        depth: z.union([z.literal(8), z.literal(16), z.literal(32)]).optional(),
        resolution: z.number().positive().max(10000).optional().describe('ppi stored in the file (default 72).'),
        operations: z.array(operationSchema).max(300).default([]),
        formats: formatsSchema.default(['png']),
        output_dir: z.string().optional().describe('Absolute folder (required unless output_path).'),
        output_path: z.string().optional(),
        ...saveOptionsSchema,
        preview: z.boolean().default(true),
      },
      annotations: WRITE,
    },
    async (args) => {
      try {
        const dir = args.output_path ? path.dirname(args.output_path) : args.output_dir;
        if (!dir || !path.isAbsolute(dir)) throw new Error('Give an absolute output_dir or output_path.');
        return await withSession(async (s) => {
          const created = await s.json('doc_new', {
            width: args.width,
            height: args.height,
            background: args.background,
            name: args.name,
            ...(args.mode ? { mode: args.mode } : {}),
            ...(args.depth ? { depth: args.depth } : {}),
          });
          const doc: number = created?.document ?? 0;
          if (args.resolution) await s.cmd('image.imageSize', { resolution: args.resolution, resample: 'none' });
          const applied = brief(await applyOps(s, args.operations, { doc, log: [] }));
          const outputs = await saveAll(s, { input: path.join(dir, `${nameStem(args.name)}.__src`), suffix: '', output_dir: dir, output_path: args.output_path, overwrite: args.overwrite }, args.formats, args);
          const flat = args.formats.filter((f) => !LAYERED.includes(f));
          return withPreview(
            { success: true, size: [args.width, args.height], applied, outputs, ...(flat.length && !args.formats.some((f) => LAYERED.includes(f)) ? { note: 'Flat formats only: add psd or pcraft to keep the layers editable.' } : {}) },
            args.preview ? await preview(s, 1024) : undefined,
          );
        });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'remove_background',
    {
      title: 'Remove background',
      description:
        'Cut out the main subject of photos (Select Subject + refined layer mask) for one image, a list or a folder: transparent PNG / ' +
        'WebP by default, optionally cropped to the subject, on a new background colour, or as PSD / .pcraft keeping the editable mask.',
      inputSchema: {
        ...inputsSchema,
        formats: formatsSchema.default(['png']),
        trim: z.boolean().default(false).describe('Crop to the subject.'),
        background_color: z.string().optional().describe('Put the subject on this colour instead of transparency.'),
        refine: z.boolean().default(true).describe('Refine the edge (hair, soft edges).'),
        suffix: z.string().default('_nobg'),
        ...outputSchema,
        ...saveOptionsSchema,
        preview: z.boolean().default(true),
      },
      annotations: WRITE,
    },
    async (args) => {
      try {
        const inputs = inputsOf(args);
        if (args.output_path && inputs.length > 1) throw new Error('output_path needs a single input; use output_dir.');
        return await withSession(async (s) => {
          const done: { input: string; outputs: Saved[]; subject: unknown }[] = [];
          const errors: { input: string; error: string }[] = [];
          let img: { data: string; mimeType: string } | undefined;
          for (const input of inputs) {
            try {
              await s.openFile(input);
              const r = await s.cmd('layer.removeBackground', { refine: args.refine });
              const keepMask = args.formats.every((f) => LAYERED.includes(f)) && !args.trim;
              if (!keepMask) await s.cmd('layer.layerMask.apply', { layer: r?.layer });
              if (args.trim) await s.cmd('image.trim', { basedOn: 'transparent' });
              if (args.background_color) {
                const fill = await s.cmd('layer.newFillLayer.solidColor', { color: args.background_color });
                const id = fill?.layer ?? (await s.json('doc_inspect', {})).activeLayer;
                await s.cmd('layer.arrange.sendToBack', { layer: id });
              }
              const outputs = await saveAll(s, { input, suffix: args.suffix, output_dir: args.output_dir, output_path: args.output_path, overwrite: args.overwrite }, args.formats, args);
              if (args.preview && !img) img = await preview(s, 1024);
              done.push({ input, outputs, subject: r?.bounds });
              await s.json('doc_close', {});
            } catch (e) {
              errors.push({ input, error: e instanceof Error ? e.message : String(e) });
              await s.json('doc_close', {}).catch(() => undefined);
            }
          }
          return withPreview({ success: errors.length === 0, processed: done.length, results: done, ...(errors.length ? { errors } : {}) }, img, done.length === 0);
        });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'render_preview',
    {
      title: 'Preview an image',
      description: 'Render an image or layered document (PSD, .pcraft, TIFF, EXR, HEIC...) flattened to a PNG that Claude can see; optionally save it.',
      inputSchema: {
        input_path: z.string().describe('Absolute path.'),
        max_side: z.number().int().min(64).max(2048).default(1024),
        save: z.boolean().default(false).describe('Also write <name>_preview.png next to the input (or output_path).'),
        output_path: z.string().optional(),
        overwrite: z.boolean().default(false),
      },
      annotations: READ,
    },
    async (args) => {
      try {
        const [file] = collectInputs([args.input_path]);
        return await withSession(async (s) => {
          const opened = await s.openFile(file);
          const img = await preview(s, args.max_side);
          if (!img) throw new Error('PhotoCraft returned no preview.');
          let saved: string | undefined;
          if (args.save || args.output_path) {
            saved = outputFor(file, 'png', '_preview', { output_path: args.output_path, overwrite: args.overwrite });
            writeFileSync(saved, Buffer.from(img.data, 'base64'));
          }
          return withPreview({ success: true, input: file, size: [opened.width, opened.height], ...(saved ? { output: saved } : {}) }, img);
        });
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}

export { WRITABLE };
export type { WritableFormat };

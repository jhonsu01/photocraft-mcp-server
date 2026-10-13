// End-to-end test over real MCP stdio against dist/bundle.cjs (what the .mcpb runs).
// Needs PhotoCraft installed. Usage: npm run build && npm run test:e2e
// E2E_BUNDLE=<path to bundle.cjs> tests another build (e.g. the contents of an unpacked .mcpb).
// Draws its own synthetic PNGs (no personal files).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync, inflateSync } from 'zlib';

const out = mkdtempSync(join(tmpdir(), 'pc-e2e-'));
const src = join(out, 'Imágenes ñandú');
mkdirSync(src, { recursive: true });

// --- tiny PNG writer: white background, a red disc, a blue square, a yellow triangle
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(path, w, h, pixel) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
// a photo-like scene: sky-to-grass gradient with a round orange subject in the middle
const photo = join(src, 'foto.png');
png(photo, 640, 480, (x, y) => {
  const d = Math.hypot(x - 320, y - 250);
  if (d < 110) { const k = 1 - d / 220; return [Math.round(240 * k + 15), Math.round(140 * k), 30]; }
  return y < 300 ? [120 + (y >> 2), 170 + (y >> 3), 235] : [60, 140 + ((x * 7) % 30), 60];
});
const logo = join(src, 'logo.png');
png(logo, 300, 200, (x, y) => ((x - 150) ** 2 / 140 ** 2 + (y - 100) ** 2 / 90 ** 2 < 1 ? [20, 90, 200] : [255, 255, 255]));

const client = new Client({ name: 'e2e', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [process.env.E2E_BUNDLE || 'dist/bundle.cjs'] }));

let failed = 0;
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failed++; };
const LINKED = [];
const call = async (name, args) => {
  const res = await client.callTool({ name, arguments: args });
  const body = JSON.parse(res.content.find((c) => c.type === 'text').text);
  if (body && body.files_markdown) LINKED.push(body.files_markdown);
  if (res.isError) console.log('      ', JSON.stringify(body).slice(0, 400));
  return { ...body, _img: res.content.some((c) => c.type === 'image') };
};
const t0 = Date.now();

const { tools } = await client.listTools();
check(tools.length === 10, `10 tools exposed (${tools.map((t) => t.name).join(', ')})`);
check(!JSON.stringify(tools.map((t) => t.inputSchema)).includes('"items":['), 'no JSON Schema tuples in any input schema');

const st = await call('get_photocraft_status', {});
check(st.ready && /photocraft-cli \d/.test(st.version ?? '') && st.commands > 500, `status: ${st.version}, ${st.commands} commands, ${st.platform}`);

const info = await call('get_image_info', { input_path: photo });
check(info.success && info.width === 640 && info.height === 480 && info.layer_count === 1, `get_image_info: ${info.width}x${info.height}, ${info.mode}, ${info.depth}-bit`);

const conv = await call('convert_image', { input_dir: src, formats: ['jpg', 'webp', 'tiff'], output_dir: join(out, 'conv'), quality: 80, max_width: 320 });
check(conv.success && conv.converted === 2 && conv.results.every((r) => r.outputs.length === 3), 'convert_image: a folder to JPEG + WebP + TIFF, shrunk to 320 px');
const fotoConv = conv.results?.find((r) => /foto/.test(r.input));
const small = await call('get_image_info', { input_path: fotoConv?.outputs?.[0]?.path });
check(small.width === 320 && small.height === 240, `max_width keeps the aspect ratio (${small.width}x${small.height})`);

const again = await call('convert_image', { input_path: photo, formats: ['jpg'], output_dir: join(out, 'conv') });
const refused = await call('convert_image', { input_path: photo, formats: ['jpg'], output_path: fotoConv?.outputs?.[0]?.path });
check(again.success && /_2\.jpg$/.test(again.results?.[0]?.outputs?.[0]?.path ?? '') && !refused.success && /already exists/.test(JSON.stringify(refused)), 'never overwrites: a free name (_2) in a folder, an error for an existing output_path');

const ed = await call('edit_image', {
  input_path: photo,
  operations: [
    { op: 'auto', kind: 'contrast' },
    { op: 'adjust', kind: 'hueSaturation', params: { saturation: 30 } },
    { op: 'camera_raw', params: { exposure: 0.3, clarity: 20 } },
    { op: 'filter', id: 'unsharpMask', params: { amount: 80, radius: 1.5 } },
    { op: 'resize', width: 480 },
    { op: 'adjust', kind: 'curves', as_layer: true, params: { points: [[0, 0], [128, 150], [255, 255]] } },
    { op: 'text', text: 'Señal ñandú', x: 240, y: 330, size: 36, color: '#ffffff', align: 'center', effects: [{ kind: 'dropShadow', distance: 4, size: 6 }, { kind: 'stroke', size: 2, color: '#000000' }] },
    { op: 'place_image', path: logo, x: 400, y: 20, width: 60, opacity: 85 },
  ],
  formats: ['png', 'psd'],
  output_dir: join(out, 'edit'),
});
check(ed.success && ed.outputs?.length === 2 && ed._img, 'edit_image: auto, hue/sat, Camera Raw, unsharp mask, resize, curves layer, styled text, placed logo → PNG + PSD with preview');
const layers = await call('get_image_info', { input_path: ed.outputs?.find((o) => o.format === 'psd')?.path });
const kinds = (layers.layers ?? []).map((l) => l.kind);
const placed = (layers.layers ?? []).find((l) => l.kind === 'Pixel' && l.name !== 'Background');
const txt = (layers.layers ?? []).find((l) => l.kind === 'Type');
check(layers.width === 480 && kinds.includes('Type') && kinds.some((k) => /adjust|curves/i.test(k)) && txt?.effects?.length === 2, `PSD keeps editable layers: ${kinds.join(', ')}; text effects ${txt?.effects?.join(' + ')}`);
const b = placed?.bounds ?? [];
check(Math.abs(b[0] - 400) <= 2 && Math.abs(b[1] - 20) <= 2 && Math.abs(b[2] - 60) <= 2 && Math.abs(b[3] - 40) <= 2 && Math.abs((placed?.opacity ?? 0) - 0.85) < 0.01, `place_image lands in its box, aspect kept: [${b.join(', ')}], opacity ${placed?.opacity}`);

const batch = await call('edit_image', { input_dir: src, operations: [{ op: 'adjust', kind: 'blackWhite' }, { op: 'rotate', angle: 90 }], output_dir: join(out, 'bw'), formats: ['jpg'], preview: false });
const bwInfo = await call('get_image_info', { input_path: batch.results?.find((r) => /foto/.test(r.input))?.outputs?.[0]?.path });
check(batch.success && batch.edited === 2 && bwInfo.width === 480 && bwInfo.height === 640, 'edit_image batch: a whole folder to black & white, rotated 90°');

const nobg = await call('remove_background', { input_path: photo, trim: true, output_dir: join(out, 'nobg') });
const cutPath = nobg.results?.[0]?.outputs?.[0]?.path;
const cut = await call('get_image_info', { input_path: cutPath });
check(nobg.success && nobg._img && cut.width < 300 && cut.width > 150 && cut.height < 300, `remove_background trims to the subject (${cut.width}x${cut.height})`);
// first pixel of the first PNG row is stored unfiltered whatever the row filter: read its alpha
const pngBytes = readFileSync(cutPath);
const idat = [];
for (let o = 8; o < pngBytes.length; ) {
  const len = pngBytes.readUInt32BE(o);
  if (pngBytes.toString('latin1', o + 4, o + 8) === 'IDAT') idat.push(pngBytes.subarray(o + 8, o + 8 + len));
  o += len + 12;
}
const firstPixel = inflateSync(Buffer.concat(idat)).subarray(1, 5);
check(pngBytes[24] === 8 && pngBytes[25] === 6 && firstPixel[3] === 0, `the PNG has alpha and its corner is transparent (RGBA ${[...firstPixel].join(',')})`);
const onColor = await call('remove_background', { input_path: photo, background_color: '#00aa55', formats: ['jpg'], output_dir: join(out, 'nobg'), preview: false });
check(onColor.success && (onColor.results?.[0]?.outputs?.[0]?.path ?? '').endsWith('_nobg.jpg'), 'remove_background onto a new background colour');

const post = await call('create_image', {
  name: 'post ñ',
  width: 1080,
  height: 1080,
  background: '#0f172a',
  operations: [
    { op: 'fill_layer', gradient: { colors: ['#1e3a8a', '#7c3aed'], angle: 45 }, opacity: 80 },
    { op: 'shape', kind: 'rounded_rect', x: 90, y: 90, width: 900, height: 900, radius: 48, fill: 'none', stroke_color: '#f8fafc', stroke_width: 6 },
    { op: 'shape', kind: 'star', x: 440, y: 200, width: 200, height: 200, fill: '#facc15', effects: [{ kind: 'outerGlow', color: '#fde047', size: 30 }] },
    { op: 'shape', kind: 'line', x: 200, y: 700, x2: 880, y2: 700, stroke_width: 4, stroke_color: '#f8fafc' },
    { op: 'place_image', path: photo, x: 340, y: 430, width: 400 },
    { op: 'text', text: 'OFERTA', x: 540, y: 900, size: 120, color: '#ffffff', font: 'Arial', align: 'center', effects: [{ kind: 'dropShadow', distance: 8, size: 12 }] },
  ],
  formats: ['png', 'pcraft', 'webp'],
  output_dir: join(out, 'create'),
});
check(post.success && post.outputs?.length === 3 && post._img && existsSync(join(out, 'create', 'post ñ.pcraft')), 'create_image: gradient layer, shapes, glow, line, placed photo, styled text → PNG + .pcraft + WebP');
const postInfo = await call('get_image_info', { input_path: join(out, 'create', 'post ñ.pcraft') });
check(postInfo.layers?.length === 7, `the .pcraft keeps all 7 layers (${(postInfo.layers ?? []).map((l) => l.kind).join(', ')})`);

const pv = await call('render_preview', { input_path: join(out, 'create', 'post ñ.pcraft'), max_side: 300, save: true });
check(pv.success && pv._img && existsSync(pv.output ?? ''), 'render_preview: a .pcraft document to PNG');

const fl = await call('list_photo_catalog', { kind: 'filters' });
const ad = await call('list_photo_catalog', { kind: 'adjustments' });
const ls = await call('list_photo_catalog', { kind: 'layer_styles' });
const sp = await call('list_photo_catalog', { kind: 'style_presets' });
const cm = await call('list_photo_catalog', { kind: 'commands', filter: 'liquify' });
check(fl.count >= 100 && ad.count >= 20 && ls.count === 10 && sp.groups?.length >= 1 && cm.count >= 1, `catalog: ${fl.count} filters, ${ad.count} adjustments, ${ls.count} layer styles, ${sp.groups?.length} style groups`);

const rc = await call('run_photo_commands', {
  new_document: { width: 400, height: 300, background: '#ffffff' },
  steps: [
    { id: 'shape.create', params: { kind: 'ellipse', rect: [100, 50, 200, 200], fill: '#ef4444' } },
    { id: 'layer.duplicate', params: { layer: '$steps[0].layer' } },
    { id: 'layer.rasterize.layer', params: { layer: '$steps[1].layer' } },
    { id: 'filter.blur.gaussianBlur', params: { radius: 6 } },
  ],
  exports: [{ path: join(out, 'run', 'blur.png') }, { path: join(out, 'run', 'blur.psd') }],
  preview: true,
});
check(rc.success && rc.exported?.length === 2 && rc._img, 'run_photo_commands: shape, duplicate and rasterize with $steps, Gaussian blur, export PNG + PSD');
const bad = await call('run_photo_commands', { steps: [{ id: 'file.placeEmbedded', params: { path: photo } }] });
check(!bad.success && /ambient|disabled/.test(JSON.stringify(bad)), 'file commands with raw paths are refused by the engine');

const shapeBlur = await call('create_image', { name: 'x', width: 200, height: 200, operations: [{ op: 'shape', x: 10, y: 10, width: 50, height: 50 }, { op: 'filter', id: 'blur.gaussianBlur' }], output_dir: join(out, 'x') });
check(!shapeBlur.success && /flatten/.test(shapeBlur.error ?? ''), 'a filter on a shape layer explains how to fix it');

const dotted = await call('create_image', { name: 'banner-1.0.1', width: 120, height: 60, background: '#336699', formats: ['png', 'jpg'], output_dir: join(out, 'dots'), preview: false });
check(dotted.success && dotted.outputs?.every((o) => /banner-1\.0\.1\.(png|jpg)$/.test(o.path) && existsSync(o.path)), `create_image: dots in the name are kept (${dotted.outputs?.map((o) => o.path.split(/[\\/]/).pop()).join(', ')})`);

const relPath = await call('edit_image', { input_path: 'foto.png', operations: [{ op: 'flatten' }] });
check(!relPath.success && /absolute/.test(relPath.error ?? ''), 'relative paths are rejected');

// every result that names output files carries working links to them
const linkUrls = LINKED.flatMap((m) => [...m.matchAll(/\]\((file:\/\/\/[^)]+)\)/g)].map((x) => x[1]));
check(linkUrls.length > 0 && linkUrls.every((u) => !/[ ()]/.test(u) && existsSync(fileURLToPath(u))), `files_markdown: ${linkUrls.length} file:/// links in ${LINKED.length} results, all valid and existing`);

await client.close();
console.log(`\n${failed ? `${failed} FAILED` : 'ALL PASSED'} in ${((Date.now() - t0) / 1000).toFixed(1)} s · output in ${out}`);
process.exit(failed ? 1 : 0);

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import gifenc from 'gifenc';
import { renderMotionFrame } from './svg.mjs';
import { FRAME_COUNT, LOOP_DURATION_MS } from './motion.mjs';

const { GIFEncoder, applyPalette, quantize } = gifenc;
const PALETTE_COLORS = 255;
const GIF_TIME_UNIT_MS = 10;
const GIF_DISPOSAL_RETAIN = 1;
const SYSTEM_MONOSPACE_FONTS = [
  [
    join(process.env.WINDIR ?? 'C:/Windows', 'Fonts', 'consola.ttf'),
    'Consolas',
  ],
  [
    join(process.env.WINDIR ?? 'C:/Windows', 'Fonts', 'consolab.ttf'),
    'Consolas',
  ],
  ['/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 'DejaVu Sans Mono'],
  [
    '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf',
    'DejaVu Sans Mono',
  ],
  [
    '/usr/share/fonts/truetype/liberation2/LiberationMono-Regular.ttf',
    'Liberation Mono',
  ],
  ['/System/Library/Fonts/Menlo.ttc', 'Menlo'],
].filter(([path]) => existsSync(path));
const FONT_OPTIONS = {
  loadSystemFonts: SYSTEM_MONOSPACE_FONTS.length === 0,
  fontFiles: SYSTEM_MONOSPACE_FONTS.map(([path]) => path),
  ...(SYSTEM_MONOSPACE_FONTS.length
    ? { defaultFontFamily: SYSTEM_MONOSPACE_FONTS[0][1] }
    : {}),
};

export async function renderGifAssets(
  config,
  data,
  { frameRenderer = renderMotionFrame } = {},
) {
  if (config.animated !== true) {
    return {};
  }
  const encoders = new Map();
  for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
    const frames = frameRenderer(config, data, frame / FRAME_COUNT);
    const frameStart = Math.round(
      (frame * LOOP_DURATION_MS) / FRAME_COUNT / GIF_TIME_UNIT_MS,
    );
    const frameEnd = Math.round(
      ((frame + 1) * LOOP_DURATION_MS) / FRAME_COUNT / GIF_TIME_UNIT_MS,
    );
    const delay = (frameEnd - frameStart) * GIF_TIME_UNIT_MS;
    for (const [name, source] of Object.entries(frames)) {
      const image = new Resvg(source, {
        background: name.endsWith('-dark.svg') ? '#101315' : '#fbfcfa',
        font: FONT_OPTIONS,
      }).render();
      let state = encoders.get(name);
      if (!state) {
        state = {
          encoder: GIFEncoder(),
          palette: quantize(image.pixels, PALETTE_COLORS),
          width: image.width,
          height: image.height,
        };
        encoders.set(name, state);
      }
      if (image.width !== state.width || image.height !== state.height) {
        throw new Error('Animation frame dimensions changed.');
      }
      const pixels = applyPalette(image.pixels, state.palette);
      const delta = pixels.slice();
      if (state.previous) {
        for (let index = 0; index < pixels.length; index += 1) {
          if (pixels[index] === state.previous[index]) {
            delta[index] = state.palette.length;
          }
        }
      }
      state.encoder.writeFrame(delta, image.width, image.height, {
        palette: frame === 0 ? state.palette : undefined,
        delay,
        repeat: 0,
        transparent: frame > 0,
        transparentIndex: state.palette.length,
        dispose: GIF_DISPOSAL_RETAIN,
      });
      state.previous = pixels;
    }
  }
  return Object.fromEntries(
    [...encoders].map(([name, { encoder }]) => {
      encoder.finish();
      return [name.replace(/\.svg$/, '.gif'), Buffer.from(encoder.bytes())];
    }),
  );
}

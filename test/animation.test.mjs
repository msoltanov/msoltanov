import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectGif } from '../scripts/gif.mjs';

const frameRenderer = (config, data, progress) => ({
  'workshop-dark.svg': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#101315"/><rect x="${Math.floor(progress * 18)}" y="4" width="5" height="12" fill="#91d7bd"/></svg>`,
});

test('profiles without animation skip GIF rendering', async () => {
  const { renderGifAssets } = await import('../scripts/animation.mjs');
  assert.deepEqual(
    await renderGifAssets(
      {},
      {},
      { frameRenderer: () => assert.fail('must not render frames') },
    ),
    {},
  );
});

test('GIFs repeat forever with distinct frames and deterministic binary output', async () => {
  const { renderGifAssets } = await import('../scripts/animation.mjs');
  const assets = await renderGifAssets(
    { animated: true },
    {},
    { frameRenderer },
  );
  assert.deepEqual(Object.keys(assets), ['workshop-dark.gif']);
  assert.ok(Buffer.isBuffer(assets['workshop-dark.gif']));
  const decoded = inspectGif(assets['workshop-dark.gif']);
  assert.equal(decoded.width, 24);
  assert.equal(decoded.height, 24);
  assert.equal(decoded.loops, 0);
  assert.equal(decoded.frames.length, 288);
  assert.equal(decoded.duration, 24000);
  assert.ok(
    new Set(decoded.frames.map((frame) => frame.toString('hex'))).size > 1,
  );
  assert.deepEqual(
    assets,
    await renderGifAssets({ animated: true }, {}, { frameRenderer }),
  );
});

test('GIF delta frames preserve prior pixels and reserve transparency after the opaque first frame', async () => {
  const { renderGifAssets } = await import('../scripts/animation.mjs');
  const assets = await renderGifAssets(
    { animated: true },
    {},
    { frameRenderer },
  );
  const bytes = assets['workshop-dark.gif'];
  const controls = [];
  for (let index = 0; index < bytes.length - 7; index += 1) {
    if (
      bytes[index] === 0x21 &&
      bytes[index + 1] === 0xf9 &&
      bytes[index + 2] === 4 &&
      bytes[index + 7] === 0
    ) {
      controls.push(bytes[index + 3]);
    }
  }
  assert.equal(controls.length, 288);
  assert.equal(controls[0] & 1, 0);
  assert.ok(
    controls
      .slice(1)
      .every((control) => (control & 1) === 1 && ((control >> 2) & 7) === 1),
  );
});

test('malformed and truncated GIF data fail with a fixed error', async () => {
  const { inspectGif } = await import('../scripts/gif.mjs');
  const { renderGifAssets } = await import('../scripts/animation.mjs');
  const assets = await renderGifAssets(
    { animated: true },
    {},
    { frameRenderer },
  );
  const valid = assets['workshop-dark.gif'];
  const zeroWidth = Buffer.from(valid);
  zeroWidth.writeUInt16LE(0, 6);
  const badTrailer = Buffer.from(valid);
  badTrailer[badTrailer.length - 1] = 0;
  for (const malformed of [
    Buffer.alloc(0),
    Buffer.from('GIF89a'),
    valid.subarray(0, -1),
    valid.subarray(0, 100),
    zeroWidth,
    badTrailer,
    'GIF89a',
  ]) {
    assert.throws(() => inspectGif(malformed), {
      message: 'Invalid animated GIF.',
    });
  }
});

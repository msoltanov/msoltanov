import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { drawWinterDecorations } from '../scripts/winter.mjs';

function scene(phase) {
  const parts = [];
  drawWinterDecorations(
    {
      raw: (value) => parts.push(value),
      colors: { outline: '#0d1f18', copper: '#d7a278' },
    },
    phase,
    { accent: '#d1bd91' },
  );
  return `<svg xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}

function documentAt(phase) {
  return new DOMParser({
    onError: (level, message) => {
      throw new Error(`${level}: ${message}`);
    },
  }).parseFromString(scene(phase), 'image/svg+xml');
}

function motions(document, name) {
  return Array.from(document.getElementsByTagName('*')).filter(
    (node) => node.getAttribute('data-motion') === name,
  );
}

test('winter decorations include ornaments, satin ribbons and warm light effects without visible labels', () => {
  const document = documentAt(0.2);
  assert.equal(motions(document, 'winter-ornament').length, 9);
  assert.ok(motions(document, 'winter-light-chase').length >= 12);
  assert.equal(motions(document, 'winter-star-glow').length, 1);
  const ribbons = Array.from(document.getElementsByTagName('g')).filter(
    (node) => node.getAttribute('data-feature') === 'winter-ribbon',
  );
  assert.equal(ribbons.length, 1);
  assert.doesNotMatch(
    scene(0.2),
    /<text|<script|<animate|<foreignObject|\son[a-z]+\s*=|NaN|undefined/,
  );
});

test('winter decorations move independently and return to the same pose after a loop', () => {
  assert.equal(scene(0), scene(1));
  assert.equal(scene(0.25), scene(1.25));
  const first = documentAt(0);
  const later = documentAt(0.29);
  const ornaments = motions(first, 'winter-ornament');
  const changed = motions(later, 'winter-ornament');
  assert.notEqual(
    ornaments[0].getAttribute('transform'),
    changed[0].getAttribute('transform'),
  );
  assert.notEqual(
    ornaments[0].getAttribute('transform'),
    ornaments[1].getAttribute('transform'),
  );
  assert.notEqual(
    motions(first, 'winter-light-chase')[0].getAttribute('opacity'),
    motions(later, 'winter-light-chase')[0].getAttribute('opacity'),
  );
  assert.notEqual(
    motions(first, 'winter-star-glow')[0].getAttribute('opacity'),
    motions(later, 'winter-star-glow')[0].getAttribute('opacity'),
  );
});

test('winter ornament swings and light intensities remain bounded within the canopy', () => {
  for (const phase of [0, 0.12, 0.36, 0.6, 0.82, 0.999]) {
    const document = documentAt(phase);
    for (const ornament of motions(document, 'winter-ornament')) {
      const match = ornament
        .getAttribute('transform')
        .match(/^rotate\(([-\d.]+) ([\d.]+) ([\d.]+)\)$/);
      assert.ok(match);
      assert.ok(Math.abs(Number(match[1])) <= 6.5);
      assert.ok(Number(match[2]) >= 100 && Number(match[2]) <= 360);
      assert.ok(Number(match[3]) >= 150 && Number(match[3]) <= 390);
    }
    for (const light of motions(document, 'winter-light-chase')) {
      assert.ok(
        Number(light.getAttribute('cx')) >= 90 &&
          Number(light.getAttribute('cx')) <= 375,
      );
      assert.ok(
        Number(light.getAttribute('cy')) >= 80 &&
          Number(light.getAttribute('cy')) <= 412,
      );
      assert.ok(
        Number(light.getAttribute('opacity')) >= 0.22 &&
          Number(light.getAttribute('opacity')) <= 1,
      );
    }
    assert.ok(
      Number(
        motions(document, 'winter-star-glow')[0].getAttribute('opacity'),
      ) <= 0.24,
    );
  }
});

test('warm garland bulbs stay visible at phone size and chase within the first two seconds', () => {
  const first = documentAt(0);
  const later = documentAt(2 / 24);
  const lights = motions(first, 'winter-light-chase');
  const halos = motions(first, 'winter-light-glow');
  assert.equal(halos.length, lights.length);
  for (const [index, light] of lights.entries()) {
    const radius = Number(light.getAttribute('r'));
    assert.ok((radius * 2 * 0.56 * 280) / 480 >= 1.95);
    assert.equal(halos[index].getAttribute('cx'), light.getAttribute('cx'));
    assert.equal(halos[index].getAttribute('cy'), light.getAttribute('cy'));
    assert.ok(Number(halos[index].getAttribute('r')) >= 7);
  }
  assert.ok(
    Number(lights[0].getAttribute('opacity')) -
      Number(motions(later, 'winter-light-chase')[0].getAttribute('opacity')) >=
      0.5,
  );
  const opacities = (phase) =>
    motions(documentAt(phase), 'winter-light-chase').map((node) =>
      node.getAttribute('opacity'),
    );
  assert.deepEqual(opacities(0.13), opacities(0.13 + 8 / 24));
  assert.notDeepEqual(opacities(0), opacities(1 / 24));
});

test('the anchored star and branch twinkles pulse calmly through a seamless twelve-second cycle', () => {
  const first = documentAt(0);
  assert.equal(motions(first, 'winter-star-core').length, 1);
  assert.equal(motions(first, 'winter-twinkle').length, 4);
  const signature = (phase) =>
    ['winter-star-core', 'winter-star-glow', 'winter-twinkle'].flatMap((name) =>
      motions(documentAt(phase), name).map((node) => node.toString()),
    );
  assert.notDeepEqual(signature(0), signature(2 / 24));
  assert.deepEqual(signature(0.17), signature(0.17 + 12 / 24));
  for (let index = 0; index <= 48; index += 1) {
    const document = documentAt(index / 48);
    const core = motions(document, 'winter-star-core')[0];
    const halo = motions(document, 'winter-star-glow')[0];
    const circle = halo.getElementsByTagName('circle')[0];
    assert.ok(
      Number(core.getAttribute('opacity')) >= 0.55 &&
        Number(core.getAttribute('opacity')) <= 1,
    );
    assert.equal(circle.getAttribute('cx'), '234');
    assert.equal(circle.getAttribute('cy'), '95');
    assert.ok(
      Number(circle.getAttribute('r')) >= 16 &&
        Number(circle.getAttribute('r')) <= 21,
    );
    assert.ok(
      Number(halo.getAttribute('opacity')) >= 0.06 &&
        Number(halo.getAttribute('opacity')) <= 0.24,
    );
    for (const light of motions(document, 'winter-light-glow')) {
      assert.ok(
        Number(light.getAttribute('opacity')) >= 0.02 &&
          Number(light.getAttribute('opacity')) <= 0.2,
      );
    }
    for (const twinkle of motions(document, 'winter-twinkle')) {
      const [, x, y] = twinkle
        .getAttribute('transform')
        .match(/^translate\(([\d.]+) ([\d.]+)\)$/);
      assert.ok(Number(x) >= 150 && Number(x) <= 310);
      assert.ok(Number(y) >= 210 && Number(y) <= 390);
      assert.ok(
        Number(twinkle.getAttribute('opacity')) >= 0 &&
          Number(twinkle.getAttribute('opacity')) <= 0.85,
      );
    }
  }
  const ornamentTransforms = (phase) =>
    motions(documentAt(phase), 'winter-ornament').map((node) =>
      node.getAttribute('transform'),
    );
  assert.deepEqual(
    ornamentTransforms(0.17),
    ornamentTransforms(0.17 + 12 / 24),
  );
  assert.ok(
    motions(documentAt(0.125), 'winter-ornament').some(
      (node) =>
        Math.abs(
          Number(node.getAttribute('transform').match(/rotate\(([-\d.]+)/)[1]),
        ) >= 6,
    ),
  );
  assert.equal(scene(0), scene(1));
});

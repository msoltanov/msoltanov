import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { drawDeskLamp, drawNotebookSketch } from '../scripts/desk-details.mjs';

const COLORS = {
  raised: '#1e2528',
  muted: '#7d8f87',
  accent: '#91d7bd',
  copper: '#d7a278',
  coat: '#e9e4d8',
  outline: '#0d1f18',
};

function scene(phase = 0, state = 'on') {
  const parts = [];
  const surface = { raw: (value) => parts.push(value), colors: COLORS };
  drawDeskLamp(surface, phase, state);
  drawNotebookSketch(surface, phase);
  return `<svg xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}

function document(phase = 0, state = 'on') {
  return new DOMParser({
    onError: (level, message) => {
      throw new Error(`${level}: ${message}`);
    },
  }).parseFromString(scene(phase, state), 'image/svg+xml');
}

function motion(phase, name, state = 'on') {
  const node = Array.from(
    document(phase, state).getElementsByTagName('*'),
  ).find((item) => item.getAttribute('data-motion') === name);
  assert.ok(node, `Missing ${name}.`);
  return node;
}

test('the lamp switch removes the light while preserving the lamp hardware', () => {
  for (const state of ['on', 'off']) {
    const lamp = Array.from(
      document(0.35, state).getElementsByTagName('g'),
    ).find((node) => node.getAttribute('data-scene') === 'desk-lamp');
    assert.equal(lamp.getAttribute('data-lamp'), state);
    assert.ok(lamp.getElementsByTagName('path').length >= 3);
  }
  assert.ok(Number(motion(0.35, 'lamp-glow').getAttribute('opacity')) > 0.06);
  assert.equal(
    Number(motion(0.35, 'lamp-glow', 'off').getAttribute('opacity')),
    0,
  );
  const hardware = (state) =>
    Array.from(document(0.35, state).getElementsByTagName('path'))
      .find((node) => node.getAttribute('data-part') === 'lamp-arm')
      .getAttribute('d');
  assert.equal(hardware('on'), hardware('off'));
});

test('lamp light shifts gently without a discontinuity at the animation boundary', () => {
  assert.notEqual(
    motion(0.1, 'lamp-glow').getAttribute('opacity'),
    motion(0.6, 'lamp-glow').getAttribute('opacity'),
  );
  for (const phase of [0, 0.1, 0.35, 0.6, 0.9, 1]) {
    assert.ok(
      Number(motion(phase, 'lamp-glow').getAttribute('opacity')) <= 0.12,
    );
  }
  for (const state of ['on', 'off']) {
    assert.equal(scene(0, state), scene(1, state));
  }
});

test('the notebook draws three components, holds the sketch and fades before resetting', () => {
  const early = motion(0.14, 'notebook-sketch');
  const drawn = motion(0.65, 'notebook-sketch');
  const reset = motion(0.99, 'notebook-sketch');
  assert.equal(drawn.getElementsByTagName('rect').length, 3);
  const connector = (node) =>
    Array.from(node.getElementsByTagName('path')).find(
      (path) => path.getAttribute('data-part') === 'sketch-connectors',
    );
  assert.notEqual(
    connector(early).getAttribute('stroke-dashoffset'),
    connector(drawn).getAttribute('stroke-dashoffset'),
  );
  assert.equal(Number(connector(drawn).getAttribute('stroke-dashoffset')), 0);
  assert.equal(Number(reset.getAttribute('opacity')), 0);
  assert.ok(Number(motion(0.3, 'sketch-pen').getAttribute('opacity')) > 0);
  assert.equal(Number(motion(0.7, 'sketch-pen').getAttribute('opacity')), 0);
});

test('the notebook components stay inside the page and the lamp remains beside the monitor', () => {
  const sketch = motion(0.65, 'notebook-sketch');
  const matrix = sketch
    .getAttribute('transform')
    .match(/matrix\(([^)]+)\)/)[1]
    .split(/\s+/)
    .map(Number);
  for (const node of Array.from(sketch.getElementsByTagName('rect'))) {
    const x = Number(node.getAttribute('x'));
    const y = Number(node.getAttribute('y'));
    const width = Number(node.getAttribute('width'));
    const height = Number(node.getAttribute('height'));
    assert.ok(width <= 4 && height <= 4);
    for (const [px, py] of [
      [x, y],
      [x + width, y + height],
    ]) {
      const projectedX = matrix[0] * px + matrix[2] * py + matrix[4];
      const projectedY = matrix[1] * px + matrix[3] * py + matrix[5];
      assert.ok(projectedX >= 750 && projectedX <= 790);
      assert.ok(projectedY >= 287 && projectedY <= 306);
    }
  }
  const nodes = Array.from(document().getElementsByTagName('*'));
  const shade = nodes.find(
    (node) => node.getAttribute('data-part') === 'lamp-shade',
  );
  const base = nodes.find(
    (node) => node.getAttribute('data-part') === 'lamp-base',
  );
  assert.ok(shade && base, 'The lamp needs a measurable shade and base.');
  const coordinates = shade
    .getAttribute('d')
    .match(/-?\d+(?:\.\d+)?/g)
    .map(Number);
  const shadeTop = Math.min(
    ...coordinates.filter((value, index) => index % 2 === 1),
  );
  const shadeLeft = Math.min(
    ...coordinates.filter((value, index) => index % 2 === 0),
  );
  const shadeRight = Math.max(
    ...coordinates.filter((value, index) => index % 2 === 0),
  );
  const lampHeight = Number(base.getAttribute('cy')) - shadeTop;
  assert.ok(
    lampHeight / 148 >= 0.65 && lampHeight / 148 <= 0.75,
    'The lamp must have a plausible height beside the monitor.',
  );
  assert.ok(shadeLeft > 735 && shadeRight <= 821);
  assert.ok(shadeRight - shadeLeft >= 34 && shadeRight - shadeLeft <= 38);
  assert.equal(Number(base.getAttribute('cx')), 799);
  assert.equal(Number(base.getAttribute('cy')), 309);
});

test('the lamp has a physical rocker that changes position on its base', () => {
  const rocker = (state) =>
    Array.from(document(0.35, state).getElementsByTagName('g')).find(
      (node) => node.getAttribute('data-part') === 'lamp-switch',
    );
  const on = rocker('on');
  const off = rocker('off');
  assert.ok(on && off, 'The lamp base needs a physical rocker switch.');
  assert.equal(on.getAttribute('data-state'), 'on');
  assert.equal(off.getAttribute('data-state'), 'off');
  assert.notEqual(on.toString(), off.toString());
  assert.doesNotMatch(on.toString() + off.toString(), /<text|⏻/);
  for (const control of [on, off]) {
    for (const path of Array.from(control.getElementsByTagName('path'))) {
      const coordinates = path
        .getAttribute('d')
        .match(/-?\d+(?:\.\d+)?/g)
        .map(Number);
      assert.ok(
        coordinates
          .filter((value, index) => index % 2 === 0)
          .every((value) => value >= 794 && value <= 804),
      );
      assert.ok(
        coordinates
          .filter((value, index) => index % 2 === 1)
          .every((value) => value >= 304 && value <= 311),
      );
    }
  }
});

test('desk details remain static SVG geometry with no visible labels or active content', () => {
  for (const phase of [0, 0.14, 0.3, 0.65, 0.9, 1, 1.3]) {
    for (const state of ['on', 'off']) {
      document(phase, state);
      assert.doesNotMatch(
        scene(phase, state),
        /NaN|undefined|<text|<script|<animate|<foreignObject|\son[a-z]+\s*=/,
      );
    }
  }
  assert.equal(scene(0.3), scene(1.3));
});

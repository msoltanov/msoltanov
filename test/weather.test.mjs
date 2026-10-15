import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { drawSeasonalInteractions } from '../scripts/weather.mjs';

const FEATURES = {
  winter: 'desk-snow',
  spring: 'rain-ripple',
  summer: 'desk-glint',
  autumn: 'landing-leaf',
};
const STYLE = { accent: '#c8a171' };

function scene(season, phase) {
  const parts = [];
  drawSeasonalInteractions(
    {
      raw: (value) => parts.push(value),
      colors: { text: '#e3ebe8', muted: '#7d8f87', copper: '#d7a278' },
    },
    phase,
    season,
    STYLE,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}

function motion(season, phase, name = FEATURES[season]) {
  const document = new DOMParser({
    onError: (level, message) => {
      throw new Error(`${level}: ${message}`);
    },
  }).parseFromString(scene(season, phase), 'image/svg+xml');
  const node = Array.from(document.getElementsByTagName('*')).find(
    (candidate) => candidate.getAttribute('data-motion') === name,
  );
  assert.ok(node, `Missing ${name}.`);
  return node;
}

test('each season has only its own small weather interaction without visible labels or active SVG content', () => {
  for (const [season, feature] of Object.entries(FEATURES)) {
    for (const phase of [0, 0.12, 0.3, 0.55, 0.75, 0.95, 1]) {
      const svg = scene(season, phase);
      assert.match(svg, new RegExp(`data-motion="${feature}"`));
      for (const other of Object.values(FEATURES).filter(
        (name) => name !== feature,
      )) {
        assert.doesNotMatch(svg, new RegExp(`data-motion="${other}"`));
      }
      assert.doesNotMatch(
        svg,
        /NaN|undefined|<text|<script|<animate|<foreignObject|\son[a-z]+\s*=/,
      );
      motion(season, phase);
    }
  }
});

test('all weather interactions change during the cycle and repeat without a discontinuity at the boundary', () => {
  for (const season of Object.keys(FEATURES)) {
    assert.equal(scene(season, 0), scene(season, 1));
    assert.notEqual(scene(season, 0.3), scene(season, 0.65));
    assert.equal(scene(season, 0.3), scene(season, 1.3));
  }
});

test('winter snow settles on a clear part of the desk and fades before the next loop', () => {
  const arriving = motion('winter', 0.2);
  const settled = motion('winter', 0.55);
  const reset = motion('winter', 0.98);
  assert.equal(arriving.getAttribute('data-state'), 'falling');
  assert.equal(settled.getAttribute('data-state'), 'settled');
  const cap = settled.getElementsByTagName('path')[0];
  assert.ok(Number(cap.getAttribute('opacity')) > 0.6);
  assert.equal(Number(reset.getAttribute('opacity')), 0);
  for (const snow of Array.from(arriving.getElementsByTagName('circle'))) {
    assert.ok(
      Number(snow.getAttribute('cx')) >= 681 &&
        Number(snow.getAttribute('cx')) <= 706,
    );
    assert.ok(
      Number(snow.getAttribute('cy')) >= 294 &&
        Number(snow.getAttribute('cy')) <= 309,
    );
  }
});

test('spring ripples stay on the ground below the desk without reaching the dog or server', () => {
  for (const phase of [0, 0.2, 0.45, 0.7, 0.95]) {
    const ripple = motion('spring', phase);
    for (const ellipse of Array.from(ripple.getElementsByTagName('ellipse'))) {
      assert.equal(Number(ellipse.getAttribute('cx')), 635);
      assert.equal(Number(ellipse.getAttribute('cy')), 478);
      assert.ok(Number(ellipse.getAttribute('rx')) <= 27);
      assert.ok(Number(ellipse.getAttribute('ry')) <= 3.5);
    }
  }
});

test('the autumn leaf reaches the ground, rests, and disappears before resetting', () => {
  const falling = motion('autumn', 0.3);
  const landed = motion('autumn', 0.65);
  const resting = motion('autumn', 0.75);
  assert.equal(falling.getAttribute('data-state'), 'falling');
  assert.equal(landed.getAttribute('data-state'), 'settled');
  assert.notEqual(
    falling.getAttribute('transform'),
    landed.getAttribute('transform'),
  );
  assert.equal(
    landed.getAttribute('transform'),
    resting.getAttribute('transform'),
  );
  assert.match(
    landed.getAttribute('transform'),
    /translate\(650\.000 477\.000\)/,
  );
  assert.equal(Number(motion('autumn', 0.98).getAttribute('opacity')), 0);
});

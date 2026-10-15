import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { drawWorkshop } from '../scripts/workshop.mjs';

function scene(season, phase = 0, presentation = 'standalone') {
  const parts = [];
  const surface = {
    colors: {
      background: '#101315',
      raised: '#1e2528',
      border: '#34403b',
      text: '#e3ebe8',
      muted: '#7d8f87',
      accent: '#91d7bd',
      outline: '#0d1f18',
      ink: '#0d1f18',
      coat: '#e9e4d8',
      copper: '#d7a278',
    },
    raw: (value) => parts.push(value),
    rect: (x, y, width, height, fill, radius = 0, extra = '') =>
      parts.push(
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" ${extra}/>`,
      ),
    line: (x1, y1, x2, y2, stroke = '#34403b') =>
      parts.push(`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${stroke}"/>`),
    text: (x, y, value, fill, size, extra = '') =>
      parts.push(
        `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" ${extra}>${value}</text>`,
      ),
  };
  drawWorkshop(surface, phase, season, presentation);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="860" height="520">${parts.join('')}</svg>`;
}

test('every season includes a tree, nearby engineering desk and an always sleeping Alabay', () => {
  const features = {
    winter: 'new-year-tree',
    spring: 'petals',
    summer: 'canopy',
    autumn: 'falling-leaves',
  };
  for (const [season, feature] of Object.entries(features)) {
    const svg = scene(season);
    assert.match(svg, new RegExp(`data-season="${season}"`));
    assert.match(svg, new RegExp(`data-feature="${feature}"`));
    for (const item of [
      'tree',
      'desk',
      'monitor',
      'server',
      'notebook',
      'alabay',
    ]) {
      assert.match(svg, new RegExp(`data-scene="${item}"`));
    }
    assert.match(svg, /data-pose="sleeping"/);
    assert.doesNotMatch(
      svg,
      /data-pose="awake"|curiosity stays running|mekan \/ workspace/,
    );
    assert.match(svg, /ENGINEERING FIELDNOTES/);
    assert.match(svg, /ADR/);
    new DOMParser({
      onError: (level, message) => {
        throw new Error(`${level}: ${message}`);
      },
    }).parseFromString(svg, 'image/svg+xml');
  }
});

function motion(svg, name) {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const node = Array.from(document.getElementsByTagName('*')).find(
    (item) => item.getAttribute('data-motion') === name,
  );
  assert.ok(node, `Missing ${name} motion.`);
  return node;
}

test('opening presentation keeps seasonal metadata and the footer without visible season labels', () => {
  const svg = scene('summer', 0, 'opening');
  assert.match(svg, /data-season="summer"/);
  assert.doesNotMatch(svg, /SUMMER \/ JUN — AUG/);
  assert.match(svg, /ARCHITECTURE \/ DECISIONS \/ DELIVERY/);
  assert.doesNotMatch(
    svg,
    /ALABAY CODE|ALABAY \/ WATCH|ENGINEERING FIELDNOTES|SYSTEMS\. DIRECTION\. DELIVERY\.|M32 54L828 54/,
  );
  assert.match(scene('summer'), /ENGINEERING FIELDNOTES/);
  assert.doesNotMatch(
    scene('summer'),
    /ALABAY CODE|ALABAY \/ WATCH|alabay --watch/,
  );
});

test('the sleeping dog twitches its ear independently while its eyes remain closed', () => {
  const resting = motion(scene('winter', 0), 'ear-twitch');
  const twitching = motion(scene('winter', 0.63), 'ear-twitch');
  assert.notEqual(
    resting.getAttribute('transform'),
    twitching.getAttribute('transform'),
  );
  const breathing = motion(scene('winter', 0.25), 'ear-twitch');
  assert.equal(
    resting.getAttribute('transform'),
    breathing.getAttribute('transform'),
  );
  assert.notEqual(
    resting.parentNode.getAttribute('transform'),
    breathing.parentNode.getAttribute('transform'),
  );
  for (const phase of [0, 0.2, 0.4, 0.63, 0.8, 1]) {
    const eye = motion(scene('winter', phase), 'closed-eye');
    assert.equal(eye.getAttribute('d'), 'M252 444Q257 447 262 444');
    assert.equal(eye.getAttribute('data-state'), 'closed');
  }
});

test('reflections, sunlight and leaf shadows use numeric frame motion with restrained travel', () => {
  for (const season of ['winter', 'spring', 'summer', 'autumn']) {
    for (const feature of ['monitor-reflection', 'leaf-shadows', 'sunlight']) {
      const first = motion(scene(season, 0), feature);
      const middle = motion(scene(season, 0.37), feature);
      assert.notEqual(
        first.getAttribute('transform'),
        middle.getAttribute('transform'),
      );
      assert.equal(
        first.toString(),
        motion(scene(season, 1), feature).toString(),
      );
      assert.doesNotMatch(first.getAttribute('transform'), /NaN|undefined/);
      assert.ok(Number(first.getAttribute('opacity')) <= 0.12);
    }
  }
});

test('breathing, steam and server activity have independent frame timing', () => {
  for (const feature of ['breathing', 'steam', 'server-light']) {
    const first = motion(scene('winter', 0), feature);
    const middle = motion(scene('winter', 1 / 3), feature);
    const attributes = (node) =>
      `${node.getAttribute('transform')} ${node.getAttribute('opacity')}`;
    assert.notEqual(attributes(first), attributes(middle));
  }
});

test('seasonal motion is deterministic, changes frames and returns to its starting state', () => {
  for (const season of ['winter', 'spring', 'summer', 'autumn']) {
    assert.equal(scene(season, 0), scene(season, 1));
    assert.notEqual(scene(season, 0), scene(season, 0.4));
    assert.match(scene(season, 0.4), /data-pose="sleeping"/);
  }
});

test('monitor advances from plan-build-ship to review-build-test-deploy and repeats', () => {
  const samples = [
    [0.08, ['PLAN', 'BUILD', 'SHIP'], 'PLAN'],
    [0.4, ['PLAN', 'BUILD', 'SHIP'], 'SHIP'],
    [0.58, ['REVIEW', 'BUILD', 'TEST', 'DEPLOY'], 'REVIEW'],
    [0.72, ['REVIEW', 'BUILD', 'TEST', 'DEPLOY'], 'BUILD'],
    [0.82, ['REVIEW', 'BUILD', 'TEST', 'DEPLOY'], 'TEST'],
    [0.95, ['REVIEW', 'BUILD', 'TEST', 'DEPLOY'], 'DEPLOY'],
  ];
  for (const [phase, labels, active] of samples) {
    const svg = scene('winter', phase);
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const workflow = Array.from(document.getElementsByTagName('g')).find(
      (node) => node.hasAttribute('data-workflow'),
    );
    assert.ok(workflow, 'The monitor workflow is missing.');
    assert.deepEqual(
      Array.from(workflow.getElementsByTagName('text')).map(
        (node) => node.textContent,
      ),
      labels,
    );
    const selected = Array.from(workflow.getElementsByTagName('rect')).filter(
      (node) => node.getAttribute('data-state') === 'active',
    );
    assert.equal(selected.length, 1);
    assert.equal(selected[0].getAttribute('data-step'), active);
    assert.match(svg, /SYSTEMS\. DIRECTION\. DELIVERY\./);
    assert.match(svg, /ARCHITECTURE \/ DECISIONS \/ DELIVERY/);
  }
  assert.equal(scene('winter', 1), scene('winter', 0));
});

test('seasonal trees have a larger bounded sway that returns to the starting pose', () => {
  for (const season of ['winter', 'spring', 'summer', 'autumn']) {
    const positive = motion(scene(season, 0.12), 'tree-sway');
    const negative = motion(scene(season, 0.62), 'tree-sway');
    const angle = (node) =>
      Number(node.getAttribute('transform').match(/rotate\(([-\d.]+)/)[1]);
    assert.ok(angle(positive) >= 1.5 && angle(positive) <= 3);
    assert.ok(angle(negative) <= -1.5 && angle(negative) >= -3);
    assert.equal(scene(season, 0), scene(season, 1));
  }
});

test('the monitor edits code during review and reveals test and deployment feedback in order', () => {
  const before = motion(scene('winter', 0.4), 'monitor-code');
  const editing = motion(scene('winter', 0.58), 'monitor-code');
  const built = motion(scene('winter', 0.72), 'monitor-code');
  assert.equal(before.textContent, "const target = 'web';");
  assert.equal(editing.getAttribute('data-state'), 'editing');
  assert.notEqual(editing.textContent, before.textContent);
  assert.equal(built.textContent, "const target = 'desktop';");
  assert.equal(
    Number(motion(scene('winter', 0.72), 'test-check').getAttribute('opacity')),
    0,
  );
  assert.ok(
    Number(
      motion(scene('winter', 0.82), 'test-check').getAttribute('opacity'),
    ) > 0,
  );
  assert.equal(
    Number(
      motion(scene('winter', 0.82), 'deploy-pulse').getAttribute('opacity'),
    ),
    0,
  );
  const deployment = motion(scene('winter', 0.95), 'deploy-pulse');
  assert.ok(Number(deployment.getAttribute('opacity')) > 0);
  assert.ok(Number(deployment.getAttribute('r')) <= 14);
  assert.equal(scene('winter', 0), scene('winter', 1));
});

test('the sleeping paw twitches briefly and independently of the ear and breathing', () => {
  const resting = motion(scene('winter', 0), 'paw-twitch');
  const twitching = motion(scene('winter', 0.36), 'paw-twitch');
  assert.notEqual(
    resting.getAttribute('transform'),
    twitching.getAttribute('transform'),
  );
  assert.equal(
    resting.getAttribute('transform'),
    motion(scene('winter', 0.63), 'paw-twitch').getAttribute('transform'),
  );
  for (const phase of [0, 0.36, 0.63, 0.9, 1]) {
    assert.equal(
      motion(scene('winter', phase), 'closed-eye').getAttribute('data-state'),
      'closed',
    );
  }
});

test('the Alabay visibly stretches near the start of each loop without waking or leaving the ground', () => {
  const reach = (svg) => {
    const paw = motion(svg, 'sleepy-stretch-paws').getElementsByTagName(
      'path',
    )[0];
    assert.match(paw.getAttribute('d'), /^M258 461/);
    assert.match(paw.getAttribute('d'), /H286C292 468 285 463 275 462Z$/);
    return 222 - Number(paw.getAttribute('d').match(/ ([\d.]+) 472H286/)[1]);
  };
  for (const season of ['winter', 'spring', 'summer', 'autumn']) {
    const resting = scene(season, 0);
    const extending = scene(season, 3 / 24);
    const holding = scene(season, 5 / 24);
    const settling = scene(season, 7 / 24);
    assert.ok(reach(extending) > 0 && reach(extending) < reach(holding));
    assert.equal(reach(holding), 32);
    assert.ok(reach(settling) > 0 && reach(settling) < reach(holding));
    assert.equal(
      motion(holding, 'sleepy-stretch-head').getAttribute('transform'),
      'translate(-14.000 8.000)',
    );
    for (const seconds of [4.2, 5, 5.8]) {
      assert.equal(reach(scene(season, seconds / 24)), 32);
    }
    for (const seconds of [0, 1.9, 2, 8, 12, 18, 24]) {
      const svg = scene(season, seconds / 24);
      assert.equal(reach(svg), 0);
      assert.equal(
        motion(svg, 'sleepy-stretch-head').getAttribute('transform'),
        'translate(0.000 0.000)',
      );
    }
    for (const svg of [resting, extending, holding, settling]) {
      assert.equal(
        motion(svg, 'closed-eye').getAttribute('data-state'),
        'closed',
      );
      assert.equal(
        motion(svg, 'closed-eye').getAttribute('d'),
        'M252 444Q257 447 262 444',
      );
      assert.match(svg, /data-pose="sleeping"/);
    }
    assert.equal(resting, scene(season, 1));
    for (let seconds = 0; seconds <= 24; seconds += 0.5) {
      const svg = scene(season, seconds / 24);
      const head = motion(svg, 'sleepy-stretch-head');
      const [forward, dip] = head
        .getAttribute('transform')
        .match(/[-\d.]+/g)
        .map(Number);
      const angle =
        (Number(
          head
            .getElementsByTagName('g')[0]
            .getAttribute('transform')
            .match(/rotate\(([-\d.]+)/)[1],
        ) *
          Math.PI) /
        180;
      assert.ok(reach(svg) >= 0 && reach(svg) <= 32);
      assert.ok(forward >= -14 && forward <= 0);
      assert.ok(dip >= 0 && dip <= 8);
      for (const [x, y] of [
        [283, 468],
        [260, 470],
        [244, 462],
        [231, 459],
      ]) {
        const bottom =
          458 + (x - 273) * Math.sin(angle) + (y - 458) * Math.cos(angle) + dip;
        assert.ok(
          bottom <= 479,
          `The sleeping head crosses the ground at ${seconds}s.`,
        );
      }
      const shoulder =
        273 +
        (291 - 273) * Math.cos(angle) -
        (455 - 458) * Math.sin(angle) +
        forward;
      assert.ok(shoulder >= 266, 'The head must remain connected to the body.');
    }
    assert.equal(holding, scene(season, 5 / 24));
  }
});

test('the monitor tab follows the supplied project list and updates when the pins change', () => {
  const draw = (projects, phase) => {
    const parts = [];
    const surface = {
      colors: {
        raised: '#1e2528',
        muted: '#7d8f87',
        accent: '#91d7bd',
        text: '#e3ebe8',
        outline: '#0d1f18',
        coat: '#e9e4d8',
        copper: '#d7a278',
        border: '#34403b',
      },
      raw: (value) => parts.push(value),
      rect: () => {},
      line: () => {},
      text: (x, y, value, fill, size, extra = '') =>
        parts.push(`<text ${extra}>${value}</text>`),
    };
    drawWorkshop(surface, phase, 'summer', 'integrated', { projects });
    return motion(`<svg>${parts.join('')}</svg>`, 'project-tab').textContent;
  };
  assert.equal(
    draw([{ name: 'first' }, { name: 'second' }], 0.1),
    'repo: first',
  );
  assert.equal(
    draw([{ name: 'first' }, { name: 'second' }], 0.6),
    'repo: second',
  );
  assert.equal(draw([{ name: 'replacement' }], 0.6), 'repo: replacement');
  assert.equal(draw([], 0.6), 'architecture / review');
});

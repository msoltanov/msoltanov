import test from 'node:test';
import assert from 'node:assert/strict';

import {
  millisecondsUntilMidnight,
  startPreviewClock,
} from '../scripts/preview-clock.mjs';

function previewHarness(search = '') {
  let current = new Date('2026-02-28T18:59:59.500Z');
  let nextId = 0;
  const timers = new Map();
  const image = {
    src: '/season-assets/winter/workshop-light.gif',
    alt: 'Nora’s winter engineering workspace. A sleeping Alabay rests beside the desk.',
    getAttribute(name) {
      return this[name];
    },
    setAttribute(name, value) {
      this[name] = value;
    },
  };
  const source = {
    srcset: '/season-assets/winter/workshop-dark.gif',
    getAttribute(name) {
      return this[name];
    },
    setAttribute(name, value) {
      this[name] = value;
    },
  };
  image.closest = () => ({ querySelectorAll: () => [source] });
  const browserWindow = new EventTarget();
  browserWindow.location = { search };
  const document = new EventTarget();
  document.visibilityState = 'visible';
  document.querySelector = () => image;
  document.querySelectorAll = () => [image];
  const options = {
    window: browserWindow,
    document,
    now: () => current,
    setTimer(callback, delay) {
      nextId += 1;
      const id = nextId;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
  };
  return {
    image,
    source,
    browserWindow,
    document,
    timers,
    options,
    setDate(value) {
      current = new Date(value);
    },
    fireTimer() {
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      timer.callback();
    },
  };
}

test('midnight delay uses Ashgabat time and includes milliseconds', () => {
  assert.equal(typeof millisecondsUntilMidnight, 'function');
  assert.equal(
    millisecondsUntilMidnight(new Date('2026-02-28T18:59:59.500Z')),
    500,
  );
  assert.equal(
    millisecondsUntilMidnight(new Date('2026-02-28T19:00:00Z')),
    86_400_000,
  );
  assert.equal(
    millisecondsUntilMidnight(new Date('2026-12-31T18:00:00.125Z')),
    3_599_875,
  );
});

test('Auto updates the picture at local midnight without replacing the page', () => {
  assert.equal(typeof startPreviewClock, 'function');
  const harness = previewHarness();
  const stop = startPreviewClock(harness.options);
  assert.equal(harness.timers.size, 1);
  assert.equal([...harness.timers.values()][0].delay, 500);
  assert.match(harness.image.src, /winter\/workshop-light.gif$/);

  harness.setDate('2026-02-28T19:00:00Z');
  harness.fireTimer();
  assert.match(harness.image.src, /spring\/workshop-light.gif$/);
  assert.match(harness.source.srcset, /spring\/workshop-dark.gif$/);
  assert.match(harness.image.alt, /spring engineering workspace/);
  assert.match(harness.image.alt, /^Nora’s /);
  assert.equal(harness.timers.size, 1);
  assert.equal([...harness.timers.values()][0].delay, 86_400_000);
  stop();
});

test('valid manual season queries stay pinned and register no timer', () => {
  assert.equal(typeof startPreviewClock, 'function');
  for (const season of ['winter', 'spring', 'summer', 'autumn']) {
    const harness = previewHarness(`?season=${season}`);
    harness.image.src = `/season-assets/${season}/workshop-light.gif`;
    const stop = startPreviewClock(harness.options);
    harness.setDate('2026-05-31T19:00:00Z');
    harness.browserWindow.dispatchEvent(new Event('focus'));
    harness.document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(
      harness.image.src,
      `/season-assets/${season}/workshop-light.gif`,
    );
    assert.equal(harness.timers.size, 0);
    stop();
  }
});

test('automatic season changes preserve the disabled lamp in both image themes', () => {
  const harness = previewHarness();
  harness.image.src = '/season-assets/winter/workshop-lamp-off-light.gif';
  harness.source.srcset = '/season-assets/winter/workshop-lamp-off-dark.gif';
  const stop = startPreviewClock(harness.options);
  harness.setDate('2026-02-28T19:00:00Z');
  harness.fireTimer();
  assert.equal(
    harness.image.src,
    '/season-assets/spring/workshop-lamp-off-light.gif',
  );
  assert.equal(
    harness.source.srcset,
    '/season-assets/spring/workshop-lamp-off-dark.gif',
  );
  stop();
});

test('automatic seasons update all responsive sources without losing mobile lamp variants', () => {
  const harness = previewHarness();
  const sources = [
    'workshop-mobile-lamp-off-dark.gif',
    'workshop-mobile-lamp-off-light.gif',
    'workshop-lamp-off-dark.gif',
  ].map((name) => ({
    srcset: `/season-assets/winter/${name}?version=3`,
    getAttribute(name) {
      return this[name];
    },
    setAttribute(name, value) {
      this[name] = value;
    },
  }));
  harness.image.src = '/season-assets/winter/workshop-lamp-off-light.gif';
  harness.image.closest = () => ({ querySelectorAll: () => sources });
  const stop = startPreviewClock(harness.options);
  harness.setDate('2026-02-28T19:00:00Z');
  harness.fireTimer();
  assert.deepEqual(
    sources.map((source) => source.srcset),
    [
      'workshop-mobile-lamp-off-dark.gif',
      'workshop-mobile-lamp-off-light.gif',
      'workshop-lamp-off-dark.gif',
    ].map((name) => `/season-assets/spring/${name}?version=3`),
  );
  assert.equal(
    harness.image.src,
    '/season-assets/spring/workshop-lamp-off-light.gif',
  );
  sources[0].srcset = '/season-assets/winter/workshop-mobile-lamp-off-dark.gif';
  harness.browserWindow.dispatchEvent(new Event('focus'));
  assert.equal(
    sources[0].srcset,
    '/season-assets/spring/workshop-mobile-lamp-off-dark.gif',
  );
  stop();
});

test('automatic season changes also refresh project cards and preserve their format', () => {
  const harness = previewHarness();
  const card = {
    ...harness.image,
    src: '/season-assets/winter/project-1-light.gif',
    alt: 'Public project.',
  };
  const source = {
    ...harness.source,
    srcset: '/season-assets/winter/project-1-dark.gif',
  };
  card.closest = () => ({ querySelectorAll: () => [source] });
  harness.document.querySelectorAll = () => [harness.image, card];
  const stop = startPreviewClock(harness.options);
  harness.setDate('2026-02-28T19:00:00Z');
  harness.fireTimer();
  assert.equal(card.src, '/season-assets/spring/project-1-light.gif');
  assert.equal(source.srcset, '/season-assets/spring/project-1-dark.gif');
  assert.equal(card.alt, 'Public project.');
  stop();
});

test('invalid manual queries use Auto and recover after skipped timers', () => {
  assert.equal(typeof startPreviewClock, 'function');
  const harness = previewHarness('?season=invalid');
  const stop = startPreviewClock(harness.options);
  harness.setDate('2026-10-31T19:00:00Z');
  harness.fireTimer();
  assert.match(harness.image.src, /winter\/workshop-light.gif$/);
  assert.equal(harness.timers.size, 1);
  stop();
});

test('visible tabs, restored pages and focused windows recover immediately', () => {
  assert.equal(typeof startPreviewClock, 'function');
  for (const event of ['visibilitychange', 'pageshow', 'focus']) {
    const harness = previewHarness();
    const stop = startPreviewClock(harness.options);
    harness.setDate('2026-08-31T19:00:00Z');
    const target =
      event === 'visibilitychange' ? harness.document : harness.browserWindow;
    target.dispatchEvent(new Event(event));
    assert.match(harness.image.src, /autumn\/workshop-light.gif$/);
    assert.match(harness.source.srcset, /autumn\/workshop-dark.gif$/);
    assert.equal(harness.timers.size, 1);
    stop();
  }
});

test('hidden tabs defer visibility recovery and cleanup removes all work', () => {
  assert.equal(typeof startPreviewClock, 'function');
  const harness = previewHarness();
  const stop = startPreviewClock(harness.options);
  harness.setDate('2026-05-31T19:00:00Z');
  harness.document.visibilityState = 'hidden';
  harness.document.dispatchEvent(new Event('visibilitychange'));
  assert.match(harness.image.src, /winter\/workshop-light.gif$/);
  stop();
  assert.equal(harness.timers.size, 0);
  harness.document.visibilityState = 'visible';
  harness.document.dispatchEvent(new Event('visibilitychange'));
  harness.browserWindow.dispatchEvent(new Event('focus'));
  harness.browserWindow.dispatchEvent(new Event('pageshow'));
  assert.match(harness.image.src, /winter\/workshop-light.gif$/);
  assert.equal(harness.timers.size, 0);
});

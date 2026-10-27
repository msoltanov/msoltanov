import assert from 'node:assert/strict';
import test from 'node:test';
import { startPreviewMotion } from '../scripts/preview-motion.mjs';

const STORAGE_KEY = 'mekans-desk-motion';
const REDUCED_MOTION_MEDIA = '(prefers-reduced-motion: reduce)';

function previewHarness({
  reduce = false,
  saved,
  search = '',
  blockedStorage = false,
  missing,
} = {}) {
  const values = new Map(saved === undefined ? [] : [[STORAGE_KEY, saved]]);
  const attributes = {};
  const button = new EventTarget();
  button.getAttribute = (name) => attributes[name];
  button.setAttribute = (name, value) => {
    attributes[name] = value;
  };
  const sources = [
    [
      `(max-width: 600px) and ${REDUCED_MOTION_MEDIA}`,
      '/season-assets/winter/workshop-mobile-dark.svg',
    ],
    [REDUCED_MOTION_MEDIA, '/season-assets/winter/workshop-dark.svg'],
    [
      `(max-width: 600px) and ${REDUCED_MOTION_MEDIA} and (prefers-color-scheme: dark)`,
      '/season-assets/winter/workshop-mobile-dark.svg',
    ],
    ['(max-width: 600px)', '/season-assets/winter/workshop-mobile-dark.gif'],
  ].map(([media, srcset]) => ({
    media,
    srcset,
    getAttribute(name) {
      return this[name];
    },
    setAttribute(name, value) {
      this[name] = value;
    },
  }));
  const mediaQuery = new EventTarget();
  mediaQuery.matches = reduce;
  const document = {
    querySelector: () => (missing === 'button' ? null : button),
    querySelectorAll: () =>
      missing === 'sources'
        ? []
        : sources.filter((source) =>
            source.media.includes('prefers-reduced-motion'),
          ),
  };
  const browserWindow = {
    location: { search },
    matchMedia: (query) => {
      assert.equal(query, REDUCED_MOTION_MEDIA);
      return mediaQuery;
    },
    localStorage: {
      getItem(key) {
        if (blockedStorage) {
          throw new Error('Storage is unavailable.');
        }
        return values.get(key) ?? null;
      },
      setItem(key, value) {
        if (blockedStorage) {
          throw new Error('Storage is unavailable.');
        }
        values.set(key, value);
      },
    },
  };
  return {
    button,
    sources,
    mediaQuery,
    values,
    options: { window: browserWindow, document },
  };
}

test('system reduced motion starts still and the local control explicitly plays and pauses animations', () => {
  const harness = previewHarness({ reduce: true });
  const originalMedia = harness.sources.map((source) => source.media);
  const originalSources = harness.sources.map((source) => source.srcset);
  const stop = startPreviewMotion(harness.options);
  assert.equal(harness.button.textContent, 'Play animations');
  assert.equal(harness.button.getAttribute('aria-pressed'), 'false');
  assert.deepEqual(
    harness.sources.map((source) => source.media),
    originalMedia,
  );
  harness.button.dispatchEvent(new Event('click'));
  assert.equal(harness.button.textContent, 'Pause animations');
  assert.equal(harness.button.getAttribute('aria-pressed'), 'true');
  assert.equal(harness.values.get(STORAGE_KEY), 'playing');
  assert.deepEqual(
    harness.sources.map((source) => source.media),
    ['not all', 'not all', 'not all', '(max-width: 600px)'],
  );
  harness.sources[0].srcset =
    '/season-assets/spring/workshop-mobile-lamp-off-dark.svg';
  harness.button.dispatchEvent(new Event('click'));
  assert.equal(harness.button.textContent, 'Play animations');
  assert.equal(harness.values.get(STORAGE_KEY), 'paused');
  assert.deepEqual(
    harness.sources.map((source) => source.media),
    [
      '(max-width: 600px)',
      'all',
      '(max-width: 600px) and (prefers-color-scheme: dark)',
      '(max-width: 600px)',
    ],
  );
  assert.equal(
    harness.sources[0].srcset,
    '/season-assets/spring/workshop-mobile-lamp-off-dark.svg',
  );
  assert.deepEqual(
    harness.sources.slice(1).map((source) => source.srcset),
    originalSources.slice(1),
  );
  stop();
});

test('motion query overrides saved and system preferences and persists the explicit choice', () => {
  for (const [query, saved, expected] of [
    ['play', 'paused', 'playing'],
    ['pause', 'playing', 'paused'],
  ]) {
    const harness = previewHarness({
      reduce: query === 'play',
      saved,
      search: `?season=winter&motion=${query}`,
    });
    const stop = startPreviewMotion(harness.options);
    assert.equal(harness.values.get(STORAGE_KEY), expected);
    assert.equal(
      harness.button.getAttribute('aria-pressed'),
      String(expected === 'playing'),
    );
    assert.equal(
      harness.sources[1].media,
      expected === 'playing' ? 'not all' : 'all',
    );
    stop();
    const reload = previewHarness({
      reduce: query === 'play',
      saved: harness.values.get(STORAGE_KEY),
    });
    const stopReload = startPreviewMotion(reload.options);
    assert.equal(
      reload.button.getAttribute('aria-pressed'),
      String(expected === 'playing'),
    );
    stopReload();
  }
});

test('system motion changes follow the OS until an explicit choice is made', () => {
  const harness = previewHarness({
    saved: 'invalid',
    search: '?motion=invalid',
  });
  const stop = startPreviewMotion(harness.options);
  assert.equal(harness.button.textContent, 'Pause animations');
  harness.mediaQuery.matches = true;
  harness.mediaQuery.dispatchEvent(new Event('change'));
  assert.equal(harness.button.textContent, 'Play animations');
  harness.button.dispatchEvent(new Event('click'));
  harness.mediaQuery.matches = false;
  harness.mediaQuery.dispatchEvent(new Event('change'));
  harness.mediaQuery.matches = true;
  harness.mediaQuery.dispatchEvent(new Event('change'));
  assert.equal(harness.button.textContent, 'Pause animations');
  assert.equal(harness.sources[1].media, 'not all');
  stop();
});

test('blocked storage does not disable the local motion control or query override', () => {
  for (const search of ['', '?motion=play']) {
    const harness = previewHarness({
      reduce: true,
      blockedStorage: true,
      search,
    });
    const stop = startPreviewMotion(harness.options);
    assert.equal(
      harness.button.getAttribute('aria-pressed'),
      String(search !== ''),
    );
    assert.doesNotThrow(() => harness.button.dispatchEvent(new Event('click')));
    assert.equal(
      harness.button.getAttribute('aria-pressed'),
      String(search === ''),
    );
    stop();
  }
});

test('cleanup restores source media and removes click and OS listeners', () => {
  const harness = previewHarness();
  const originals = harness.sources.map((source) => source.media);
  const stop = startPreviewMotion(harness.options);
  harness.button.dispatchEvent(new Event('click'));
  const label = harness.button.textContent;
  stop();
  assert.deepEqual(
    harness.sources.map((source) => source.media),
    originals,
  );
  harness.button.dispatchEvent(new Event('click'));
  harness.mediaQuery.matches = true;
  harness.mediaQuery.dispatchEvent(new Event('change'));
  assert.equal(harness.button.textContent, label);
  assert.equal(harness.values.get(STORAGE_KEY), 'paused');
});

test('missing motion controls or static sources leave the preview untouched', () => {
  for (const missing of ['button', 'sources']) {
    assert.doesNotThrow(() =>
      startPreviewMotion(previewHarness({ missing }).options)(),
    );
  }
  assert.doesNotThrow(() => startPreviewMotion()());
});

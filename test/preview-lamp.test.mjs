import assert from 'node:assert/strict';
import test from 'node:test';
import { startPreviewLamp } from '../scripts/preview-lamp.mjs';

const STORAGE_KEY = 'mekans-desk-lamp';

function previewHarness({
  saved,
  extension = 'gif',
  missing,
  blockedStorage = false,
  blockedReads = false,
} = {}) {
  const values = new Map(saved === undefined ? [] : [[STORAGE_KEY, saved]]);
  const attributes = { 'aria-pressed': 'true' };
  const button = new EventTarget();
  button.getAttribute = (name) => attributes[name];
  button.setAttribute = (name, value) => {
    attributes[name] = value;
  };
  const image = {
    src: `/season-assets/winter/workshop-light.${extension}?version=7`,
    getAttribute(name) {
      return this[name];
    },
    setAttribute(name, value) {
      this[name] = value;
    },
  };
  const sources = ['dark', 'light'].map((theme) => ({
    srcset: `/season-assets/winter/workshop-${theme}.${extension}?version=7 1x, /assets/workshop-${theme}.${extension}#large 2x`,
    getAttribute(name) {
      return this[name];
    },
    setAttribute(name, value) {
      this[name] = value;
    },
  }));
  image.closest = () => ({ querySelectorAll: () => sources });
  const document = {
    querySelector: (selector) =>
      selector === '#desk-lamp-toggle'
        ? missing === 'button'
          ? null
          : button
        : missing === 'image'
          ? null
          : image,
  };
  const browserWindow = {
    localStorage: {
      getItem(key) {
        if (blockedStorage || blockedReads) {
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
    image,
    sources,
    values,
    options: { window: browserWindow, document },
  };
}

test('lamp toggle switches both picture themes while preserving filenames, source sets and the image node', () => {
  for (const extension of ['gif', 'svg']) {
    const harness = previewHarness({ extension });
    const original = harness.image;
    const stop = startPreviewLamp(harness.options);
    assert.equal(harness.button.getAttribute('aria-pressed'), 'true');
    assert.equal(harness.button.getAttribute('title'), 'Turn desk lamp off');
    harness.button.dispatchEvent(new Event('click'));
    assert.equal(harness.image, original);
    assert.equal(
      harness.image.src,
      `/season-assets/winter/workshop-lamp-off-light.${extension}?version=7`,
    );
    assert.deepEqual(
      harness.sources.map((source) => source.srcset),
      ['dark', 'light'].map(
        (theme) =>
          `/season-assets/winter/workshop-lamp-off-${theme}.${extension}?version=7 1x, /assets/workshop-lamp-off-${theme}.${extension}#large 2x`,
      ),
    );
    assert.equal(harness.button.getAttribute('aria-pressed'), 'false');
    assert.equal(harness.button.getAttribute('title'), 'Turn desk lamp on');
    assert.equal(harness.values.get(STORAGE_KEY), 'off');
    harness.button.dispatchEvent(new Event('click'));
    assert.equal(
      harness.image.src,
      `/season-assets/winter/workshop-light.${extension}?version=7`,
    );
    assert.equal(harness.values.get(STORAGE_KEY), 'on');
    stop();
    harness.button.dispatchEvent(new Event('click'));
    assert.equal(harness.values.get(STORAGE_KEY), 'on');
  }
});

test('stored lamp choice restores without changing the selected season or theme', () => {
  const harness = previewHarness({ saved: 'off' });
  harness.image.src = '/season-assets/autumn/workshop-dark.gif';
  const stop = startPreviewLamp(harness.options);
  assert.equal(
    harness.image.src,
    '/season-assets/autumn/workshop-lamp-off-dark.gif',
  );
  assert.equal(harness.button.getAttribute('aria-pressed'), 'false');
  stop();
});

test('lamp choice applies to mobile sources and survives a responsive source or season change', () => {
  const harness = previewHarness();
  harness.sources[0].srcset =
    '/season-assets/winter/workshop-mobile-dark.gif?version=7';
  harness.sources[1].srcset =
    '/season-assets/winter/workshop-mobile-light.gif?version=7';
  const stop = startPreviewLamp(harness.options);
  harness.button.dispatchEvent(new Event('click'));
  assert.equal(
    harness.sources[0].srcset,
    '/season-assets/winter/workshop-mobile-lamp-off-dark.gif?version=7',
  );
  assert.equal(
    harness.sources[1].srcset,
    '/season-assets/winter/workshop-mobile-lamp-off-light.gif?version=7',
  );
  harness.image.src =
    '/season-assets/spring/workshop-mobile-lamp-off-light.gif';
  harness.sources[0].srcset =
    '/season-assets/spring/workshop-mobile-lamp-off-dark.gif';
  harness.sources[1].srcset =
    '/season-assets/spring/workshop-mobile-lamp-off-light.gif';
  harness.button.dispatchEvent(new Event('click'));
  assert.equal(
    harness.image.src,
    '/season-assets/spring/workshop-mobile-light.gif',
  );
  assert.equal(
    harness.sources[0].srcset,
    '/season-assets/spring/workshop-mobile-dark.gif',
  );
  assert.equal(
    harness.sources[1].srcset,
    '/season-assets/spring/workshop-mobile-light.gif',
  );
  stop();
});

test('invalid stored choices default to on and blocked storage never disables the toggle', () => {
  for (const options of [
    { saved: 'invalid' },
    { blockedStorage: true },
    { blockedReads: true },
  ]) {
    const harness = previewHarness(options);
    const stop = startPreviewLamp(harness.options);
    assert.equal(harness.button.getAttribute('aria-pressed'), 'true');
    assert.doesNotThrow(() => harness.button.dispatchEvent(new Event('click')));
    assert.equal(harness.button.getAttribute('aria-pressed'), 'false');
    assert.match(harness.image.src, /workshop-lamp-off-light/);
    stop();
  }
});

test('the lamp control tolerates missing preview elements and inaccessible storage properties', () => {
  for (const missing of ['button', 'image']) {
    assert.doesNotThrow(() =>
      startPreviewLamp(previewHarness({ missing }).options)(),
    );
  }
  const harness = previewHarness();
  Object.defineProperty(harness.options.window, 'localStorage', {
    get() {
      throw new Error('Storage property blocked.');
    },
  });
  const stop = startPreviewLamp(harness.options);
  harness.button.dispatchEvent(new Event('click'));
  assert.equal(harness.button.getAttribute('aria-pressed'), 'false');
  stop();
});

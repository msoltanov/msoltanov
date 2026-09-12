import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('GitHub theme anchors wrap viewport-only pictures to preserve desktop art direction', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.doesNotMatch(readme, /prefers-color-scheme/);
  for (const surface of ['profile', 'languages']) {
    for (const theme of ['dark', 'light']) {
      const anchor = `<a href="assets/${surface}-${theme}.svg#gh-${theme}-mode-only">`;
      assert.ok(readme.includes(anchor));
      assert.ok(readme.includes(`srcset="assets/${surface}-${theme}-mobile.svg"`));
    }
  }
});

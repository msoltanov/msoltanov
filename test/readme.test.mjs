import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('GitHub theme anchors wrap viewport-only pictures to preserve desktop art direction', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  for (const surface of ['profile', 'languages']) {
    for (const theme of ['dark', 'light']) {
      const anchor = `<a href="assets/${surface}-${theme}.svg#gh-${theme}-mode-only">`;
      assert.ok(readme.includes(anchor));
      const picture = readme.slice(readme.indexOf(anchor)).split('</a>')[0];
      assert.doesNotMatch(picture, /prefers-color-scheme/);
      assert.ok(readme.includes(`srcset="assets/${surface}-${theme}-mobile.svg"`));
      assert.ok(readme.includes(`media="(prefers-reduced-motion: reduce) and (max-width: 600px)" srcset="assets/${surface}-${theme}-mobile-still.svg"`));
      assert.ok(readme.includes(`media="(prefers-reduced-motion: reduce)" srcset="assets/${surface}-${theme}-still.svg"`));
    }
  }
});

test('README alternatives expose the generated descriptions and confirmed contact links', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const readme = '<img alt="Old text" src="assets/profile-dark.svg" width="860">\n\n[a@example.com](mailto:a@example.com)\n';
  const config = { contact: { emails: ['a@example.com'], socials: [{ label: 'X', url: 'https://x.com/confirmed' }, { label: 'HN', url: null }] } };
  const assets = { 'profile-dark.svg': '<svg><desc id="desc">OS: Linux. Commits: 1,234. AI &amp; tools.</desc></svg>' };
  const result = updateReadme(readme, config, assets);
  assert.match(result, /alt="OS: Linux\. Commits: 1,234\. AI &amp; tools\."/);
  assert.match(result, /\[X\]\(https:\/\/x\.com\/confirmed\)/);
  assert.doesNotMatch(result, /\[HN\]|null|Old text/);
  assert.equal(updateReadme(result, config, assets), result);
});

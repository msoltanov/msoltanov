import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('each card is one picture that picks theme, motion, and width from media queries', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.doesNotMatch(readme, /gh-(?:dark|light)-mode-only/);
  for (const surface of ['profile', 'languages']) {
    const picture = readme.slice(readme.lastIndexOf('<picture>', readme.indexOf(`src="assets/${surface}-light.svg"`))).split('</picture>')[0];
    const sources = [...picture.matchAll(/<source media="([^"]+)" srcset="assets\/([^"]+)">/g)].map(([, media, file]) => [media, file]);
    assert.deepEqual(sources, [
      ['(prefers-color-scheme: dark) and (prefers-reduced-motion: reduce) and (max-width: 600px)', `${surface}-dark-mobile-still.svg`],
      ['(prefers-color-scheme: dark) and (prefers-reduced-motion: reduce)', `${surface}-dark-still.svg`],
      ['(prefers-color-scheme: dark) and (max-width: 600px)', `${surface}-dark-mobile.svg`],
      ['(prefers-color-scheme: dark)', `${surface}-dark.svg`],
      ['(prefers-reduced-motion: reduce) and (max-width: 600px)', `${surface}-light-mobile-still.svg`],
      ['(prefers-reduced-motion: reduce)', `${surface}-light-still.svg`],
      ['(max-width: 600px)', `${surface}-light-mobile.svg`],
    ]);
  }
});

test('tech stack is rendered from configuration between markers', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const readme = 'Intro\n<!-- tech-stack:start -->\nold\n<!-- tech-stack:end -->\nEnd\n';
  const config = { techStack: [{ label: 'Go "fast"', icon: 'go', url: 'https://go.dev/?a=1&b=2' }] };
  const result = updateReadme(readme, config, {});
  assert.doesNotMatch(result, /\bold\b/);
  assert.match(result, /<a href="https:\/\/go\.dev\/\?a=1&amp;b=2" title="Go &quot;fast&quot;"><picture>/);
  assert.match(result, /srcset="https:\/\/skillicons\.dev\/icons\?i=go&amp;theme=dark"/);
  assert.match(result, /<img src="https:\/\/skillicons\.dev\/icons\?i=go&amp;theme=light" alt="Go &quot;fast&quot;"/);
  assert.match(result, /^Intro\n<!-- tech-stack:start -->\n<p>[\s\S]*<\/p>\n<!-- tech-stack:end -->\nEnd\n$/);
  assert.equal(updateReadme(result, config, {}), result);
});

test('the committed README tech stack matches the configuration', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const config = JSON.parse(await readFile(new URL('../config/profile.json', import.meta.url), 'utf8'));
  assert.equal(updateReadme(readme, { techStack: config.techStack }, {}), readme);
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

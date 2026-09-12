import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { escapeXml, renderAssets } from '../scripts/svg.mjs';

const config = {
  name: 'Mekan', username: 'msoltanov', editorName: 'ALABAY CODE',
  focus: ['Software Engineering', 'Cybersecurity', 'AI & Experimentation', 'Infrastructure', 'Open Source', 'Growth Engineering'],
};

const data = {
  publicRepos: 16, followers: 21, starsEarned: 0,
  projects: [{ name: 'pdf-shrinker', description: 'Compress PDF files', url: 'https://github.com/msoltanov/pdf-shrinker' }],
  languages: { rows: [{ name: 'JavaScript', percentage: 60 }, { name: 'Python', percentage: 40 }], alsoUsed: [], scope: 'public' },
};

function parse(svg) {
  return new DOMParser({ onError: (level, message) => { throw new Error(`${level}: ${message}`); } }).parseFromString(svg, 'image/svg+xml');
}

test('XML escapes markup, quotes, and invalid XML control characters', () => {
  assert.equal(escapeXml('<a x="1">&\'\u0000\u000b'), '&lt;a x=&quot;1&quot;&gt;&amp;&apos;');
});

test('renders intentional desktop and mobile versions of both surfaces and themes', () => {
  const assets = renderAssets(config, data);
  assert.equal(Object.keys(assets).length, 8);
  for (const [name, svg] of Object.entries(assets)) {
    const document = parse(svg);
    assert.equal(document.documentElement.nodeName, 'svg');
    assert.equal(document.documentElement.getAttribute('role'), 'img');
    assert.ok(document.getElementsByTagName('title').length);
    assert.ok(document.getElementsByTagName('desc').length);
    assert.match(svg, /ALABAY CODE/);
    assert.match(svg, name.includes('mobile') ? /viewBox="0 0 420 / : /viewBox="0 0 860 /);
    assert.doesNotMatch(svg.replace('http://www.w3.org/2000/svg', ''), /<script|<foreignObject|<image|<animate|https?:|onload=/i);
  }
});

test('all inserted strings remain text even with hostile public metadata', () => {
  const hostile = '<script>alert("x")</script>&\u0000';
  const assets = renderAssets({ ...config, name: hostile }, {
    ...data,
    projects: [{ name: hostile, description: hostile, url: 'javascript:alert(1)' }],
    languages: { ...data.languages, rows: [{ name: hostile, percentage: 100 }] },
  });
  assert.equal(Object.keys(assets).length, 8);
  for (const svg of Object.values(assets)) {
    const document = parse(svg);
    assert.equal(document.getElementsByTagName('script').length, 0);
    assert.doesNotMatch(svg, /javascript:|\u0000/);
  }
});

test('same safe input produces byte-identical output and no generation timestamp', () => {
  const first = renderAssets(config, data);
  assert.ok(Object.keys(first).length);
  assert.deepEqual(first, renderAssets(config, structuredClone(data)));
  assert.doesNotMatch(Object.values(first).join(''), /generated at|Date\(|2026-/);
});

test('empty languages and projects remain valid and claim no invented data', () => {
  const assets = renderAssets(config, { ...data, projects: [], languages: { rows: [], alsoUsed: [], scope: 'public' } });
  assert.match(assets['languages-dark.svg'], /No language bytes reported/);
  assert.doesNotMatch(assets['languages-dark.svg'], /NaN|Infinity|undefined/);
  assert.doesNotMatch(assets['profile-dark.svg'], /pdf-shrinker/);
});

test('full language diversity wraps and all labels survive in accessible text', () => {
  const alsoUsed = ['C++', 'Jupyter Notebook', 'Objective-C++', 'Vim Script', 'Shell', 'Lua', 'Dart', 'HCL'];
  const assets = renderAssets(config, { ...data, languages: { ...data.languages, alsoUsed, scope: 'authorized' } });
  assert.equal(Object.keys(assets).length, 8);
  for (const [name, svg] of Object.entries(assets)) {
    parse(svg);
    if (name.startsWith('languages')) {
      assert.match(svg, /public \+ authorized private/);
      for (const language of alsoUsed) {
        assert.ok(svg.includes(escapeXml(language)));
      }
    }
  }
});

test('short identity content leaves enough room for the public project tree', () => {
  const projects = ['first-project', 'second-project', 'third-public-project'].map((name) => ({ name, description: '', url: '' }));
  const svg = renderAssets({ ...config, focus: [] }, { ...data, projects })['profile-dark.svg'];
  const texts = Array.from(parse(svg).getElementsByTagName('text'));
  const lastProject = texts.find((node) => node.textContent === 'third-public-project');
  const terminal = texts.find((node) => node.textContent === 'TERMINAL');
  assert.ok(Number(lastProject.getAttribute('y')) + 35 < Number(terminal.getAttribute('y')));
});

test('language caption changes when forks or mirrors are included', () => {
  const assets = renderAssets({ ...config, filters: { includeForks: true } }, data);
  assert.match(assets['languages-dark.svg'], /owned repositories \/ language bytes/);
  assert.doesNotMatch(assets['languages-dark.svg'], /owned source \/ language bytes/);
});

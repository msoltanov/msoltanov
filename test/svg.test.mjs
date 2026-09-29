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

test('renders one side-by-side card per surface and theme', () => {
  const assets = renderAssets(config, data);
  assert.deepEqual(Object.keys(assets).sort(), ['profile-dark.svg', 'profile-light.svg']);
  for (const svg of Object.values(assets)) {
    const document = parse(svg);
    assert.equal(document.documentElement.nodeName, 'svg');
    assert.equal(document.documentElement.getAttribute('role'), 'img');
    assert.ok(document.getElementsByTagName('title').length);
    assert.ok(document.getElementsByTagName('desc').length);
    assert.match(svg, /ALABAY CODE/);
    assert.match(svg, /viewBox="0 0 860 /);
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
  assert.equal(Object.keys(assets).length, 2);
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
  const empty = renderAssets(config, { ...data, projects: [], languages: { rows: [], alsoUsed: [], scope: 'public' } })['profile-dark.svg'];
  assert.match(parse(empty).getElementsByTagName('desc')[0].textContent, /No language bytes reported\.$/);
  const assets = renderAssets(config, { ...data, projects: [], languages: { rows: [], alsoUsed: [], scope: 'public' } });
  assert.match(assets['profile-dark.svg'], /No language bytes reported/);
  assert.doesNotMatch(assets['profile-dark.svg'], /NaN|Infinity|undefined/);
  assert.doesNotMatch(assets['profile-dark.svg'], /pdf-shrinker/);
});

test('full language diversity wraps and all labels survive in accessible text', () => {
  const alsoUsed = ['C++', 'Jupyter Notebook', 'Objective-C++', 'Vim Script', 'Shell', 'Lua', 'Dart', 'HCL'];
  const assets = renderAssets(config, { ...data, languages: { ...data.languages, alsoUsed, scope: 'authorized' } });
  assert.equal(Object.keys(assets).length, 2);
  for (const [name, svg] of Object.entries(assets)) {
    parse(svg);
    if (name.startsWith('profile')) {
      assert.match(svg, /public \+ authorized private/);
      for (const language of alsoUsed) {
        assert.ok(svg.includes(escapeXml(language)));
      }
    }
  }
});

test('the last shell line stays above the languages pane', () => {
  const projects = ['first-project', 'second-project', 'third-public-project'].map((name) => ({ name, description: '', url: '' }));
  const detailed = { ...config, system: { os: ['Linux'], programming: ['Python', 'Go'] }, activity: { enabled: true } };
  const svg = renderAssets(detailed, { ...data, projects })['profile-dark.svg'];
  const texts = Array.from(parse(svg).getElementsByTagName('text'));
  const lastProject = texts.find((node) => node.textContent.includes('"third-public-project"'));
  const languagesPane = texts.find((node) => node.textContent === '2 languages');
  assert.ok(Number(lastProject.getAttribute('y')) + 19 < Number(languagesPane.getAttribute('y')));
});
test('language caption changes when forks or mirrors are included', () => {
  const assets = renderAssets({ ...config, filters: { includeForks: true } }, data);
  assert.match(assets['profile-dark.svg'], /owned repositories \/ language bytes/);
  assert.doesNotMatch(assets['profile-dark.svg'], /owned source \/ language bytes/);
});

test('system details show every supplied item and leave contacts to the README', () => {
  const detailed = {
    ...config,
    system: {
      os: ['Windows 11', 'Android 13-14', 'Linux'],
      ides: ['VS Code', 'JetBrains IDEs', 'Pulsar'], terminals: ['Tabby', 'Termius'],
      programming: ['Python', 'TypeScript', 'JavaScript', 'Go', 'Rust'],
      mobile: ['Kotlin', 'Flutter', 'Dart'], daily: ['JSON', 'YAML', 'TOML', 'Lisp', 'Lua', 'Perl'],
      previous: ['PHP', 'C', 'Java'], human: ['Turkmen', 'Turkish', 'Russian', 'English'],
    },
    contact: { emails: ['mknsltnw@gmail.com'], socials: [{ label: 'LinkedIn', url: null }] },
  };
  for (const [name, svg] of Object.entries(renderAssets(detailed, data))) {
    if (!name.startsWith('profile-')) {
      continue;
    }
    const text = Array.from(parse(svg).getElementsByTagName('text')).map((node) => node.textContent).join(' ');
    for (const value of Object.values(detailed.system).flat()) {
      assert.ok(text.includes(`"${value}"`), `${name}: missing ${value}`);
    }
    assert.doesNotMatch(text, /mknsltnw|LinkedIn/);
  }
});

test('animations are short and stop for reduced motion', () => {
  const assets = renderAssets({ ...config, contact: { emails: ['a@example.com'] } }, data);
  for (const [name, svg] of Object.entries(assets).filter(([name]) => name.startsWith('profile-'))) {
    assert.doesNotMatch(svg, /infinite|<animate/, name);
    assert.match(svg, /@media \(prefers-reduced-motion: reduce\) \{ \.editor-cursor, \.terminal-command, \.language-bar \{ animation: none; \} \}/);
  }
  assert.match(assets['profile-dark.svg'], /class="editor-cursor"/);
  assert.match(assets['profile-dark.svg'], /class="terminal-command"/);
  assert.match(assets['profile-dark.svg'], /class="language-bar"/);
});

test('activity values retain their scope and unavailable counts never become zero', () => {
  const detailed = { ...config, system: { os: ['Linux'] }, activity: { enabled: true } };
  const unavailable = renderAssets(detailed, { ...data, activity: { status: 'unavailable', commits: null, additions: null, deletions: null } });
  assert.match(unavailable['profile-dark.svg'], /commits/);
  assert.match(unavailable['profile-dark.svg'], /&quot;unavailable&quot;/);
  assert.equal(unavailable['profile-dark.svg'].match(/&quot;unavailable&quot;/g).length, 2);
  const available = renderAssets(detailed, { ...data, activity: { status: 'ready', scope: 'authorized-branches', commits: 1234, additions: 45678, deletions: 912 } });
  assert.match(available['profile-dark.svg'], />1_234</);
  assert.match(available['profile-dark.svg'], />44_766</);
  assert.match(available['profile-dark.svg'], /public \+ private, all branches/);
  assert.doesNotMatch(available['profile-dark.svg'], /45_678|Lines added|Lines deleted/);
  const description = parse(available['profile-dark.svg']).getElementsByTagName('desc')[0].textContent;
  assert.match(description, /Commits: 1,234/);
  assert.match(description, /Lines of code: 44,766/);
  assert.match(description, /public \+ private, all branches/);
});

test('GitHub section shows commits, lines of code, stars, and followers with the commit size limit', () => {
  const detailed = { ...config, system: { os: ['Linux'] }, activity: { enabled: true, maxCommitLines: 10000 } };
  const assets = renderAssets(detailed, { ...data, activity: { status: 'ready', commits: 5, additions: 16, deletions: 7 } });
  for (const name of ['profile-dark.svg', 'profile-light.svg']) {
    const text = Array.from(parse(assets[name]).getElementsByTagName('text')).map((node) => node.textContent).join(' ');
    for (const value of ['commits', 'loc', 'stars', 'followers', '= 9', '= 21']) {
      assert.ok(text.includes(value), `${name}: missing ${value}`);
    }
    assert.match(text, /skips commits > 10,000 lines/);
    assert.doesNotMatch(text, /Public repos|= 16/);
  }
  const description = parse(assets['profile-dark.svg']).getElementsByTagName('desc')[0].textContent;
  assert.match(description, /Commits: 5\. Lines of code: 9\. Stars: 0\. Followers: 21/);
});

test('the updated date appears in every status bar only when supplied', () => {
  const assets = renderAssets(config, { ...data, updatedAt: '2026-09-28' });
  for (const [name, svg] of Object.entries(assets)) {
    assert.match(svg, /2026-09-28/, name);
  }
  assert.doesNotMatch(Object.values(renderAssets(config, data)).join(''), /updated /);
});

test('language meters use linguist colors and Other uses a neutral color', () => {
  const rows = ['Astro', 'QML', 'MDX', 'SCSS', 'Kotlin', 'Other'].map((name) => ({ name, percentage: 10 }));
  const svg = renderAssets(config, { ...data, languages: { rows, alsoUsed: ['Go'], scope: 'public' } })['profile-dark.svg'];
  for (const color of ['#ff5a03', '#44a51c', '#fcb32c', '#c6538c', '#A97BFF', '#7d8f87']) {
    assert.match(svg, new RegExp(`stroke="${color}" stroke-width="11"`));
  }
});

test('social badges render per theme without links inside the image', () => {
  const social = { ...config, contact: { emails: ['a@example.com'], socials: [
    { label: 'X', icon: 'x', handle: '@me', url: 'https://x.com/me' },
    { label: 'Other', url: 'https://example.com' },
  ] } };
  const assets = renderAssets(social, data);
  assert.deepEqual(Object.keys(assets).filter((name) => name.startsWith('badge-')).sort(), [
    'badge-email-dark.svg', 'badge-email-light.svg', 'badge-other-dark.svg', 'badge-other-light.svg', 'badge-x-dark.svg', 'badge-x-light.svg',
  ]);
  for (const name of ['badge-email-dark.svg', 'badge-x-light.svg']) {
    parse(assets[name]);
    assert.doesNotMatch(assets[name], /href|<script/);
  }
  assert.match(assets['badge-x-dark.svg'], />@me</);
  assert.match(assets['badge-email-light.svg'], />a@example\.com</);
});

test('badge identifiers stay unique for repeated icons', async () => {
  const { badgeItems } = await import('../scripts/svg.mjs');
  const items = badgeItems({ contact: { emails: ['a@example.com', 'b@example.com'], socials: [
    { label: 'X', icon: 'x', url: 'https://x.com/a' }, { label: 'X', icon: 'x', url: 'https://x.com/b' }, { label: 'Mail', icon: 'email', url: 'https://example.com' },
  ] } });
  assert.deepEqual(items.map((item) => item.id), ['email', 'email-2', 'x', 'x-2', 'email-3']);
});

test('negative line totals are shown as unavailable', () => {
  const detailed = { ...config, activity: { enabled: true } };
  const svg = renderAssets(detailed, { ...data, activity: { status: 'ready', commits: 3, additions: 100, deletions: 250 } })['profile-dark.svg'];
  assert.doesNotMatch(svg, /-150/);
  assert.match(parse(svg).getElementsByTagName('desc')[0].textContent, /Lines of code: Unavailable/);
});

test('shell text stays inside the card, and long values are shortened', () => {
  const detailed = {
    ...config, activity: { enabled: true, maxCommitLines: 10000 },
    system: { programming: ['Python', 'TypeScript', 'JavaScript', 'Go', 'Rust'], human: ['Turkmen', 'Turkish', 'Russian', 'English'] },
  };
  const release = { repository: 'Proxmox-Technical-Writing-Style-Skill-With-A-Much-Longer-Name', tag: 'v1.0.0-very-long-tag', publishedAt: '2026-09-01T00:00:00Z' };
  const svg = renderAssets(detailed, { ...data, latestRelease: release })['profile-dark.svg'];
  for (const node of Array.from(parse(svg).getElementsByTagName('text'))) {
    if (node.getAttribute('font-size') !== '13' || node.getAttribute('text-anchor')) {
      continue;
    }
    const right = Number(node.getAttribute('x')) + node.textContent.length * 13 * 0.6;
    assert.ok(right <= 848, `${node.textContent} ends at ${right}`);
  }
  assert.match(svg, /\.\.\.&quot;/);
  assert.match(parse(svg).getElementsByTagName('desc')[0].textContent, /Much-Longer-Name v1\.0\.0-very-long-tag/);
});

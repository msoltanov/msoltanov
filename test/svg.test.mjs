import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { escapeXml, renderAssets } from '../scripts/svg.mjs';

const config = {
  name: 'Mekan',
  username: 'msoltanov',
  editorName: 'ALABAY CODE',
  focus: [
    'Software Engineering',
    'Cybersecurity',
    'AI & Experimentation',
    'Infrastructure',
    'Open Source',
    'Growth Engineering',
  ],
};

const data = {
  publicRepos: 16,
  followers: 21,
  starsEarned: 0,
  projects: [
    {
      name: 'pdf-shrinker',
      description: 'Compress PDF files',
      url: 'https://github.com/msoltanov/pdf-shrinker',
    },
  ],
  languages: {
    rows: [
      { name: 'JavaScript', percentage: 60 },
      { name: 'Python', percentage: 40 },
    ],
    alsoUsed: [],
    scope: 'public',
  },
};

function parse(svg) {
  return new DOMParser({
    onError: (level, message) => {
      throw new Error(`${level}: ${message}`);
    },
  }).parseFromString(svg, 'image/svg+xml');
}

test('XML escapes markup, quotes, and invalid XML control characters', () => {
  assert.equal(
    escapeXml('<a x="1">&\'\u0000\u000b'),
    '&lt;a x=&quot;1&quot;&gt;&amp;&apos;',
  );
});

test('workshop frames include the complete scene and repeat without changing identity or totals', async () => {
  const { renderMotionFrame } = await import('../scripts/svg.mjs');
  assert.equal(typeof renderMotionFrame, 'function');
  const projects = [
    'pdf-shrinker',
    'Unstar',
    'Proxmox-Technical-Writing-Style-Skill',
  ].map((name) => ({ name, description: 'Public project', url: '' }));
  const source = { ...data, projects };
  const first = renderMotionFrame(config, source, 0);
  const middle = renderMotionFrame(config, source, 0.45);
  assert.deepEqual(renderMotionFrame(config, source, 1), first);
  for (const theme of ['dark', 'light']) {
    const name = `workshop-${theme}.svg`;
    for (const item of ['desk', 'monitor', 'server', 'notebook', 'alabay']) {
      assert.match(first[name], new RegExp(`data-scene="${item}"`));
    }
    assert.notEqual(middle[name], first[name]);
    parse(first[name]);
    for (let index = 1; index <= projects.length; index += 1) {
      assert.notEqual(
        first[`project-${index}-${theme}.svg`],
        middle[`project-${index}-${theme}.svg`],
      );
    }
  }
  const visibleFrames = (frames) =>
    Object.fromEntries(
      Object.entries(frames).map(([name, svg]) => [
        name,
        svg.replace(/<desc[\s\S]*?<\/desc>/, ''),
      ]),
    );
  assert.deepEqual(
    visibleFrames(renderMotionFrame(config, { ...source, followers: 500 }, 0)),
    visibleFrames(first),
  );
});

test('renders separate watch-mode, language, and public project assets in both themes', () => {
  const assets = renderAssets(config, data);
  assert.deepEqual(Object.keys(assets).sort(), [
    'languages-dark.svg',
    'languages-light.svg',
    'profile-dark.svg',
    'profile-light.svg',
    'project-1-dark.svg',
    'project-1-light.svg',
    'stats-dark.svg',
    'stats-light.svg',
    'workshop-dark.svg',
    'workshop-light.svg',
    'workshop-mobile-dark.svg',
    'workshop-mobile-light.svg',
  ]);
  for (const [name, svg] of Object.entries(assets)) {
    const document = parse(svg);
    assert.equal(document.documentElement.nodeName, 'svg');
    assert.equal(document.documentElement.getAttribute('role'), 'img');
    assert.ok(document.getElementsByTagName('title').length);
    assert.ok(document.getElementsByTagName('desc').length);
    assert.match(
      svg,
      name.startsWith('project-')
        ? /viewBox="0 0 128 112"/
        : name.startsWith('workshop-mobile-')
          ? /viewBox="0 0 480 /
          : /viewBox="0 0 860 /,
    );
    assert.doesNotMatch(
      svg.replace('http://www.w3.org/2000/svg', ''),
      /<script|<foreignObject|<image|<animate|https?:|onload=/i,
    );
  }
  const hero = parse(assets['profile-dark.svg']);
  assert.ok(Number(hero.documentElement.getAttribute('height')) <= 560);
  assert.match(assets['profile-dark.svg'], /class="intro-role-title"/);
  assert.doesNotMatch(assets['profile-dark.svg'], /data-scene="architecture"/);
  assert.equal(
    parse(assets['project-1-dark.svg']).getElementsByTagName('title')[0]
      .textContent,
    'pdf-shrinker',
  );
  assert.match(assets['project-1-dark.svg'], /Compress PDF files/);
});

test('all inserted strings remain text even with hostile public metadata', () => {
  const hostile = '<script>alert("x")</script>&\u0000';
  const assets = renderAssets(
    { ...config, name: hostile },
    {
      ...data,
      projects: [
        { name: hostile, description: hostile, url: 'javascript:alert(1)' },
      ],
      languages: {
        ...data.languages,
        rows: [{ name: hostile, percentage: 100 }],
      },
    },
  );
  assert.equal(Object.keys(assets).length, 12);
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
  assert.doesNotMatch(
    Object.values(first).join(''),
    /generated at|Date\(|2026-/,
  );
});

test('project names that match object properties still render as public repository names', () => {
  const projects = ['constructor', '__proto__', 'toString'].map((name) => ({
    name,
    description: 'Public repository',
    url: '',
  }));
  const assets = renderAssets(config, { ...data, projects });
  projects.forEach((project, index) => {
    assert.equal(
      parse(assets[`project-${index + 1}-light.svg`]).getElementsByTagName(
        'title',
      )[0].textContent,
      project.name,
    );
  });
});

test('empty languages and projects remain valid and claim no invented data', () => {
  const empty = renderAssets(config, {
    ...data,
    projects: [],
    languages: { rows: [], alsoUsed: [], scope: 'public' },
  })['profile-dark.svg'];
  assert.match(
    parse(empty).getElementsByTagName('desc')[0].textContent,
    /No language bytes reported\.$/,
  );
  const assets = renderAssets(config, {
    ...data,
    projects: [],
    languages: { rows: [], alsoUsed: [], scope: 'public' },
  });
  assert.match(assets['languages-dark.svg'], /No language bytes reported/);
  assert.ok(!Object.keys(assets).some((name) => name.startsWith('project-')));
  assert.doesNotMatch(assets['profile-dark.svg'], /NaN|Infinity|undefined/);
  assert.doesNotMatch(assets['profile-dark.svg'], /pdf-shrinker/);
});

test('full language diversity wraps and all labels survive in accessible text', () => {
  const alsoUsed = [
    'C++',
    'Jupyter Notebook',
    'Objective-C++',
    'Vim Script',
    'Shell',
    'Lua',
    'Dart',
    'HCL',
  ];
  const assets = renderAssets(config, {
    ...data,
    languages: { ...data.languages, alsoUsed, scope: 'authorized' },
  });
  assert.equal(Object.keys(assets).length, 12);
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

test('the compact introduction keeps project cards separate from environment details', () => {
  const projects = [
    'first-project',
    'second-project',
    'third-public-project',
  ].map((name) => ({ name, description: '', url: '' }));
  const detailed = {
    ...config,
    system: { os: ['Linux'], programming: ['Python', 'Go'] },
    activity: { enabled: true },
  };
  const svg = renderAssets(detailed, { ...data, projects })['profile-dark.svg'];
  const texts = Array.from(parse(svg).getElementsByTagName('text'))
    .map((node) => node.textContent)
    .join(' ');
  assert.doesNotMatch(texts, /third-public-project|\[system\]|cat mekan.toml/);
  assert.ok(Number(parse(svg).documentElement.getAttribute('height')) <= 560);
  assert.equal(
    parse(
      renderAssets(detailed, { ...data, projects })['project-3-dark.svg'],
    ).getElementsByTagName('title')[0].textContent,
    'third-public-project',
  );
});
test('language caption changes when forks or mirrors are included', () => {
  const assets = renderAssets(
    { ...config, filters: { includeForks: true } },
    data,
  );
  assert.match(
    assets['languages-dark.svg'],
    /owned repositories \/ language bytes/,
  );
  assert.doesNotMatch(
    assets['languages-dark.svg'],
    /owned source \/ language bytes/,
  );
});

test('system details remain accessible and leave contacts to the README', () => {
  const detailed = {
    ...config,
    system: {
      os: ['Windows 11', 'Android 13-14', 'Linux'],
      ides: ['VS Code', 'JetBrains IDEs', 'Pulsar'],
      terminals: ['Tabby', 'Termius'],
      programming: ['Python', 'TypeScript', 'JavaScript', 'Go', 'Rust'],
      mobile: ['Kotlin', 'Flutter', 'Dart'],
      daily: ['JSON', 'YAML', 'TOML', 'Lisp', 'Lua', 'Perl'],
      previous: ['PHP', 'C', 'Java'],
      human: ['Turkmen', 'Turkish', 'Russian', 'English'],
    },
    contact: {
      emails: ['mknsltnw@gmail.com'],
      socials: [{ label: 'LinkedIn', url: null }],
    },
  };
  for (const [name, svg] of Object.entries(renderAssets(detailed, data))) {
    if (!name.startsWith('profile-')) {
      continue;
    }
    const text = parse(svg).getElementsByTagName('desc')[0].textContent;
    for (const value of Object.values(detailed.system).flat()) {
      assert.ok(text.includes(value), `${name}: missing ${value}`);
    }
    assert.doesNotMatch(text, /mknsltnw|LinkedIn/);
  }
});

test('watch-mode motion repeats and stops for reduced motion', () => {
  const assets = renderAssets(
    { ...config, contact: { emails: ['a@example.com'] } },
    data,
  );
  for (const [name, svg] of Object.entries(assets).filter(([name]) =>
    name.startsWith('profile-'),
  )) {
    assert.doesNotMatch(svg, /<animate/, name);
    assert.match(svg, /cursor-blink 1s/);
    assert.match(
      svg,
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/,
    );
  }
  assert.match(assets['profile-dark.svg'], /class="editor-cursor"/);
  assert.match(assets['profile-dark.svg'], /class="intro-role-title"/);
  assert.match(assets['languages-dark.svg'], /class="language-bar"/);
  assert.doesNotMatch(assets['profile-dark.svg'], /architecture-travel/);
});

test('activity values retain their scope and unavailable counts never become zero', () => {
  const detailed = {
    ...config,
    system: { os: ['Linux'] },
    activity: { enabled: true },
  };
  const unavailable = renderAssets(detailed, {
    ...data,
    activity: {
      status: 'unavailable',
      commits: null,
      additions: null,
      deletions: null,
    },
  });
  assert.match(unavailable['stats-dark.svg'], /commits/);
  const unavailableText = Array.from(
    parse(unavailable['stats-dark.svg']).getElementsByTagName('text'),
  )
    .map((node) => node.textContent)
    .join(' ');
  assert.equal(unavailableText.match(/Unavailable/g).length, 2);
  const available = renderAssets(detailed, {
    ...data,
    activity: {
      status: 'ready',
      scope: 'authorized-branches',
      commits: 1234,
      additions: 45678,
      deletions: 912,
    },
  });
  assert.match(available['stats-dark.svg'], />1,234</);
  assert.match(available['stats-dark.svg'], />44,766</);
  assert.match(available['stats-dark.svg'], /public \+ private, all branches/);
  assert.doesNotMatch(
    available['stats-dark.svg'],
    /45_678|Lines added|Lines deleted/,
  );
  const description = parse(available['stats-dark.svg']).getElementsByTagName(
    'desc',
  )[0].textContent;
  assert.match(description, /Commits: 1,234/);
  assert.match(description, /Lines of code: 44,766/);
  assert.match(description, /public \+ private, all branches/);
});

test('GitHub section shows commits, lines of code, stars, and followers with the commit size limit', () => {
  const detailed = {
    ...config,
    system: { os: ['Linux'] },
    activity: { enabled: true, maxCommitLines: 10000 },
  };
  const assets = renderAssets(detailed, {
    ...data,
    activity: { status: 'ready', commits: 5, additions: 16, deletions: 7 },
  });
  for (const name of ['stats-dark.svg', 'stats-light.svg']) {
    const text = Array.from(parse(assets[name]).getElementsByTagName('text'))
      .map((node) => node.textContent)
      .join(' ');
    for (const value of [
      'commits',
      'lines of code',
      'stars',
      'followers',
      '9',
      '21',
    ]) {
      assert.ok(text.includes(value), `${name}: missing ${value}`);
    }
    assert.match(
      parse(assets[name]).getElementsByTagName('desc')[0].textContent,
      /skips commits > 10,000 lines/,
    );
    assert.doesNotMatch(text, /Public repos|= 16/);
  }
  const description = parse(assets['stats-dark.svg']).getElementsByTagName(
    'desc',
  )[0].textContent;
  assert.match(
    description,
    /Commits: 5\. Lines of code: 9\. Stars: 0\. Followers: 21/,
  );
});

test('the updated date appears in every status bar only when supplied', () => {
  const assets = renderAssets(config, { ...data, updatedAt: '2026-09-28' });
  for (const [name, svg] of Object.entries(assets).filter(([name]) =>
    name.startsWith('stats-'),
  )) {
    assert.match(svg, /2026-09-28/, name);
  }
  assert.doesNotMatch(
    Object.values(renderAssets(config, data)).join(''),
    /updated /,
  );
});

test('language meters use linguist colors and Other uses a neutral color', () => {
  const rows = ['Astro', 'QML', 'MDX', 'SCSS', 'Kotlin', 'Other'].map(
    (name) => ({ name, percentage: 10 }),
  );
  const svg = renderAssets(config, {
    ...data,
    languages: { rows, alsoUsed: ['Go'], scope: 'public' },
  })['languages-dark.svg'];
  for (const color of [
    '#ff5a03',
    '#44a51c',
    '#fcb32c',
    '#c6538c',
    '#A97BFF',
    '#7d8f87',
  ]) {
    assert.ok(svg.includes(color));
  }
});

test('social badges render per theme without links inside the image', () => {
  const social = {
    ...config,
    contact: {
      emails: ['a@example.com'],
      socials: [
        { label: 'X', icon: 'x', handle: '@me', url: 'https://x.com/me' },
        { label: 'Other', url: 'https://example.com' },
      ],
    },
  };
  const assets = renderAssets(social, data);
  assert.deepEqual(
    Object.keys(assets)
      .filter((name) => name.startsWith('badge-'))
      .sort(),
    [
      'badge-email-dark.svg',
      'badge-email-light.svg',
      'badge-other-dark.svg',
      'badge-other-light.svg',
      'badge-x-dark.svg',
      'badge-x-light.svg',
    ],
  );
  for (const name of ['badge-email-dark.svg', 'badge-x-light.svg']) {
    parse(assets[name]);
    assert.doesNotMatch(assets[name], /href|<script/);
  }
  assert.match(assets['badge-x-dark.svg'], />@me</);
  assert.match(assets['badge-email-light.svg'], />a@example\.com</);
});

test('badge identifiers stay unique for repeated icons', async () => {
  const { badgeItems } = await import('../scripts/svg.mjs');
  const items = badgeItems({
    contact: {
      emails: ['a@example.com', 'b@example.com'],
      socials: [
        { label: 'X', icon: 'x', url: 'https://x.com/a' },
        { label: 'X', icon: 'x', url: 'https://x.com/b' },
        { label: 'Mail', icon: 'email', url: 'https://example.com' },
      ],
    },
  });
  assert.deepEqual(
    items.map((item) => item.id),
    ['email', 'email-2', 'x', 'x-2', 'email-3'],
  );
});

test('negative line totals are shown as unavailable', () => {
  const detailed = { ...config, activity: { enabled: true } };
  const svg = renderAssets(detailed, {
    ...data,
    activity: { status: 'ready', commits: 3, additions: 100, deletions: 250 },
  })['profile-dark.svg'];
  assert.doesNotMatch(svg, /-150/);
  assert.match(
    parse(svg).getElementsByTagName('desc')[0].textContent,
    /Lines of code: Unavailable/,
  );
});

test('large statistics fit their columns at desktop and mobile text sizes', () => {
  const svg = renderAssets(
    { ...config, activity: { enabled: true } },
    {
      ...data,
      followers: Number.MAX_SAFE_INTEGER,
      starsEarned: Number.MAX_SAFE_INTEGER,
      activity: {
        status: 'ready',
        commits: Number.MAX_SAFE_INTEGER,
        additions: Number.MAX_SAFE_INTEGER,
        deletions: 0,
      },
    },
  )['stats-dark.svg'];
  const metrics = Array.from(parse(svg).getElementsByTagName('text')).filter(
    (node) => node.getAttribute('class') === 'hero-stat',
  );
  assert.equal(metrics.length, 4);
  for (const node of metrics) {
    const sizes = [
      Number(node.getAttribute('font-size')),
      Number(
        (node.getAttribute('style') ?? '').match(
          /--metric-size:\s*([\d.]+)/,
        )?.[1] ?? 28,
      ),
    ];
    for (const size of sizes) {
      assert.ok(
        node.textContent.length * size * 0.6 <= 180,
        `The statistic exceeds its column at ${size}px.`,
      );
    }
  }
});

test('shell text stays inside the card, and long values are shortened', () => {
  const detailed = {
    ...config,
    activity: { enabled: true, maxCommitLines: 10000 },
    system: {
      programming: ['Python', 'TypeScript', 'JavaScript', 'Go', 'Rust'],
      human: ['Turkmen', 'Turkish', 'Russian', 'English'],
    },
  };
  const release = {
    repository: 'Proxmox-Technical-Writing-Style-Skill-With-A-Much-Longer-Name',
    tag: 'v1.0.0-very-long-tag',
    publishedAt: '2026-09-01T00:00:00Z',
  };
  const svg = renderAssets(detailed, { ...data, latestRelease: release })[
    'stats-dark.svg'
  ];
  for (const node of Array.from(parse(svg).getElementsByTagName('text'))) {
    if (
      node.getAttribute('font-size') !== '13' ||
      node.getAttribute('text-anchor')
    ) {
      continue;
    }
    const right =
      Number(node.getAttribute('x')) + node.textContent.length * 13 * 0.6;
    assert.ok(right <= 848, `${node.textContent} ends at ${right}`);
  }
  assert.match(svg, /\.\.\./);
  assert.match(
    parse(
      renderAssets(detailed, { ...data, latestRelease: release })[
        'profile-dark.svg'
      ],
    ).getElementsByTagName('desc')[0].textContent,
    /Much-Longer-Name v1\.0\.0-very-long-tag/,
  );
});

test('the animated hero contains the identity and seasonal scene in one composition', () => {
  const detailed = {
    ...config,
    activity: { enabled: true, maxCommitLines: 10000 },
  };
  const assets = renderAssets(detailed, {
    ...data,
    activity: { status: 'ready', commits: 42, additions: 100, deletions: 10 },
  });
  for (const theme of ['dark', 'light']) {
    const intro = parse(assets[`profile-${theme}.svg`]);
    const stats = parse(assets[`stats-${theme}.svg`] ?? '<svg/>');
    assert.equal(intro.documentElement.getAttribute('height'), '540');
    assert.ok(stats.getElementsByTagName('text').length > 0);
    assert.equal(
      Array.from(intro.getElementsByTagName('text')).some(
        (node) => node.getAttribute('class') === 'hero-stat',
      ),
      false,
    );
    const visible = Array.from(stats.getElementsByTagName('text'))
      .map((node) => node.textContent)
      .join(' ');
    assert.match(visible, /42.*commits.*90.*lines of code/);
    assert.match(assets[`workshop-${theme}.svg`], /data-frame="top"/);
    assert.match(assets[`workshop-${theme}.svg`], /class="intro-title"/);
    assert.match(assets[`workshop-${theme}.svg`], /data-scene="tree"/);
    assert.match(
      assets[`workshop-${theme}.svg`],
      /data-composition="integrated-workspace"/,
    );
    assert.match(
      assets[`workshop-${theme}.svg`],
      /transform="translate\(270 165\) scale\(0.68\)"/,
    );
    assert.doesNotMatch(
      assets[`workshop-${theme}.svg`],
      /FIELDNOTES|SYSTEMS\. DIRECTION\. DELIVERY\./,
    );
    assert.match(assets[`profile-${theme}.svg`], /data-frame="top"/);
    assert.match(assets[`stats-${theme}.svg`], /data-frame="bottom"/);
    assert.doesNotMatch(assets[`profile-${theme}.svg`], /architecture-map/);
    assert.doesNotMatch(assets[`profile-${theme}.svg`], /architecture-signal/);
  }
});

test('the combined GIF frames keep identity text fixed while the sleeping dog breathes', async () => {
  const { renderMotionFrame } = await import('../scripts/svg.mjs');
  const frames = [0.2, 0.6].map((phase) =>
    parse(renderMotionFrame(config, data, phase)['workshop-dark.svg']),
  );
  const nodes = (document, className) =>
    Array.from(document.getElementsByTagName('text'))
      .filter((node) => node.getAttribute('class') === className)
      .map((node) => node.toString());
  for (const className of [
    'intro-greeting',
    'intro-title',
    'intro-summary',
    'intro-principles',
  ]) {
    assert.deepEqual(nodes(frames[0], className), nodes(frames[1], className));
    assert.ok(nodes(frames[0], className).length);
  }
  const breathing = (document) =>
    Array.from(document.getElementsByTagName('g'))
      .find((node) => node.getAttribute('data-motion') === 'breathing')
      .getAttribute('transform');
  assert.notEqual(breathing(frames[0]), breathing(frames[1]));
});

test('the introduction rotates one approved role at a time and keeps all roles accessible', async () => {
  const { renderMotionFrame } = await import('../scripts/svg.mjs');
  const roles = [
    'Software Engineer',
    'Platform Engineer',
    'Growth Engineer',
    'Security Researcher',
    'AI & Experimentation',
  ];
  const profile = { ...config, editorName: "Mekan's Desk", focus: roles };
  const first = renderMotionFrame(profile, data, 0.1);
  for (const [index, role] of roles.entries()) {
    for (const theme of ['dark', 'light']) {
      const svg = renderMotionFrame(
        profile,
        data,
        (index + 0.5) / roles.length,
      )[`workshop-${theme}.svg`];
      const document = parse(svg);
      const titles = Array.from(document.getElementsByTagName('text')).filter(
        (node) => node.getAttribute('class') === 'intro-role-title',
      );
      assert.equal(titles.length, 1);
      assert.equal(titles[0].textContent, role);
      assert.equal(titles[0].parentNode.getAttribute('data-role'), role);
      assert.equal(titles[0].parentNode.getAttribute('opacity'), '1.000');
      const right =
        Number(titles[0].getAttribute('x')) +
        role.length * Number(titles[0].getAttribute('font-size')) * 0.6;
      assert.ok(right < 330);
      const description = document.getElementsByTagName('desc')[0].textContent;
      for (const title of roles) {
        assert.ok(description.includes(title));
      }
      assert.match(
        document.getElementsByTagName('title')[0].textContent,
        /^Mekan's Desk/,
      );
      assert.doesNotMatch(
        svg,
        /alabay --watch|SOFTWARE \/ GROWTH \/ DEVOPS|class="intro-focus"/,
      );
    }
  }
  assert.deepEqual(renderMotionFrame(profile, data, 1.1), first);
});

test('terminal roles type, pause and erase while the cursor follows the text', async () => {
  const { renderMotionFrame } = await import('../scripts/svg.mjs');
  const roles = [
    'Software Engineer',
    'Platform Engineer',
    'Growth Engineer',
    'Security Researcher',
    'AI & Experimentation',
  ];
  const profile = { ...config, focus: roles };
  const positions = [0, 0.08, 0.28, 0.55, 0.93, 0.98];
  const samples = positions.map((progress) =>
    parse(
      renderMotionFrame(profile, data, progress / roles.length)[
        'workshop-dark.svg'
      ],
    ),
  );
  const title = (document) =>
    Array.from(document.getElementsByTagName('text')).find(
      (node) => node.getAttribute('class') === 'intro-role-title',
    );
  const text = samples.map((sample) => title(sample).textContent);
  assert.equal(text[0], '');
  assert.ok(text[1].length > 0 && text[1].length < text[2].length);
  assert.ok(text[2].length < text[3].length);
  assert.equal(text[3], roles[0]);
  assert.ok(text[4].length < text[3].length && text[4].length > text[5].length);
  for (const [index, sample] of samples.entries()) {
    assert.ok(roles[0].startsWith(text[index]));
    assert.equal(title(sample).parentNode.getAttribute('opacity'), '1.000');
    assert.equal(title(sample).parentNode.getAttribute('transform'), null);
    const cursor = Array.from(sample.getElementsByTagName('rect')).find(
      (node) => node.getAttribute('class') === 'editor-cursor',
    );
    const expected =
      Number(title(sample).getAttribute('x')) +
      text[index].length *
        Number(title(sample).getAttribute('font-size')) *
        0.6 +
      2;
    assert.ok(Math.abs(Number(cursor.getAttribute('x')) - expected) < 0.001);
    const fixed = (document) =>
      Array.from(document.getElementsByTagName('text'))
        .filter((node) =>
          ['intro-title', 'intro-handle', 'intro-summary'].includes(
            node.getAttribute('class'),
          ),
        )
        .map((node) => node.toString());
    assert.deepEqual(fixed(sample), fixed(samples[0]));
  }
  const next = parse(
    renderMotionFrame(profile, data, 1 / roles.length)['workshop-dark.svg'],
  );
  assert.equal(title(next).parentNode.getAttribute('data-role'), roles[1]);
  assert.equal(title(next).textContent, '');
});

test('every seasonal hero omits the direction systems delivery diagram and preserves the workspace', async () => {
  const { renderMotionFrame } = await import('../scripts/svg.mjs');
  for (const season of ['winter', 'spring', 'summer', 'autumn']) {
    for (const phase of [0.1, 0.6]) {
      const frames = renderMotionFrame(config, { ...data, season }, phase);
      for (const theme of ['dark', 'light']) {
        const svg = frames[`workshop-${theme}.svg`];
        assert.doesNotMatch(
          svg,
          /data-scene="architecture"|architecture-map|architecture-signal|architecture-travel/,
        );
        const labels = Array.from(parse(svg).getElementsByTagName('text')).map(
          (node) => node.textContent,
        );
        for (const label of ['direction', 'systems', 'delivery']) {
          assert.ok(!labels.includes(label));
        }
        assert.match(svg, /Systems\. Direction\. Delivery\./);
        assert.match(svg, /data-scene="tree"/);
        assert.match(svg, /data-scene="monitor"/);
        assert.match(svg, /class="intro-role-title"/);
      }
    }
  }
  for (const svg of Object.values(renderAssets(config, data))) {
    assert.doesNotMatch(
      svg,
      /architecture-map|architecture-signal|architecture-travel/,
    );
  }
});

test('the larger workspace leaves space for current languages and learning details', () => {
  const profile = {
    ...config,
    workingWith: ['TypeScript', 'Python', 'Go', 'Rust'],
    currentlyLearning: 'Rust',
  };
  const assets = renderAssets(profile, data);
  for (const theme of ['dark', 'light']) {
    const document = parse(assets[`workshop-${theme}.svg`]);
    assert.equal(document.documentElement.getAttribute('height'), '540');
    const scene = Array.from(document.getElementsByTagName('g')).find(
      (node) =>
        node.getAttribute('data-composition') === 'integrated-workspace',
    );
    const placement = scene
      .getAttribute('transform')
      .match(/translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)/);
    assert.ok(Number(placement[3]) >= 0.65);
    assert.ok(Number(placement[1]) + 814 * Number(placement[3]) <= 828);
    const texts = Array.from(document.getElementsByTagName('text')).map(
      (node) => node.textContent,
    );
    const working = Array.from(document.getElementsByTagName('text'))
      .filter((node) => node.getAttribute('class') === 'intro-working-with')
      .map((node) => node.textContent)
      .join(' ');
    assert.equal(working, 'Working with TypeScript, Python, Go and Rust.');
    assert.ok(texts.includes('Currently learning Rust.'));
    const accessible = document.getElementsByTagName('desc')[0].textContent;
    assert.match(accessible, /Working with TypeScript, Python, Go and Rust/);
    assert.match(accessible, /Currently learning Rust/);
    assert.doesNotMatch(
      assets[`workshop-${theme}.svg`],
      /architecture-map|architecture-signal/,
    );
  }
});

test('the introduction uses the full-name greeting and approved employment and learning copy in order', () => {
  const profile = {
    ...config,
    name: 'Mekan Soltanov',
    employment: {
      role: 'Software Engineer / Platform Engineer',
      company: 'Yupekchi',
      location: 'Turkmenistan',
    },
    workingWith: ['TypeScript', 'Python', 'Go', 'Rust'],
    currentlyLearning: 'about Rust and building desktop apps',
  };
  for (const theme of ['dark', 'light']) {
    const svg = renderAssets(profile, data)[`workshop-${theme}.svg`];
    const document = parse(svg);
    const included = [
      'intro-greeting',
      'intro-title',
      'intro-employment',
      'intro-working-with',
      'intro-learning',
      'intro-summary',
    ];
    const copy = Array.from(document.getElementsByTagName('text'))
      .filter((node) => included.includes(node.getAttribute('class')))
      .map((node) => node.textContent)
      .join(' ');
    const phrases = [
      'Hello, my name is Mekan Soltanov.',
      'Working as Software Engineer / Platform Engineer at Yupekchi in Turkmenistan.',
      'Working with TypeScript, Python, Go and Rust.',
      'Currently learning about Rust and building desktop apps.',
      'Building software and platforms.',
      'Connecting engineering with growth.',
    ];
    let previous = -1;
    for (const phrase of phrases) {
      const index = copy.indexOf(phrase);
      assert.ok(index > previous, `Missing or misplaced phrase: ${phrase}`);
      previous = index;
    }
    assert.doesNotMatch(
      svg,
      /I build software and platforms|and explore security and AI/,
    );
    assert.match(
      document.getElementsByTagName('desc')[0].textContent,
      /Working as Software Engineer \/ Platform Engineer at Yupekchi in Turkmenistan/,
    );
  }
});

test('the centered greeting has four headlines and one leadership label beside the title row', () => {
  const profile = {
    ...config,
    name: 'Mekan Soltanov',
    focus: [
      'Software Engineer',
      'Platform Engineer',
      'Growth Engineer',
      'AI & Experimentation',
    ],
    employment: {
      role: 'Software Engineer / Platform Engineer',
      company: 'Yupekchi',
    },
    workingWith: ['TypeScript', 'JavaScript', 'Python', 'Go'],
    currentlyLearning: 'about Rust and building desktop apps',
  };
  for (const theme of ['dark', 'light']) {
    const svg = renderAssets(profile, data)[`workshop-${theme}.svg`];
    const document = parse(svg);
    const texts = Array.from(document.getElementsByTagName('text'));
    for (const name of ['intro-greeting', 'intro-title']) {
      const text = texts.find((node) => node.getAttribute('class') === name);
      assert.equal(text.getAttribute('x'), '430');
      assert.equal(text.getAttribute('text-anchor'), 'middle');
    }
    assert.equal(
      texts.filter((node) => node.getAttribute('class') === 'intro-handle')
        .length,
      0,
    );
    const principles = texts.filter(
      (node) => node.getAttribute('class') === 'intro-principles',
    );
    assert.equal(principles.length, 1);
    assert.equal(principles[0].textContent, 'Systems. Direction. Delivery.');
    assert.equal(principles[0].getAttribute('y'), '181');
    assert.equal(principles[0].getAttribute('text-anchor'), 'end');
    assert.equal(
      texts.find((node) => node.getAttribute('class') === 'intro-role-title')
        .textContent,
      profile.focus[0],
    );
    const working = texts
      .filter((node) => node.getAttribute('class') === 'intro-working-with')
      .map((node) => node.textContent)
      .join(' ');
    assert.equal(
      working,
      'Working with TypeScript, JavaScript, Python and Go.',
    );
    assert.doesNotMatch(
      svg,
      /@msoltanov|Turkmenistan|undefined|Security Research/,
    );
    assert.match(
      document.getElementsByTagName('desc')[0].textContent,
      /Currently learning about Rust and building desktop apps/,
    );
  }
});

test('headlines type steadily before holding the complete title', async () => {
  const { renderMotionFrame } = await import('../scripts/svg.mjs');
  const profile = {
    ...config,
    focus: [
      'Full Stack Senior Software Engineer',
      'Platform Engineer',
      'Growth Engineer',
    ],
  };
  const title = (phase) => {
    const document = parse(
      renderMotionFrame(profile, data, phase)['workshop-dark.svg'],
    );
    return Array.from(document.getElementsByTagName('text')).find(
      (node) => node.getAttribute('class') === 'intro-role-title',
    );
  };
  const writing = title(0.3 / profile.focus.length);
  assert.equal(writing.parentNode.getAttribute('data-state'), 'typing');
  assert.ok(writing.textContent.length < profile.focus[0].length);
  const holding = title(0.6 / profile.focus.length);
  assert.equal(holding.textContent, profile.focus[0]);
  assert.equal(holding.parentNode.getAttribute('data-state'), 'holding');
  assert.ok(Number(holding.getAttribute('font-size')) >= 17);
});

test('each complete headline stays visible for at least three seconds in both layouts', async () => {
  const { renderMotionFrame } = await import('../scripts/svg.mjs');
  const profile = {
    ...config,
    focus: [
      'Software Engineer',
      'Platform Engineer',
      'Growth Engineer',
      'AI & Experimentation',
    ],
  };
  for (let index = 0; index < profile.focus.length; index += 1) {
    for (const seconds of [2.2, 3.2, 4.2, 5.2]) {
      const frames = renderMotionFrame(
        profile,
        data,
        (index * 6 + seconds) / 24,
      );
      for (const layout of ['', '-mobile']) {
        for (const theme of ['dark', 'light']) {
          const document = parse(frames[`workshop${layout}-${theme}.svg`]);
          const title = Array.from(document.getElementsByTagName('text')).find(
            (node) => node.getAttribute('class') === 'intro-role-title',
          );
          assert.equal(title.textContent, profile.focus[index]);
          assert.equal(title.parentNode.getAttribute('data-state'), 'holding');
        }
      }
    }
  }
});

test('project illustrations use separate animation phases without changing their static pose or loop', async () => {
  const { renderMotionFrame } = await import('../scripts/svg.mjs');
  const source = {
    ...data,
    projects: Array.from({ length: 3 }, () => ({
      name: 'same-project',
      description: 'Public project',
      url: '',
    })),
  };
  const first = renderMotionFrame(config, source, 0);
  const staticAssets = renderAssets(config, source);
  assert.deepEqual(renderMotionFrame(config, source, 1), first);
  assert.deepEqual(
    renderMotionFrame(config, structuredClone(source), 0.3),
    renderMotionFrame(config, source, 0.3),
  );
  for (const theme of ['dark', 'light']) {
    const strokes = source.projects.map((project, index) => {
      const document = parse(first[`project-${index + 1}-${theme}.svg`]);
      return Array.from(document.getElementsByTagName('path'))
        .find(
          (node) => node.getAttribute('data-animation') === 'notebook-write',
        )
        .getAttribute('d');
    });
    assert.equal(new Set(strokes).size, source.projects.length);
    assert.equal(
      staticAssets[`project-1-${theme}.svg`],
      staticAssets[`project-2-${theme}.svg`],
    );
  }
});

test('season names stay in scene metadata without visible season titles', () => {
  for (const season of ['winter', 'spring', 'summer', 'autumn']) {
    const svg = renderAssets(config, { ...data, season })['workshop-light.svg'];
    const texts = Array.from(parse(svg).getElementsByTagName('text')).map(
      (node) => node.textContent,
    );
    assert.ok(
      texts.every((value) => !/^(?:winter|spring|summer|autumn)$/i.test(value)),
    );
    assert.match(svg, new RegExp(`data-season="${season}"`));
  }
});

test('seasonal accents match the cursor and project actions without changing language colors', () => {
  for (const theme of ['dark', 'light']) {
    const accents = [];
    for (const season of ['winter', 'spring', 'summer', 'autumn']) {
      const assets = renderAssets(config, { ...data, season });
      const document = parse(assets[`workshop-${theme}.svg`]);
      const cursor = Array.from(document.getElementsByTagName('rect')).find(
        (node) => node.getAttribute('class') === 'editor-cursor',
      );
      const accent = cursor.getAttribute('fill');
      accents.push(accent);
      const project = parse(assets[`project-1-${theme}.svg`]);
      const marker = Array.from(project.getElementsByTagName('*')).find(
        (node) => node.getAttribute('class') === 'project-accent',
      );
      assert.equal(marker.getAttribute('fill'), accent);
    }
    assert.equal(new Set(accents).size, 4);
  }
});

test('project illustrations stay small and leave their names and descriptions to native text', () => {
  const svg = renderAssets(config, data)['project-1-dark.svg'];
  const document = parse(svg);
  assert.equal(document.documentElement.getAttribute('width'), '128');
  assert.equal(document.documentElement.getAttribute('height'), '112');
  assert.equal(document.getElementsByTagName('text').length, 0);
  assert.match(svg, /data-animation="pdf-compress"/);
  assert.match(svg, /Compress PDF files/);
});

test('supporting introduction copy uses the brighter text color without moving its center', () => {
  const document = parse(renderAssets(config, data)['workshop-dark.svg']);
  const text = Array.from(document.getElementsByTagName('text'));
  const primary = text
    .find((node) => node.getAttribute('class') === 'intro-greeting')
    .getAttribute('fill');
  for (const className of [
    'intro-working-with',
    'intro-learning',
    'intro-summary',
  ]) {
    assert.ok(
      text
        .filter((node) => node.getAttribute('class') === className)
        .every((node) => node.getAttribute('fill') === primary),
    );
  }
});

test('the public introduction omits employment and centers its supporting copy beside the workspace', async () => {
  const { readFile } = await import('node:fs/promises');
  const profile = JSON.parse(
    await readFile(new URL('../config/profile.json', import.meta.url), 'utf8'),
  );
  for (const theme of ['dark', 'light']) {
    const svg = renderAssets(profile, data)[`workshop-${theme}.svg`];
    assert.doesNotMatch(svg, /Working as|Yupekchi|intro-employment/);
    const texts = Array.from(parse(svg).getElementsByTagName('text'));
    const first = Number(
      texts
        .find((node) => node.getAttribute('class') === 'intro-working-with')
        .getAttribute('y'),
    );
    const last = Number(
      texts
        .filter((node) => node.getAttribute('class') === 'intro-summary')
        .at(-1)
        .getAttribute('y'),
    );
    const footer = texts.find(
      (node) => node.textContent === 'ARCHITECTURE / DECISIONS / DELIVERY',
    );
    const role = texts.find(
      (node) => node.getAttribute('class') === 'intro-role-title',
    );
    const center = (first + last) / 2;
    const availableCenter =
      (Number(role.getAttribute('y')) + Number(footer.getAttribute('y'))) / 2;
    assert.ok(
      Math.abs(center - availableCenter) < 20,
      'Supporting copy must sit near the vertical center below the headline.',
    );
  }
});

test('the approved four headlines type in order and repeat with AI after Growth Engineer', async () => {
  const { readFile } = await import('node:fs/promises');
  const { renderMotionFrame } = await import('../scripts/svg.mjs');
  const profile = JSON.parse(
    await readFile(new URL('../config/profile.json', import.meta.url), 'utf8'),
  );
  const title = (phase) =>
    Array.from(
      parse(
        renderMotionFrame(profile, data, phase)['workshop-dark.svg'],
      ).getElementsByTagName('text'),
    ).find((node) => node.getAttribute('class') === 'intro-role-title')
      .textContent;
  assert.deepEqual(
    [0, 1, 2, 3].map((index) => title((index + 0.65) / 4)),
    [
      'Software Engineer',
      'Platform Engineer',
      'Growth Engineer',
      'AI & Experimentation',
    ],
  );
  assert.equal(title(1 + 0.65 / 4), 'Software Engineer');
});

test('mobile heroes preserve the complete introduction with readable type in one continuous scene', async () => {
  const { readFile } = await import('node:fs/promises');
  const profile = JSON.parse(
    await readFile(new URL('../config/profile.json', import.meta.url), 'utf8'),
  );
  const assets = renderAssets(profile, data);
  for (const theme of ['dark', 'light']) {
    const document = parse(assets[`workshop-mobile-${theme}.svg`]);
    assert.equal(document.documentElement.getAttribute('width'), '480');
    assert.equal(document.documentElement.getAttribute('height'), '860');
    const texts = Array.from(document.getElementsByTagName('text'));
    const body = texts.filter((node) =>
      ['intro-working-with', 'intro-learning', 'intro-summary'].includes(
        node.getAttribute('class'),
      ),
    );
    assert.ok(
      body.every((node) => Number(node.getAttribute('font-size')) >= 24),
    );
    const content = body.map((node) => node.textContent).join(' ');
    assert.equal(
      content,
      'Working with TypeScript, JavaScript, Python and Go. Currently learning about Rust and building desktop apps. Building software and platforms. Connecting engineering with growth.',
    );
    assert.equal(
      texts
        .find((node) => node.getAttribute('class') === 'intro-title')
        .getAttribute('x'),
      '240',
    );
    const role = texts.find(
      (node) => node.getAttribute('class') === 'intro-role-title',
    );
    assert.ok(Number(role.getAttribute('font-size')) >= 26);
    assert.ok(
      Number(role.getAttribute('x')) +
        Number(role.getAttribute('textLength')) <=
        456,
    );
    const workspace = Array.from(document.getElementsByTagName('g')).find(
      (node) =>
        node.getAttribute('data-composition') === 'integrated-workspace',
    );
    assert.equal(workspace.getAttribute('data-layout'), 'mobile');
    assert.equal(
      workspace.getAttribute('transform'),
      'translate(-3 540) scale(0.56)',
    );
    assert.ok(
      Number(workspace.getAttribute('data-lamp-x')) > 90 &&
        Number(workspace.getAttribute('data-lamp-x')) < 96,
    );
    assert.ok(
      Number(workspace.getAttribute('data-lamp-y')) > 80 &&
        Number(workspace.getAttribute('data-lamp-y')) < 85,
    );
    for (const scene of [
      'tree',
      'desk',
      'monitor',
      'server',
      'notebook',
      'alabay',
      'desk-lamp',
    ]) {
      assert.match(
        assets[`workshop-mobile-${theme}.svg`],
        new RegExp(`data-scene="${scene}"`),
      );
    }
  }
});

test('mobile introduction height adapts to extra valid copy without truncating it or breaking the animation loop', async () => {
  const { renderMotionFrame } = await import('../scripts/svg.mjs');
  const profile = {
    ...config,
    workingWith: ['TypeScript', 'JavaScript', 'Python', 'Go'],
    currentlyLearning: 'about Rust and building desktop apps',
    employment: {
      role: 'Software Engineer / Platform Engineer',
      company: 'Yupekchi',
    },
  };
  const first = renderMotionFrame(profile, data, 0);
  const loop = renderMotionFrame(profile, data, 1);
  const middle = renderMotionFrame(profile, data, 0.4);
  for (const theme of ['dark', 'light']) {
    const name = `workshop-mobile-${theme}.svg`;
    assert.equal(first[name], loop[name]);
    assert.notEqual(first[name], middle[name]);
    const document = parse(first[name]);
    assert.ok(Number(document.documentElement.getAttribute('height')) > 860);
    const employment = Array.from(document.getElementsByTagName('text'))
      .filter((node) => node.getAttribute('class') === 'intro-employment')
      .map((node) => node.textContent)
      .join(' ');
    assert.equal(
      employment,
      'Working as Software Engineer / Platform Engineer at Yupekchi.',
    );
    assert.doesNotMatch(first[name], /NaN|undefined|<script/);
  }
});

test('the phone hero frame stays inside its narrower canvas', () => {
  const document = parse(
    renderAssets(config, data)['workshop-mobile-dark.svg'],
  );
  const frame = document
    .getElementsByTagName('g')[0]
    .getElementsByTagName('path')[0]
    .getAttribute('d');
  assert.match(frame, /H469\.5Q479\.5 0\.5 479\.5 10\.5V/);
  assert.doesNotMatch(frame, /849\.5|859\.5/);
});

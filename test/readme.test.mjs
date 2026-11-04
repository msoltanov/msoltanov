import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the combined hero selects shared phone artwork before the desktop theme fallback', async () => {
  const readme = await readFile(
    new URL('../README.md', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(readme, /gh-(?:dark|light)-mode-only|-still/);
  const opening =
    readme
      .split('<!-- opening:start -->')[1]
      ?.split('<!-- opening:end -->')[0] ?? '';
  assert.doesNotMatch(opening, /assets\/profile-(?:dark|light)\.svg/);
  const picture = readme
    .slice(
      readme.lastIndexOf(
        '<picture>',
        readme.indexOf('src="assets/workshop-light.gif"'),
      ),
    )
    .split('</picture>')[0];
  const sources = [
    ...picture.matchAll(/<source media="([^"]+)" srcset="assets\/([^"]+)">/g),
  ].map(([, media, file]) => [media, file]);
  assert.deepEqual(sources, [
    [
      '(max-width: 600px) and (prefers-reduced-motion: reduce)',
      'workshop-mobile-dark.svg',
    ],
    ['(prefers-reduced-motion: reduce)', 'workshop-dark.svg'],
    ['(max-width: 600px)', 'workshop-mobile-dark.gif'],
    ['(prefers-color-scheme: dark)', 'workshop-dark.gif'],
  ]);
});

test('the shared mobile hero keeps its width query through GitHub theme rewriting and has a static fallback', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const svg = '<svg><desc id="desc">Readable introduction.</desc></svg>';
  const assets = { 'profile-light.svg': '<svg/>' };
  for (const name of ['workshop', 'workshop-mobile']) {
    for (const theme of ['dark', 'light']) {
      assets[`${name}-${theme}.svg`] = svg;
      assets[`${name}-${theme}.gif`] = Buffer.from('GIF89a');
    }
  }
  const input = '<!-- workshop:start -->\n<!-- workshop:end -->\n';
  const result = updateReadme(input, {}, assets);
  assert.ok(
    result.indexOf('workshop-mobile-dark.gif') <
      result.indexOf('workshop-dark.gif'),
  );
  assert.match(
    result,
    /media="\(max-width: 600px\)" srcset="assets\/workshop-mobile-dark.gif"/,
  );
  assert.doesNotMatch(
    result,
    /max-width: 600px\) and \(prefers-color-scheme|workshop-mobile-light/,
  );
  assert.equal([...result.matchAll(/<img /g)].length, 1);
  assert.equal(updateReadme(result, {}, assets), result);
  delete assets['workshop-mobile-dark.gif'];
  const fallback = updateReadme(result, {}, assets);
  assert.match(fallback, /workshop-mobile-dark.svg/);
  assert.doesNotMatch(fallback, /workshop-mobile-light/);
  assert.doesNotMatch(fallback, /workshop-mobile-.*\.gif/);
});

test('reduced motion selects static mobile and desktop heroes before animated and theme sources', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const svg = '<svg><desc id="desc">Readable introduction.</desc></svg>';
  const assets = { 'profile-light.svg': '<svg/>' };
  for (const name of ['workshop', 'workshop-mobile']) {
    for (const theme of ['dark', 'light']) {
      assets[`${name}-${theme}.svg`] = svg;
      assets[`${name}-${theme}.gif`] = Buffer.from('GIF89a');
    }
  }
  const result = updateReadme(
    '<!-- workshop:start -->\n<!-- workshop:end -->\n',
    {},
    assets,
  );
  const sources = [
    ...result.matchAll(/<source media="([^"]+)" srcset="assets\/([^"]+)">/g),
  ].map(([, media, file]) => [media, file]);
  assert.deepEqual(sources, [
    [
      '(max-width: 600px) and (prefers-reduced-motion: reduce)',
      'workshop-mobile-dark.svg',
    ],
    ['(prefers-reduced-motion: reduce)', 'workshop-dark.svg'],
    ['(max-width: 600px)', 'workshop-mobile-dark.gif'],
    ['(prefers-color-scheme: dark)', 'workshop-dark.gif'],
  ]);
  assert.ok(
    sources
      .filter(([media]) => media.includes('prefers-reduced-motion'))
      .every(([media]) => !media.includes('prefers-color-scheme')),
  );
  assert.equal(updateReadme(result, {}, assets), result);
  for (const name of Object.keys(assets).filter((name) =>
    name.endsWith('.gif'),
  )) {
    delete assets[name];
  }
  const fallback = updateReadme(result, {}, assets);
  assert.doesNotMatch(fallback, /prefers-reduced-motion|\.gif/);
  assert.match(
    fallback,
    /media="\(max-width: 600px\)" srcset="assets\/workshop-mobile-dark.svg"/,
  );
});

test('every animated Workbench illustration has a reduced-motion SVG source before its theme source', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const assets = { 'profile-light.svg': '<svg/>' };
  const config = { username: 'me', featuredRepositories: ['one', 'two'] };
  for (const [index, repository] of config.featuredRepositories.entries()) {
    for (const theme of ['dark', 'light']) {
      assets[`project-${index + 1}-${theme}.svg`] =
        `<svg><title>${repository}</title><desc id="desc">Public project.</desc></svg>`;
      assets[`project-${index + 1}-${theme}.gif`] = Buffer.from('GIF89a');
    }
  }
  const result = updateReadme(
    '<!-- projects:start -->\n<!-- projects:end -->\n',
    config,
    assets,
  );
  const pictures = [...result.matchAll(/<picture>([\s\S]*?)<\/picture>/g)];
  assert.equal(pictures.length, 2);
  for (const [index, [, picture]] of pictures.entries()) {
    const sources = [
      ...picture.matchAll(/<source media="([^"]+)" srcset="assets\/([^"]+)">/g),
    ].map(([, media, file]) => [media, file]);
    assert.deepEqual(sources, [
      ['(prefers-reduced-motion: reduce)', `project-${index + 1}-dark.svg`],
      ['(prefers-color-scheme: dark)', `project-${index + 1}-dark.gif`],
    ]);
  }
  assert.equal(updateReadme(result, config, assets), result);
});

test('tech stack is rendered from configuration between markers', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const readme =
    'Intro\n<!-- tech-stack:start -->\nold\n<!-- tech-stack:end -->\nEnd\n';
  const config = {
    techStack: [
      { label: 'Go "fast"', icon: 'go', url: 'https://go.dev/?a=1&b=2' },
    ],
  };
  const result = updateReadme(readme, config, {});
  assert.doesNotMatch(result, /\bold\b/);
  assert.match(
    result,
    /<a href="https:\/\/go\.dev\/\?a=1&amp;b=2" title="Go &quot;fast&quot;"><picture>/,
  );
  assert.match(
    result,
    /srcset="https:\/\/skillicons\.dev\/icons\?i=go&amp;theme=dark"/,
  );
  assert.match(
    result,
    /<img src="https:\/\/skillicons\.dev\/icons\?i=go&amp;theme=light" alt="Go &quot;fast&quot;"/,
  );
  assert.match(
    result,
    /^Intro\n<!-- tech-stack:start -->\n<p>[\s\S]*<\/p>\n<!-- tech-stack:end -->\nEnd\n$/,
  );
  assert.equal(updateReadme(result, config, {}), result);
});

test('the committed README sections match the configuration', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const readme = await readFile(
    new URL('../README.md', import.meta.url),
    'utf8',
  );
  const config = JSON.parse(
    await readFile(new URL('../config/profile.json', import.meta.url), 'utf8'),
  );
  assert.equal(updateReadme(readme, config, {}), readme);
});

test('the profile keeps the HN account out of the README and generated badges', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const { badgeItems } = await import('../scripts/svg.mjs');
  const readme = await readFile(
    new URL('../README.md', import.meta.url),
    'utf8',
  );
  const config = JSON.parse(
    await readFile(new URL('../config/profile.json', import.meta.url), 'utf8'),
  );
  assert.doesNotMatch(readme, /news\.ycombinator\.com|badge-hn-|HN:/);
  assert.doesNotMatch(
    updateReadme(readme, config, {}),
    /news\.ycombinator\.com|badge-hn-|HN:/,
  );
  assert.ok(badgeItems(config).every((item) => item.icon !== 'hn'));
});

test('README alternatives expose generated descriptions and contacts remain native text links', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const readme =
    '<img alt="Old text" src="assets/profile-dark.svg" width="860">\n\n<!-- socials:start -->\nold\n<!-- socials:end -->\n';
  const config = {
    contact: {
      emails: ['a@example.com'],
      socials: [
        {
          label: 'X',
          icon: 'x',
          handle: '@me',
          url: 'https://x.com/confirmed',
        },
        { label: 'HN', icon: 'hn', url: null },
      ],
    },
  };
  const assets = {
    'profile-dark.svg':
      '<svg><desc id="desc">OS: Linux. Commits: 1,234. AI &amp; tools.</desc></svg>',
  };
  const result = updateReadme(readme, config, assets);
  assert.match(result, /alt="OS: Linux\. Commits: 1,234\. AI &amp; tools\."/);
  assert.match(
    result,
    /<a href="mailto:a@example\.com" title="a@example\.com">Email<\/a>/,
  );
  assert.match(
    result,
    /<a href="https:\/\/x\.com\/confirmed" title="@me">X<\/a>/,
  );
  assert.doesNotMatch(result, /badge-x|badge-email|<picture>/);
  assert.doesNotMatch(result, /HN|null|Old text|\nold\n/);
  assert.equal(updateReadme(result, config, assets), result);
});

test('contacts are appended with markers when the README has none, and cleared when none remain', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const config = {
    contact: {
      emails: ['a@example.com'],
      socials: [{ label: 'My Blog', url: 'https://blog.example.com' }],
    },
  };
  const appended = updateReadme('Intro\n', config, {});
  assert.match(
    appended,
    /^Intro\n\n<!-- socials:start -->\n<p>[\s\S]*<\/p>\n<!-- socials:end -->\n$/,
  );
  assert.match(
    appended,
    /href="https:\/\/blog\.example\.com" title="My Blog">My Blog<\/a>/,
  );
  assert.doesNotMatch(appended, /badge-my-blog|<img/);
  assert.equal(updateReadme(appended, config, {}), appended);
  assert.equal(
    updateReadme(appended, {}, {}),
    'Intro\n\n<!-- socials:start -->\n<!-- socials:end -->\n',
  );
});

test('native contact labels and titles escape markup while retaining their validated links', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const config = {
    contact: {
      socials: [
        {
          label: 'Blog <script>',
          handle: 'A "small" & personal site',
          url: 'https://example.com/?a=1&b=2',
        },
      ],
    },
  };
  const result = updateReadme('Intro\n', config, {});
  assert.match(
    result,
    /<a href="https:\/\/example\.com\/\?a=1&amp;b=2" title="A &quot;small&quot; &amp; personal site">Blog &lt;script&gt;<\/a>/,
  );
  assert.doesNotMatch(result, /<script>|<img|<picture>/);
  assert.equal(updateReadme(result, config, {}), result);
});

test('public projects keep native names and descriptions beside small themed illustrations', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const readme =
    'Intro\n<!-- projects:start -->\nold\n<!-- projects:end -->\nEnd\n';
  const config = { username: 'me', featuredRepositories: ['public-project'] };
  const svg =
    '<svg><title>public-project</title><desc id="desc">A &quot;small&quot; tool &amp; more.</desc></svg>';
  const assets = {
    'profile-light.svg': '<svg/>',
    'project-1-light.svg': svg,
    'project-1-dark.svg': svg,
  };
  const result = updateReadme(readme, config, assets);
  assert.match(
    result,
    /<h4><a href="https:\/\/github\.com\/me\/public-project">public-project<\/a><\/h4>/,
  );
  assert.match(result, /srcset="assets\/project-1-dark\.svg"/);
  assert.match(
    result,
    /alt="A &quot;small&quot; tool &amp; more\." src="assets\/project-1-light\.svg" width="96" align="right"/,
  );
  assert.match(result, /<p>A &quot;small&quot; tool &amp; more\.<\/p>/);
  assert.match(result, /<br clear="right">/);
  assert.match(
    result,
    /^Intro\n<!-- projects:start -->[\s\S]*<!-- projects:end -->\nEnd\n$/,
  );
  assert.doesNotMatch(result, /\nold\n/);
  assert.equal(updateReadme(result, config, assets), result);
});

test('project cards reject unrequested names, incomplete themes, and unsafe identifiers', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const readme = '<!-- projects:start -->\nstale\n<!-- projects:end -->\n';
  const svg = '<svg><title>unrequested</title><desc id="desc">No</desc></svg>';
  const assets = {
    'profile-light.svg': '<svg/>',
    'project-1-light.svg': svg,
    'project-1-dark.svg': svg,
  };
  const empty = '<!-- projects:start -->\n<!-- projects:end -->\n';
  assert.equal(
    updateReadme(
      readme,
      { username: 'me', featuredRepositories: ['requested'] },
      assets,
    ),
    empty,
  );
  assert.equal(
    updateReadme(
      readme,
      { username: 'bad/name', featuredRepositories: ['unrequested'] },
      assets,
    ),
    empty,
  );
  assert.equal(
    updateReadme(
      readme,
      { username: 'me', featuredRepositories: ['unrequested'] },
      { ...assets, 'project-1-dark.svg': undefined },
    ),
    empty,
  );
  assert.equal(
    updateReadme(
      readme,
      { username: 'me', featuredRepositories: ['unrequested'] },
      {},
    ),
    readme,
  );
});

test('automatic Workbench links preserve showcase order and external owners without accepting arbitrary URLs', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const config = { username: 'me', projectSource: 'github-profile' };
  const projects = [
    { owner: 'other', name: 'shared' },
    { owner: 'me', name: 'fork' },
  ];
  const assets = { 'profile-light.svg': '<svg/>' };
  for (const [index, project] of projects.entries()) {
    for (const theme of ['dark', 'light']) {
      assets[`project-${index + 1}-${theme}.svg`] =
        `<svg><title>${project.name}</title><desc id="desc">Public project.</desc></svg>`;
    }
  }
  const input = '<!-- projects:start -->\nstale\n<!-- projects:end -->\n';
  const result = updateReadme(input, config, assets, projects);
  assert.deepEqual(
    [...result.matchAll(/<a href="([^"]+)">/g)].map((match) => match[1]),
    ['https://github.com/other/shared', 'https://github.com/me/fork'],
  );
  assert.equal(updateReadme(result, config, assets, projects), result);
  assert.doesNotMatch(
    updateReadme(input, config, assets, [
      { owner: '../bad', name: 'shared', url: 'https://evil.test' },
    ]),
    /<a href/,
  );
  assert.doesNotMatch(updateReadme(input, config, assets, []), /<a href|stale/);
});

test('toolbox keeps everyday tools visible and background details closed without repeated icons', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const config = {
    currentlyLearning: 'about Rust and building desktop apps',
    system: {
      os: ['Linux', 'Android 13-14', '<img src=x onerror="bad">'],
      ides: ['VS Code'],
      terminals: ['Tabby'],
      programming: ['Go', 'Rust'],
      daily: ['JSON', 'Lua'],
      previous: ['PHP'],
      human: ['Turkmen'],
    },
    techStack: [{ label: 'Go', icon: 'go', url: 'https://go.dev/' }],
  };
  const result = updateReadme(
    'Intro\n<!-- environment:start -->\nold\n<!-- environment:end -->\nEnd\n',
    config,
    {},
  );
  assert.match(
    result,
    /### My toolbox[\s\S]*<table>[\s\S]*Workspace[\s\S]*Linux[\s\S]*<\/table>[\s\S]*<details>\n<summary>More tools &amp; background<\/summary>/,
  );
  assert.doesNotMatch(result, /<details open|<img src=x|\nold\n/);
  for (const value of [
    'Linux',
    'Go',
    'Rust',
    'Turkmen',
    '&lt;img src=x onerror=&quot;bad&quot;&gt;',
  ]) {
    assert.ok(result.includes(value));
  }
  assert.match(result, /Rust \(learning\)/);
  assert.match(result, /Configuration &amp; scripting/);
  assert.match(result, /Earlier experience/);
  assert.match(result, /<strong>Mobile<\/strong><br>Android 13-14/);
  assert.doesNotMatch(result.split('</table>')[0], /Android/);
  assert.doesNotMatch(result, /tech-stack:|skillicons\.dev/);
  assert.match(
    result,
    /^Intro\n<!-- environment:start -->[\s\S]*<!-- environment:end -->\nEnd\n$/,
  );
  assert.equal(updateReadme(result, config, {}), result);
});

test('the generated toolbox heading has a Markdown blank line after its marker', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const input = '<!-- environment:start -->\nold\n<!-- environment:end -->\n';
  const config = { system: { os: ['Linux'] } };
  const result = updateReadme(input, config, {});
  assert.match(result, /<!-- environment:start -->\n\n### My toolbox\n\n/);
  assert.equal(updateReadme(result, config, {}), result);
});

test('README separates projects and languages and keeps tools out of the opening section', async () => {
  const readme = await readFile(
    new URL('../README.md', import.meta.url),
    'utf8',
  );
  assert.match(readme, /### On the workbench\n\n<!-- projects:start -->/);
  assert.match(
    readme,
    /### Languages\n\n<picture>[\s\S]*src="assets\/languages-light\.svg"/,
  );
  assert.ok(
    readme.indexOf('<!-- projects:start -->') < readme.indexOf('### Languages'),
  );
  assert.ok(readme.indexOf('### My toolbox') < readme.indexOf('<details>'));
  assert.doesNotMatch(readme, /<!-- tech-stack:start -->|skillicons\.dev/);
  assert.doesNotMatch(readme, /\[pdf-shrinker\]\(https:\/\/github\.com/);
});

test('visible activity scope follows configuration and clears when activity is disabled', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const readme =
    'Intro\n<!-- activity-scope:start -->\nstale\n<!-- activity-scope:end -->\nEnd\n';
  const config = { activity: { enabled: true, maxCommitLines: 10000 } };
  const result = updateReadme(readme, config, {});
  assert.match(result, /Commits: public \+ private, all branches\./);
  assert.match(result, /Lines of code: added − deleted\./);
  assert.match(
    result,
    /Line totals exclude commits over 10,000 changed lines\./,
  );
  assert.doesNotMatch(result, /stale|;/);
  assert.equal(updateReadme(result, config, {}), result);
  assert.match(
    updateReadme(
      result,
      { activity: { enabled: true, maxCommitLines: 500 } },
      {},
    ),
    /over 500 changed lines/,
  );
  assert.doesNotMatch(
    updateReadme(result, { activity: { enabled: true } }, {}),
    /exclude|changed lines/,
  );
  const cleared =
    'Intro\n<!-- activity-scope:start -->\n<!-- activity-scope:end -->\nEnd\n';
  assert.equal(
    updateReadme(result, { activity: { enabled: false } }, {}),
    cleared,
  );
  assert.equal(updateReadme(result, {}, {}), cleared);
});

test('the committed README shows statistics and scope below the workspace', async () => {
  const readme = await readFile(
    new URL('../README.md', import.meta.url),
    'utf8',
  );
  assert.ok(
    readme.indexOf('workshop-light.gif') < readme.indexOf('stats-light.svg'),
  );
  assert.ok(
    readme.indexOf('stats-light.svg') <
      readme.indexOf('<!-- activity-scope:start -->'),
  );
  assert.doesNotMatch(readme, /### Seasonal workspace/);
  assert.ok(
    readme.indexOf('<!-- activity-scope:end -->') <
      readme.indexOf('<!-- socials:start -->'),
  );
  assert.match(
    readme
      .split('<!-- activity-scope:start -->')[1]
      ?.split('<!-- activity-scope:end -->')[0] ?? '',
    /public \+ private[\s\S]*10,000/,
  );
});

test('workshop uses looping GIF pairs with accessible SVG descriptions and static fallback', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const readme =
    'Intro\n<!-- workshop:start -->\nstale\n<!-- workshop:end -->\nEnd\n';
  const svg =
    '<svg><title>Workshop</title><desc id="desc">Desk, server &amp; Alabay.</desc></svg>';
  const assets = {
    'profile-light.svg': '<svg/>',
    'workshop-light.svg': svg,
    'workshop-dark.svg': svg,
    'workshop-light.gif': Buffer.from('GIF89a'),
    'workshop-dark.gif': Buffer.from('GIF89a'),
  };
  const result = updateReadme(readme, {}, assets);
  assert.match(result, /srcset="assets\/workshop-dark\.gif"/);
  assert.match(
    result,
    /alt="Desk, server &amp; Alabay\." src="assets\/workshop-light\.gif" width="860"/,
  );
  assert.equal(updateReadme(result, {}, assets), result);
  assert.equal(updateReadme(result, {}, {}), result);
  const fallback = updateReadme(
    result,
    {},
    { ...assets, 'workshop-dark.gif': undefined },
  );
  assert.match(fallback, /srcset="assets\/workshop-dark\.svg"/);
  assert.match(fallback, /src="assets\/workshop-light\.svg"/);
  assert.doesNotMatch(fallback, /\.gif/);
  assert.equal(
    updateReadme(result, {}, { 'profile-light.svg': '<svg/>' }),
    'Intro\n<!-- workshop:start -->\n<!-- workshop:end -->\nEnd\n',
  );
});

test('project GIF pairs keep validated public links and refresh alt text from SVG metadata', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const config = { username: 'me', featuredRepositories: ['public-project'] };
  const svg =
    '<svg><title>public-project</title><desc id="desc">A &quot;small&quot; tool.</desc></svg>';
  const assets = {
    'profile-light.svg': '<svg/>',
    'project-1-light.svg': svg,
    'project-1-dark.svg': svg,
    'project-1-light.gif': Buffer.from('GIF89a'),
    'project-1-dark.gif': Buffer.from('GIF89a'),
  };
  const readme = '<!-- projects:start -->\nold\n<!-- projects:end -->\n';
  const result = updateReadme(readme, config, assets);
  assert.match(result, /href="https:\/\/github\.com\/me\/public-project"/);
  assert.match(result, /srcset="assets\/project-1-dark\.gif"/);
  assert.match(
    result,
    /alt="A &quot;small&quot; tool\." src="assets\/project-1-light\.gif"/,
  );
  assert.equal(updateReadme(result, config, assets), result);
  const changed = {
    ...assets,
    'project-1-light.svg': svg.replace(
      'A &quot;small&quot; tool.',
      'Updated &amp; safe.',
    ),
  };
  assert.match(
    updateReadme(result, config, changed),
    /alt="Updated &amp; safe\."/,
  );
  const fallback = updateReadme(result, config, {
    ...assets,
    'project-1-dark.gif': undefined,
  });
  assert.match(fallback, /srcset="assets\/project-1-dark\.svg"/);
  assert.doesNotMatch(fallback, /\.gif/);
  assert.doesNotMatch(
    updateReadme(result, { username: 'me', featuredRepositories: [] }, assets),
    /href=|\.gif/,
  );
});

test('native project text escapes hostile metadata and preserves full descriptions without double encoding', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const config = { username: 'me', projectSource: 'github-profile' };
  const description =
    '<img src=x onerror="bad"> & a complete description that stays selectable.';
  const projects = [{ owner: 'me', name: 'public-project', description }];
  const svg =
    '<svg><title>public-project</title><desc id="desc">public-project. A &amp; B.</desc></svg>';
  const assets = {
    'profile-light.svg': '<svg/>',
    'project-1-light.svg': svg,
    'project-1-dark.svg': svg,
  };
  const input = '<!-- projects:start -->\nold\n<!-- projects:end -->\n';
  const result = updateReadme(input, config, assets, projects);
  assert.match(
    result,
    /<p>&lt;img src=x onerror=&quot;bad&quot;&gt; &amp; a complete description that stays selectable\.<\/p>/,
  );
  assert.doesNotMatch(result, /<img src=x|&amp;amp;|width="860"/);
  assert.equal(updateReadme(result, config, assets, projects), result);
  const fallback = updateReadme(
    input,
    { username: 'me', featuredRepositories: ['public-project'] },
    assets,
  );
  assert.match(fallback, /<p>A &amp; B\.<\/p>/);
});

test('the opening uses one combined hero image followed by statistics and contacts', async () => {
  const { updateReadme } = await import('../scripts/readme.mjs');
  const svg = '<svg><desc id="desc">Readable description.</desc></svg>';
  const assets = Object.fromEntries(
    ['profile', 'workshop', 'stats'].flatMap((name) =>
      ['dark', 'light'].map((theme) => [`${name}-${theme}.svg`, svg]),
    ),
  );
  const input =
    '<!-- opening:start -->\nstale\n<!-- opening:end -->\n<!-- socials:start -->\n<!-- socials:end -->\n';
  const result = updateReadme(input, {}, assets);
  assert.doesNotMatch(result, /stale|### Seasonal workspace/);
  assert.match(result, /<div class="profile-opening">/);
  assert.equal([...result.matchAll(/width="860" align="top"/g)].length, 2);
  assert.doesNotMatch(result, /assets\/profile-(?:light|dark)\.svg/);
  assert.ok(
    result.indexOf('workshop-light.svg') < result.indexOf('stats-light.svg'),
  );
  assert.ok(
    result.indexOf('stats-light.svg') <
      result.indexOf('<!-- socials:start -->'),
  );
  assert.equal(updateReadme(result, {}, assets), result);
});

test('the public profile uses the approved name roles and current work details', async () => {
  const config = JSON.parse(
    await readFile(new URL('../config/profile.json', import.meta.url), 'utf8'),
  );
  assert.equal(config.editorName, "Mekan's Desk");
  assert.equal(config.name, 'Mekan Soltanov');
  assert.equal(config.employment, undefined);
  assert.deepEqual(config.system.human, ['Turkmen', 'Turkish', 'English']);
  assert.deepEqual(config.workingWith, [
    'TypeScript',
    'JavaScript',
    'Python',
    'Go',
  ]);
  assert.equal(
    config.currentlyLearning,
    'about Rust and building desktop apps',
  );
  assert.deepEqual(config.focus, [
    'Software Engineer',
    'Platform Engineer',
    'Growth Engineer',
    'AI & Experimentation',
  ]);
  assert.equal(config.projectSource, 'github-profile');
  assert.equal(config.featuredRepositories, undefined);
  const readme = await readFile(
    new URL('../README.md', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    readme,
    /ALABAY CODE|alabay --watch|@msoltanov|Security Researcher|Turkmenistan/,
  );
  assert.match(readme, /Mekan&apos;s Desk/);
});

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { generateProfile } from '../scripts/generate-profile.mjs';
import { summarizeLanguages } from '../scripts/languages.mjs';

const data = {
  publicRepos: 2,
  followers: 3,
  starsEarned: 0,
  projects: [],
  languages: { rows: [], alsoUsed: [], scope: 'public' },
  notices: [],
};

async function workspace(t) {
  const directory = await mkdtemp(join(tmpdir(), 'alabay-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'config'));
  await writeFile(
    join(directory, 'config/profile.json'),
    JSON.stringify({
      name: 'Mekan',
      username: 'msoltanov',
      editorName: 'ALABAY CODE',
      focus: ['Infrastructure'],
      featuredRepositories: [],
      languageLimit: 6,
    }),
  );
  return directory;
}

test('generation writes the cards and a stats snapshot once and skips identical output', async (t) => {
  const root = await workspace(t);
  const now = new Date('2026-09-14T00:00:00Z');
  assert.deepEqual(
    await generateProfile({ root, now, collect: async () => data }),
    { changed: 11, notices: [] },
  );
  assert.deepEqual(
    await generateProfile({ root, now, collect: async () => data }),
    { changed: 0, notices: [] },
  );
  assert.match(
    await readFile(join(root, 'assets/profile-light.svg'), 'utf8'),
    /ALABAY CODE/,
  );
  assert.equal(
    JSON.parse(await readFile(join(root, 'data/stats.json'), 'utf8')).updatedAt,
    '2026-09-14',
  );
});

test('automatic Workbench generation supports six projects and limits release lookups to their actual owner', async (t) => {
  const root = await workspace(t);
  const configPath = join(root, 'config/profile.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  delete config.featuredRepositories;
  Object.assign(config, {
    projectSource: 'github-profile',
    latestRelease: true,
  });
  await writeFile(configPath, JSON.stringify(config));
  await writeFile(
    join(root, 'README.md'),
    '<!-- projects:start -->\n<!-- projects:end -->\n',
  );
  const projects = Array.from({ length: 6 }, (_, index) => ({
    owner: index === 0 ? 'msoltanov' : 'other',
    name: `repo-${index}`,
    description: 'Public project',
  }));
  await generateProfile({
    root,
    env: {},
    collect: async () => ({ ...data, projects }),
    releaseCollect: async (profile) => {
      assert.deepEqual(profile.featuredRepositories, ['repo-0']);
      return null;
    },
  });
  const readme = await readFile(join(root, 'README.md'), 'utf8');
  assert.equal([...readme.matchAll(/<a href=/g)].length, 6);
  assert.match(readme, /https:\/\/github.com\/other\/repo-5/);
  assert.match(
    await readFile(join(root, 'assets/project-6-dark.svg'), 'utf8'),
    /repo-5/,
  );
});

test('generation preserves binary animation bytes and skips identical GIF output', async (t) => {
  const root = await workspace(t);
  const configPath = join(root, 'config/profile.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.animated = true;
  await writeFile(configPath, JSON.stringify(config));
  const binary = Buffer.from([71, 73, 70, 56, 57, 97, 255, 0, 128]);
  let calls = 0;
  const options = {
    root,
    now: new Date('2026-09-14T00:00:00Z'),
    collect: async () => data,
    animationRender: async (profile) => {
      assert.equal(profile.animated, true);
      calls += 1;
      return { 'workshop-dark.gif': binary, 'workshop-light.gif': binary };
    },
  };
  await generateProfile(options);
  assert.deepEqual(
    await readFile(join(root, 'assets/workshop-dark.gif')),
    binary,
  );
  assert.equal((await generateProfile(options)).changed, 0);
  assert.equal(calls, 2);
});

test('the updated date moves only when rendered content changes', async (t) => {
  const root = await workspace(t);
  await generateProfile({
    root,
    now: new Date('2026-09-14T00:00:00Z'),
    collect: async () => data,
  });
  assert.equal(
    (
      await generateProfile({
        root,
        now: new Date('2026-09-20T00:00:00Z'),
        collect: async () => data,
      })
    ).changed,
    0,
  );
  assert.match(
    await readFile(join(root, 'assets/stats-dark.svg'), 'utf8'),
    /updated 2026-09-14/,
  );
  await generateProfile({
    root,
    now: new Date('2026-09-21T00:00:00Z'),
    collect: async () => ({
      ...data,
      languages: {
        rows: [{ name: 'Go', percentage: 100 }],
        alsoUsed: [],
        scope: 'public',
      },
    }),
  });
  assert.match(
    await readFile(join(root, 'assets/stats-dark.svg'), 'utf8'),
    /updated 2026-09-21/,
  );
});

test('failed activity, private language, and release collection keep the last known values', async (t) => {
  const root = await workspace(t);
  const configPath = join(root, 'config/profile.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  Object.assign(config, {
    system: { os: ['Linux'] },
    activity: { enabled: true },
    latestRelease: true,
  });
  await writeFile(configPath, JSON.stringify(config));
  const authorized = {
    rows: [{ name: 'Go', percentage: 100 }],
    alsoUsed: [],
    scope: 'authorized',
  };
  const release = {
    repository: 'public-project',
    tag: 'v2.1',
    publishedAt: '2026-09-12T00:00:00.000Z',
    url: 'https://github.com/msoltanov/public-project/releases/tag/v2.1',
  };
  await generateProfile({
    root,
    env: {},
    collect: async () => ({ ...data, languages: authorized }),
    activityCollect: async () => ({
      status: 'ready',
      scope: 'authorized-branches',
      commits: 1234,
      additions: 45678,
      deletions: 912,
    }),
    releaseCollect: async () => release,
  });
  const result = await generateProfile({
    root,
    env: {},
    collect: async () => ({
      ...data,
      privateUnavailable: true,
      notices: [
        'Private language collection unavailable; using public repositories only.',
      ],
    }),
    activityCollect: async () => ({
      status: 'unavailable',
      reason: 'rate-limited',
      scope: 'authorized-branches',
      commits: null,
      additions: null,
      deletions: null,
    }),
    releaseCollect: async () => {
      throw new Error('unavailable');
    },
  });
  assert.equal(result.changed, 0);
  assert.ok(result.notices.includes('Kept the last known activity totals.'));
  assert.ok(
    result.notices.includes('Kept the last known private language totals.'),
  );
  const svg = await readFile(join(root, 'assets/profile-dark.svg'), 'utf8');
  assert.match(svg, /1,234/);
  assert.doesNotMatch(svg, /&quot;unavailable&quot;/);
  assert.match(svg, /public-project v2\.1/);
  assert.match(
    await readFile(join(root, 'assets/profile-dark.svg'), 'utf8'),
    /public \+ authorized private/,
  );
});

test('activity receives the cache and a deadline, and the cache is encrypted with the stats token', async (t) => {
  const root = await workspace(t);
  const configPath = join(root, 'config/profile.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.activity = { enabled: true, maxCommitLines: 10000 };
  await writeFile(configPath, JSON.stringify(config));
  const env = { PROFILE_STATS_TOKEN: 'PRIVATE_TOKEN_SENTINEL' };
  const head = 'a'.repeat(40);
  const commit = 'b'.repeat(40);
  const activityCollect = async (profile, { cache, deadline }) => {
    assert.equal(profile.activity.maxCommitLines, 10000);
    assert.ok(deadline > Date.now());
    cache.authorId = 'USER_ID';
    cache.heads.set(head, [[commit, 5, 1, 0]]);
    return {
      status: 'ready',
      scope: 'authorized-branches',
      commits: 1,
      additions: 5,
      deletions: 1,
    };
  };
  await generateProfile({
    root,
    env,
    collect: async () => data,
    activityCollect,
  });
  const encrypted = await readFile(join(root, '.cache/activity.bin'));
  assert.doesNotMatch(encrypted.toString('latin1'), /USER_ID|aaaa|bbbb/);
  const { readCache } = await import('../scripts/cache.mjs');
  const cache = await readCache(
    join(root, '.cache/activity.bin'),
    env.PROFILE_STATS_TOKEN,
  );
  assert.deepEqual(cache.heads.get(head), [[commit, 5, 1, 0]]);
  assert.equal(
    (await readCache(join(root, '.cache/activity.bin'), 'another-token')).heads
      .size,
    0,
  );
  await generateProfile({
    root,
    env,
    collect: async () => data,
    activityCollect: async (profile, options) => {
      assert.deepEqual(options.cache.heads.get(head), [[commit, 5, 1, 0]]);
      return activityCollect(profile, options);
    },
  });
});

test('invalid tech stack and activity settings fail before data collection', async (t) => {
  for (const change of [
    { techStack: [{ label: 'Go', icon: 'go', url: 'http://go.dev' }] },
    { techStack: [{ label: 'Go', icon: '<go>', url: 'https://go.dev' }] },
    { activity: { enabled: true, maxCommitLines: 0 } },
    { animated: 'yes' },
  ]) {
    const root = await workspace(t);
    const configPath = join(root, 'config/profile.json');
    await writeFile(
      configPath,
      JSON.stringify({
        ...JSON.parse(await readFile(configPath, 'utf8')),
        ...change,
      }),
    );
    await assert.rejects(
      generateProfile({
        root,
        collect: async () => assert.fail('must not fetch'),
      }),
      /configuration/,
    );
  }
});

test('public collection failure leaves existing files intact', async (t) => {
  const root = await workspace(t);
  await mkdir(join(root, 'assets'));
  await writeFile(
    join(root, 'assets/profile-dark.svg'),
    'previous valid asset',
  );
  await assert.rejects(
    generateProfile({
      root,
      collect: async () => {
        throw new Error('GitHub API unavailable.');
      },
    }),
  );
  assert.equal(
    await readFile(join(root, 'assets/profile-dark.svg'), 'utf8'),
    'previous valid asset',
  );
});

test('unsupported identity length fails before fetching or writing', async (t) => {
  const root = await workspace(t);
  const configPath = join(root, 'config/profile.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.focus = ['x'.repeat(200)];
  await writeFile(configPath, JSON.stringify(config));
  let fetched = false;
  await assert.rejects(
    generateProfile({
      root,
      collect: async () => {
        fetched = true;
        return data;
      },
    }),
    /configuration/,
  );
  assert.equal(fetched, false);
});

test('generates nine named languages and a tenth Other row using all language bytes', async (t) => {
  const root = await workspace(t);
  const configPath = join(root, 'config/profile.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.languageLimit = 9;
  await writeFile(configPath, JSON.stringify(config));
  const bytes = {
    Python: 300,
    JavaScript: 150,
    TypeScript: 100,
    Go: 90,
    Rust: 80,
    PHP: 70,
    C: 60,
    'C++': 50,
    Ruby: 40,
    Dart: 30,
    Lua: 30,
  };
  const collect = async (profile) => {
    const languages = summarizeLanguages([bytes], profile.languageLimit);
    assert.equal(languages.rows.length, 10);
    assert.deepEqual(languages.rows.at(-1), { name: 'Other', percentage: 6 });
    assert.deepEqual(languages.alsoUsed, ['Dart', 'Lua']);
    return { ...data, languages: { ...languages, scope: 'public' } };
  };
  assert.equal((await generateProfile({ root, collect })).changed, 11);
  const svg = await readFile(join(root, 'assets/languages-dark.svg'), 'utf8');
  assert.match(svg, />Ruby<\/text>/);
  assert.match(svg, />Other<\/text>/);
  assert.match(svg, />6\.0%<\/text>/);
});

test('generation combines uptime, anonymous activity, and the latest public release', async (t) => {
  const root = await workspace(t);
  const configPath = join(root, 'config/profile.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  Object.assign(config, {
    system: { os: ['Linux'] },
    uptime: { source: 'github' },
    activity: { enabled: true },
    latestRelease: true,
  });
  await writeFile(configPath, JSON.stringify(config));
  await generateProfile({
    root,
    env: {},
    now: new Date('2026-09-14T00:00:00Z'),
    collect: async () => ({ ...data, createdAt: '2015-08-31T14:30:00Z' }),
    activityCollect: async () => ({
      status: 'ready',
      scope: 'authorized-branches',
      commits: 1234,
      additions: 45678,
      deletions: 912,
    }),
    releaseCollect: async () => ({
      repository: 'public-project',
      tag: 'v2.1',
      publishedAt: '2026-09-12T00:00:00Z',
    }),
  });
  const svg = await readFile(join(root, 'assets/profile-dark.svg'), 'utf8');
  assert.match(svg, /GitHub uptime/);
  assert.match(svg, /11y 0m/);
  assert.doesNotMatch(svg, /11y 0m \d+d/);
  assert.match(svg, /1,234/);
  assert.match(svg, /public-project v2\.1/);
  assert.match(svg, /2026-09-12/);
});

test('invalid system details fail before data collection', async (t) => {
  const root = await workspace(t);
  const configPath = join(root, 'config/profile.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.system = { os: ['x'.repeat(200)] };
  await writeFile(configPath, JSON.stringify(config));
  let fetched = false;
  await assert.rejects(
    generateProfile({
      root,
      collect: async () => {
        fetched = true;
        return data;
      },
    }),
    /configuration/,
  );
  assert.equal(fetched, false);
});

test('old card variants and badges for removed contacts are deleted', async (t) => {
  const root = await workspace(t);
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'assets/badge-linkedin-dark.svg'), 'stale');
  await writeFile(join(root, 'assets/profile-dark-mobile-still.svg'), 'stale');
  await writeFile(join(root, 'assets/notes.svg'), 'kept');
  await writeFile(join(root, 'assets/notes.gif'), 'kept');
  await writeFile(join(root, 'assets/workshop-dark.gif'), 'stale');
  await writeFile(join(root, 'assets/project-3-dark.gif'), 'stale');
  await generateProfile({ root, collect: async () => data });
  const { readdir } = await import('node:fs/promises');
  const names = await readdir(join(root, 'assets'));
  assert.ok(!names.includes('badge-linkedin-dark.svg'));
  assert.ok(!names.includes('profile-dark-mobile-still.svg'));
  assert.ok(names.includes('notes.svg'));
  assert.ok(names.includes('notes.gif'));
  assert.ok(!names.includes('workshop-dark.gif'));
  assert.ok(!names.includes('project-3-dark.gif'));
});

test('a public project that disappears loses its generated cards and README link', async (t) => {
  const root = await workspace(t);
  const configPath = join(root, 'config/profile.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.featuredRepositories = ['public-project'];
  await writeFile(configPath, JSON.stringify(config));
  await mkdir(join(root, 'assets'));
  await writeFile(
    join(root, 'assets/project-1-dark.svg'),
    'previous public project',
  );
  await writeFile(
    join(root, 'assets/project-1-light.svg'),
    'previous public project',
  );
  await writeFile(join(root, 'assets/project-notes.svg'), 'kept');
  await writeFile(
    join(root, 'README.md'),
    'Intro\n<!-- projects:start -->\n<a href="https://github.com/msoltanov/public-project">Public project</a>\n<!-- projects:end -->\nEnd\n',
  );
  await generateProfile({ root, collect: async () => data });
  const { readdir } = await import('node:fs/promises');
  const names = await readdir(join(root, 'assets'));
  assert.ok(!names.includes('project-1-dark.svg'));
  assert.ok(!names.includes('project-1-light.svg'));
  assert.ok(names.includes('project-notes.svg'));
  assert.equal(
    await readFile(join(root, 'README.md'), 'utf8'),
    'Intro\n<!-- projects:start -->\n<!-- projects:end -->\nEnd\n',
  );
});

test('generation passes the local calendar season to both static and animated scenes', async (t) => {
  for (const [now, season] of [
    ['2026-10-31T18:59:59Z', 'autumn'],
    ['2026-10-31T19:00:00Z', 'winter'],
  ]) {
    const root = await workspace(t);
    let received;
    await generateProfile({
      root,
      now: new Date(now),
      collect: async () => data,
      animationRender: async (config, source) => {
        received = source.season;
        return {};
      },
    });
    assert.equal(received, season);
    assert.match(
      await readFile(join(root, 'assets/workshop-dark.svg'), 'utf8'),
      new RegExp(`data-season="${season}"`),
    );
  }
});

test('generation supports the full security research focus label', async (t) => {
  const root = await workspace(t);
  const path = join(root, 'config/profile.json');
  const config = JSON.parse(await readFile(path, 'utf8'));
  config.focus = [
    'Software Engineer',
    'Growth Engineer',
    'DevOps',
    'AI & Experimentation',
    'Cybersecurity & Security Research',
  ];
  await writeFile(path, JSON.stringify(config));
  await generateProfile({ root, collect: async () => data });
  const svg = await readFile(join(root, 'assets/profile-dark.svg'), 'utf8');
  assert.match(
    svg,
    /Roles: Software Engineer · Growth Engineer · DevOps · AI &amp; Experimentation · Cybersecurity &amp; Security Research/,
  );
  const { renderMotionFrame } = await import('../scripts/svg.mjs');
  const frame = renderMotionFrame(config, data, 0.9)['workshop-dark.svg'];
  assert.match(
    frame,
    /<text[^>]*class="intro-role-title"[^>]*>Cybersecurity &amp; Security Research<\/text>/,
  );
});

test('invalid current-work details fail before data collection', async (t) => {
  for (const change of [
    { workingWith: 'Rust' },
    { workingWith: [null] },
    { workingWith: Array(11).fill('Go') },
    { workingWith: ['x'.repeat(49)] },
    { currentlyLearning: [] },
    { currentlyLearning: '' },
    { currentlyLearning: 'x'.repeat(49) },
  ]) {
    const root = await workspace(t);
    const path = join(root, 'config/profile.json');
    await writeFile(
      path,
      JSON.stringify({
        ...JSON.parse(await readFile(path, 'utf8')),
        ...change,
      }),
    );
    await assert.rejects(
      generateProfile({
        root,
        collect: async () => assert.fail('must not fetch'),
      }),
      /Invalid current work configuration/,
    );
  }
});

test('invalid employment details fail before data collection', async (t) => {
  const valid = {
    role: 'Software Engineer / Platform Engineer',
    company: 'Yupekchi',
    location: 'Turkmenistan',
  };
  for (const employment of [
    null,
    [],
    {},
    { ...valid, company: null },
    { ...valid, role: 'x'.repeat(49) },
    { ...valid, location: '' },
  ]) {
    const root = await workspace(t);
    const path = join(root, 'config/profile.json');
    await writeFile(
      path,
      JSON.stringify({
        ...JSON.parse(await readFile(path, 'utf8')),
        employment,
      }),
    );
    await assert.rejects(
      generateProfile({
        root,
        collect: async () => assert.fail('must not fetch'),
      }),
      /Invalid employment configuration/,
    );
  }
});

test('employment can omit a location while malformed interests fail before collection', async (t) => {
  const root = await workspace(t);
  const path = join(root, 'config/profile.json');
  const profile = JSON.parse(await readFile(path, 'utf8'));
  profile.employment = {
    role: 'Software Engineer / Platform Engineer',
    company: 'Yupekchi',
  };
  profile.interests = ['AI & Experimentation'];
  await writeFile(path, JSON.stringify(profile));
  await generateProfile({ root, collect: async () => data });
  const svg = await readFile(join(root, 'assets/profile-dark.svg'), 'utf8');
  assert.match(
    svg,
    /Working as Software Engineer \/ Platform Engineer at Yupekchi/,
  );
  assert.doesNotMatch(svg, /undefined/);
  for (const interests of ['AI', [null], ['x'.repeat(49)]]) {
    await writeFile(path, JSON.stringify({ ...profile, interests }));
    await assert.rejects(
      generateProfile({
        root,
        collect: async () => assert.fail('must not fetch'),
      }),
      /configuration/,
    );
  }
});

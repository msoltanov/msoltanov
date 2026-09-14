import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { generateProfile } from '../scripts/generate-profile.mjs';
import { summarizeLanguages } from '../scripts/languages.mjs';

const data = { publicRepos: 2, followers: 3, starsEarned: 0, projects: [], languages: { rows: [], alsoUsed: [], scope: 'public' }, notices: [] };

async function workspace(t) {
  const directory = await mkdtemp(join(tmpdir(), 'alabay-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'config'));
  await writeFile(join(directory, 'config/profile.json'), JSON.stringify({ name: 'Mekan', username: 'msoltanov', editorName: 'ALABAY CODE', focus: ['Infrastructure'], featuredRepositories: [], languageLimit: 6 }));
  return directory;
}

test('generation writes sixteen assets once and skips identical output', async (t) => {
  const root = await workspace(t);
  assert.deepEqual(await generateProfile({ root, collect: async () => data }), { changed: 16, notices: [] });
  assert.deepEqual(await generateProfile({ root, collect: async () => data }), { changed: 0, notices: [] });
  assert.match(await readFile(join(root, 'assets/profile-light.svg'), 'utf8'), /ALABAY CODE/);
});

test('public collection failure leaves existing files intact', async (t) => {
  const root = await workspace(t);
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'assets/profile-dark.svg'), 'previous valid asset');
  await assert.rejects(generateProfile({ root, collect: async () => { throw new Error('GitHub API unavailable.'); } }));
  assert.equal(await readFile(join(root, 'assets/profile-dark.svg'), 'utf8'), 'previous valid asset');
});

test('unsupported identity length fails before fetching or writing', async (t) => {
  const root = await workspace(t);
  const configPath = join(root, 'config/profile.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.focus = ['x'.repeat(200)];
  await writeFile(configPath, JSON.stringify(config));
  let fetched = false;
  await assert.rejects(generateProfile({ root, collect: async () => { fetched = true; return data; } }), /configuration/);
  assert.equal(fetched, false);
});

test('generates nine named languages and a tenth Other row using all language bytes', async (t) => {
  const root = await workspace(t);
  const configPath = join(root, 'config/profile.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.languageLimit = 9;
  await writeFile(configPath, JSON.stringify(config));
  const bytes = { Python: 300, JavaScript: 150, TypeScript: 100, Go: 90, Rust: 80, PHP: 70, C: 60, 'C++': 50, Ruby: 40, Dart: 30, Lua: 30 };
  const collect = async (profile) => {
    const languages = summarizeLanguages([bytes], profile.languageLimit);
    assert.equal(languages.rows.length, 10);
    assert.deepEqual(languages.rows.at(-1), { name: 'Other', percentage: 6 });
    assert.deepEqual(languages.alsoUsed, ['Dart', 'Lua']);
    return { ...data, languages: { ...languages, scope: 'public' } };
  };
  assert.equal((await generateProfile({ root, collect })).changed, 16);
  const svg = await readFile(join(root, 'assets/languages-dark.svg'), 'utf8');
  assert.match(svg, />Ruby<\/text>/);
  assert.match(svg, />Other<\/text>/);
  assert.match(svg, />6\.0%<\/text>/);
});

test('generation combines uptime, anonymous activity, and the latest public release', async (t) => {
  const root = await workspace(t);
  const configPath = join(root, 'config/profile.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  Object.assign(config, { system: { os: ['Linux'] }, uptime: { source: 'github' }, activity: { enabled: true }, latestRelease: true });
  await writeFile(configPath, JSON.stringify(config));
  await generateProfile({
    root, env: {}, now: new Date('2026-09-14T00:00:00Z'),
    collect: async () => ({ ...data, createdAt: '2015-08-31T14:30:00Z' }),
    activityCollect: async () => ({ status: 'ready', scope: 'authorized-branches', commits: 1234, additions: 45678, deletions: 912 }),
    releaseCollect: async () => ({ repository: 'public-project', tag: 'v2.1', publishedAt: '2026-09-12T00:00:00Z' }),
  });
  const svg = await readFile(join(root, 'assets/profile-dark.svg'), 'utf8');
  assert.match(svg, /GitHub uptime/);
  assert.match(svg, /11y 0m 14d/);
  assert.match(svg, /1,234/);
  assert.match(svg, /public-project \/ v2.1 \/ 2026-09-12/);
});

test('invalid system details fail before data collection', async (t) => {
  const root = await workspace(t);
  const configPath = join(root, 'config/profile.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.system = { os: ['x'.repeat(200)] };
  await writeFile(configPath, JSON.stringify(config));
  let fetched = false;
  await assert.rejects(generateProfile({ root, collect: async () => { fetched = true; return data; } }), /configuration/);
  assert.equal(fetched, false);
});

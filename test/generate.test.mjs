import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { generateProfile } from '../scripts/generate-profile.mjs';

const data = { publicRepos: 2, followers: 3, starsEarned: 0, projects: [], languages: { rows: [], alsoUsed: [], scope: 'public' }, notices: [] };

async function workspace(t) {
  const directory = await mkdtemp(join(tmpdir(), 'alabay-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'config'));
  await writeFile(join(directory, 'config/profile.json'), JSON.stringify({ name: 'Mekan', username: 'msoltanov', editorName: 'ALABAY CODE', focus: ['Infrastructure'], featuredRepositories: [], languageLimit: 6 }));
  return directory;
}

test('generation writes eight assets once and skips identical output', async (t) => {
  const root = await workspace(t);
  assert.deepEqual(await generateProfile({ root, collect: async () => data }), { changed: 8, notices: [] });
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

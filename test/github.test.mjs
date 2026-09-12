import assert from 'node:assert/strict';
import test from 'node:test';
import { collectProfile } from '../scripts/github.mjs';

const USERNAME = 'msoltanov';
const PRIVATE_NAME = 'PRIVATE_REPOSITORY_SENTINEL';
const PRIVATE_TOKEN = 'PRIVATE_TOKEN_SENTINEL';
const config = {
  username: USERNAME,
  featuredRepositories: ['source'],
  filters: { includeForks: false, includeArchived: false, includeMirrors: false, excludeRepositories: [] },
  languageLimit: 6,
};

function repository(name = 'source', overrides = {}) {
  return {
    name, owner: { login: USERNAME }, private: false, fork: false, archived: false,
    mirror_url: null, size: 100, stargazers_count: 2, description: 'A public project',
    html_url: `https://github.com/${USERNAME}/${name}`, ...overrides,
  };
}

function api({ repositories = [repository()], languages = { source: { Python: 100 } }, privateRepos = [], user = { public_repos: repositories.length, followers: 7 }, handler } = {}) {
  const calls = [];
  const fetchImpl = async (input, options) => {
    const url = new URL(input);
    calls.push({ url, options });
    assert.equal(url.origin, 'https://api.github.com');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    const custom = await handler?.(url, options);
    if (custom) {
      return custom;
    }
    let body;
    if (url.pathname === `/users/${USERNAME}`) {
      body = user;
    } else if (url.pathname === `/users/${USERNAME}/repos` || url.pathname === '/user/repos') {
      const page = Number(url.searchParams.get('page'));
      assert.equal(url.searchParams.get('per_page'), '100');
      assert.ok(page >= 1);
      const source = url.pathname === '/user/repos' ? privateRepos : repositories;
      body = source.slice((page - 1) * 100, page * 100);
    } else {
      const match = url.pathname.match(/^\/repos\/msoltanov\/([^/]+)\/languages$/);
      assert.ok(match, `Unexpected public test endpoint: ${url.pathname}`);
      body = languages[decodeURIComponent(match[1])];
      assert.notEqual(body, undefined);
    }
    return { ok: true, status: 200, json: async () => body };
  };
  return { fetchImpl, calls };
}

test('missing private token produces a complete public-only profile', async () => {
  const fixture = api();
  const result = await collectProfile(config, { env: {}, fetchImpl: fixture.fetchImpl });
  assert.deepEqual(result, {
    publicRepos: 1, followers: 7, starsEarned: 2,
    projects: [{ name: 'source', description: 'A public project', url: 'https://github.com/msoltanov/source' }],
    languages: { rows: [{ name: 'Python', percentage: 100 }], alsoUsed: [], scope: 'public' },
    notices: [],
  });
  assert.equal(fixture.calls.some(({ url }) => url.pathname === '/user/repos'), false);
  assert.equal(fixture.calls.some(({ options }) => options.headers.Authorization), false);
});

test('aggregates authorized private languages without exporting private metadata', async () => {
  const fixture = api({
    privateRepos: [repository(PRIVATE_NAME, { private: true, description: 'PRIVATE_DESCRIPTION_SENTINEL', owner: { login: USERNAME, secret: 'PRIVATE_OWNER_SENTINEL' }, default_branch: 'PRIVATE_BRANCH_SENTINEL' })],
    languages: { source: { Python: 100 }, [PRIVATE_NAME]: { Go: 300 } },
  });
  const result = await collectProfile(config, { env: { PROFILE_STATS_TOKEN: PRIVATE_TOKEN }, fetchImpl: fixture.fetchImpl });
  assert.deepEqual(result.languages, {
    rows: [{ name: 'Go', percentage: 75 }, { name: 'Python', percentage: 25 }], alsoUsed: [], scope: 'authorized',
  });
  assert.equal(result.publicRepos, 1);
  assert.equal(result.starsEarned, 2);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_/);
  for (const { url, options } of fixture.calls) {
    const privateRequest = url.pathname === '/user/repos' || url.pathname.includes(PRIVATE_NAME);
    assert.equal(options.headers.Authorization, privateRequest ? `Bearer ${PRIVATE_TOKEN}` : undefined);
  }
  const enumeration = fixture.calls.find(({ url }) => url.pathname === '/user/repos').url;
  assert.equal(enumeration.searchParams.get('affiliation'), 'owner');
  assert.equal(enumeration.searchParams.get('visibility'), 'private');
});

test('keeps public totals complete and rejects collaborator, public, and ambiguous private enumeration entries', async () => {
  const fixture = api({
    privateRepos: [repository(PRIVATE_NAME, { private: true, owner: { login: 'someone-else' } }), repository('public-copy'), repository('ambiguous', { private: undefined })],
  });
  const result = await collectProfile(config, { env: { PROFILE_STATS_TOKEN: PRIVATE_TOKEN }, fetchImpl: fixture.fetchImpl });
  assert.equal(result.languages.scope, 'authorized');
  assert.deepEqual(result.languages.rows, [{ name: 'Python', percentage: 100 }]);
  assert.equal(result.publicRepos, 1);
  assert.equal(fixture.calls.filter(({ url }) => url.pathname.endsWith('/languages')).length, 1);
});

test('paginates public and private repository lists past 100 without following API Link URLs', async () => {
  const repositories = Array.from({ length: 101 }, (_, index) => repository(`public-${index}`));
  const privateRepos = Array.from({ length: 101 }, (_, index) => repository(`private-${index}`, { private: true }));
  const languages = Object.fromEntries([...repositories, ...privateRepos].map(({ name }) => [name, { Go: 1 }]));
  const fixture = api({ repositories, privateRepos, languages });
  const result = await collectProfile(config, { env: { PROFILE_STATS_TOKEN: PRIVATE_TOKEN }, fetchImpl: fixture.fetchImpl });
  assert.equal(result.starsEarned, 202);
  assert.equal(result.publicRepos, 101);
  assert.equal(fixture.calls.filter(({ url }) => url.pathname.endsWith('/languages')).length, 202);
  assert.equal(fixture.calls.filter(({ url }) => url.searchParams.get('page') === '2').length, 2);
});

test('filters forks, archives, mirrors, empty repos, and configured exclusions only from language statistics', async () => {
  const repositories = [
    repository(), repository('fork', { fork: true }), repository('archive', { archived: true }),
    repository('mirror', { mirror_url: 'https://example.com/mirror' }), repository('empty', { size: 0 }),
    repository('excluded'), repository('foreign', { owner: { login: 'elsewhere' } }),
    repository('not-public', { private: true }), repository('ambiguous', { private: undefined }),
  ];
  const fixture = api({ repositories });
  const localConfig = { ...config, filters: { ...config.filters, excludeRepositories: ['MSOLTANOV/excluded'] } };
  const result = await collectProfile(localConfig, { env: {}, fetchImpl: fixture.fetchImpl });
  assert.equal(result.starsEarned, 12);
  assert.deepEqual(result.languages.rows, [{ name: 'Python', percentage: 100 }]);
  assert.equal(fixture.calls.filter(({ url }) => url.pathname.endsWith('/languages')).length, 1);
});

test('can include forks, archived repositories, and mirrors explicitly', async () => {
  const fixture = api({
    repositories: [repository('fork', { fork: true }), repository('archive', { archived: true }), repository('mirror', { mirror_url: 'https://example.com' })],
    languages: { fork: { C: 1 }, archive: { C: 1 }, mirror: { C: 1 } },
  });
  const localConfig = { ...config, filters: { includeForks: true, includeArchived: true, includeMirrors: true, excludeRepositories: [] } };
  const result = await collectProfile(localConfig, { env: {}, fetchImpl: fixture.fetchImpl });
  assert.deepEqual(result.languages.rows, [{ name: 'C', percentage: 100 }]);
});

test('private exclusions stay in environment configuration only', async () => {
  const fixture = api({ privateRepos: [repository(PRIVATE_NAME, { private: true })] });
  const env = { PROFILE_STATS_TOKEN: PRIVATE_TOKEN, PROFILE_EXCLUDE_REPOSITORIES: JSON.stringify([`${USERNAME}/${PRIVATE_NAME}`]) };
  const result = await collectProfile(config, { env, fetchImpl: fixture.fetchImpl });
  assert.equal(fixture.calls.some(({ url }) => url.pathname.includes(PRIVATE_NAME)), false);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_/);
});

test('rejects malformed environment exclusions with a fixed error message', async () => {
  const fixture = api();
  await assert.rejects(collectProfile(config, { env: { PROFILE_EXCLUDE_REPOSITORIES: PRIVATE_NAME }, fetchImpl: fixture.fetchImpl }), /^Error: Invalid repository exclusions\.$/);
});

test('retries public requests anonymously after an invalid built-in token', async () => {
  const fixture = api({ handler: async (url, options) => {
    if (options.headers.Authorization === 'Bearer invalid-token') {
      return { ok: false, status: 401, json: async () => ({ message: PRIVATE_NAME }) };
    }
  } });
  const result = await collectProfile(config, { env: { GITHUB_TOKEN: 'invalid-token' }, fetchImpl: fixture.fetchImpl });
  assert.equal(result.publicRepos, 1);
  assert.equal(fixture.calls.filter(({ options }) => options.headers.Authorization).length, 1);
  assert.doesNotMatch(JSON.stringify(result), /invalid-token|PRIVATE_/);
});

for (const failAt of ['/user/repos', `/repos/${USERNAME}/${PRIVATE_NAME}/languages`]) {
  test(`discards all private statistics when a private request fails at ${failAt === '/user/repos' ? 'enumeration' : 'languages'}`, async () => {
    const fixture = api({
      privateRepos: [repository('first-private', { private: true }), repository(PRIVATE_NAME, { private: true })],
      languages: { source: { Python: 100 }, 'first-private': { Go: 900 } },
      handler: async (url) => url.pathname === failAt ? { ok: false, status: 403, json: async () => ({ message: PRIVATE_NAME, token: PRIVATE_TOKEN }) } : undefined,
    });
    const result = await collectProfile(config, { env: { PROFILE_STATS_TOKEN: PRIVATE_TOKEN }, fetchImpl: fixture.fetchImpl });
    assert.deepEqual(result.languages, { rows: [{ name: 'Python', percentage: 100 }], alsoUsed: [], scope: 'public' });
    assert.equal(result.notices.length, 1);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|first-private/);
  });
}

test('drops private aggregate on malformed private language response', async () => {
  const fixture = api({ privateRepos: [repository(PRIVATE_NAME, { private: true })], languages: { source: { Python: 100 }, [PRIVATE_NAME]: { Go: 300, secret: PRIVATE_NAME } } });
  const result = await collectProfile(config, { env: { PROFILE_STATS_TOKEN: PRIVATE_TOKEN }, fetchImpl: fixture.fetchImpl });
  assert.equal(result.languages.scope, 'public');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|secret/);
});

test('public API failure throws a sanitized error without response bodies or raw causes', async () => {
  const fixture = api({ handler: async () => ({ ok: false, status: 429, json: async () => { throw new Error(PRIVATE_TOKEN); } }) });
  await assert.rejects(collectProfile(config, { env: {}, fetchImpl: fixture.fetchImpl }), (error) => {
    assert.equal(error.message, 'GitHub API rate limit reached. Try again later.');
    assert.equal(error.cause, undefined);
    assert.doesNotMatch(error.stack, /PRIVATE_/);
    return true;
  });
});

test('network failures and malformed JSON do not expose raw errors', async () => {
  for (const fetchImpl of [
    async () => { throw new Error(PRIVATE_TOKEN); },
    async () => ({ ok: true, status: 200, json: async () => { throw new Error(PRIVATE_NAME); } }),
  ]) {
    await assert.rejects(collectProfile(config, { env: {}, fetchImpl }), (error) => {
      assert.doesNotMatch(error.message, /PRIVATE_/);
      assert.equal(error.cause, undefined);
      return true;
    });
  }
});

test('empty repository list produces valid empty statistics', async () => {
  const fixture = api({ repositories: [], user: { public_repos: 0, followers: 0 } });
  const result = await collectProfile(config, { env: {}, fetchImpl: fixture.fetchImpl });
  assert.deepEqual(result, { publicRepos: 0, followers: 0, starsEarned: 0, projects: [], languages: { rows: [], alsoUsed: [], scope: 'public' }, notices: [] });
});

test('constructs project URLs from validated names and returns no unrequested metadata', async () => {
  const fixture = api({ repositories: [repository('source', { html_url: 'javascript:alert(1)', description: '<script>& public text', unexpected: PRIVATE_NAME })] });
  const result = await collectProfile(config, { env: {}, fetchImpl: fixture.fetchImpl });
  assert.deepEqual(result.projects, [{ name: 'source', description: '<script>& public text', url: 'https://github.com/msoltanov/source' }]);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|javascript:/);
});

test('rejects invalid profile identifiers before making network requests', async () => {
  for (const username of ['../escape', 'user?x=1', 'https://example.com', '']) {
    await assert.rejects(collectProfile({ ...config, username }, { env: {}, fetchImpl: async () => assert.fail('must not fetch') }), /Invalid GitHub username/);
  }
});

test('rejects invalid public statistics instead of rendering invented values', async () => {
  for (const user of [{ public_repos: -1, followers: 7 }, { followers: 7 }, { public_repos: 1, followers: '7' }]) {
    const fixture = api({ user });
    await assert.rejects(collectProfile(config, { env: {}, fetchImpl: fixture.fetchImpl }), /Invalid public GitHub data/);
  }
});

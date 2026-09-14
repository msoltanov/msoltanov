import assert from 'node:assert/strict';
import test from 'node:test';
import { collectActivity, collectLatestRelease } from '../scripts/activity.mjs';

const USERNAME = 'msoltanov';
const PRIVATE_TOKEN = 'PRIVATE_TOKEN_SENTINEL';
const PRIVATE_REPOSITORY = 'PRIVATE_REPOSITORY_SENTINEL';
const NOW = new Date('2026-09-14T00:00:00Z');
const config = { username: USERNAME, featuredRepositories: ['source', 'second'] };

function oid(value) {
  return value.toString(16).padStart(40, '0');
}

function connection(nodes, after = null) {
  const offset = after === null ? 0 : Number(after);
  const batch = nodes.slice(offset, offset + 100);
  const hasNextPage = offset + batch.length < nodes.length;
  return { nodes: batch, totalCount: nodes.length, pageInfo: { hasNextPage, endCursor: hasNextPage ? String(offset + batch.length) : null } };
}

function graph({ repositories = [{ id: PRIVATE_REPOSITORY }], contributions = {}, heads = { [PRIVATE_REPOSITORY]: [oid(1)] }, histories = { [oid(1)]: [{ oid: oid(10), additions: 12, deletions: 3 }] }, createdAt = '2024-01-01T00:00:00Z', viewer = USERNAME, handler } = {}) {
  const calls = [];
  const fetchImpl = async (input, options) => {
    const url = new URL(input);
    const { query, variables } = JSON.parse(options.body);
    calls.push({ query, variables, options });
    assert.equal(url.href, 'https://api.github.com/graphql');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers.Authorization, `Bearer ${PRIVATE_TOKEN}`);
    const custom = await handler?.({ query, variables, options });
    if (custom) {
      return custom;
    }

    let data;
    if (query.includes('query ActivityIdentity')) {
      data = { viewer: { login: viewer }, user: { id: 'USER_ID', createdAt } };
    } else if (query.includes('query ActivityRepositories')) {
      data = { viewer: { repositories: connection(repositories, variables.after) } };
    } else if (query.includes('query ActivityContributions')) {
      const selected = contributions[new Date(variables.from).getUTCFullYear()] ?? [];
      data = { user: { contributionsCollection: {
        totalRepositoriesWithContributedCommits: selected.length,
        commitContributionsByRepository: selected.map((repository) => ({ repository })),
      } } };
    } else if (query.includes('query ActivityBranches')) {
      assert.ok(heads[variables.repositoryId], 'Repository must have a branch fixture');
      data = { node: { refs: connection(heads[variables.repositoryId].map((head) => ({ target: { oid: head } })), variables.after) } };
    } else if (query.includes('query ActivityHistory')) {
      assert.ok(histories[variables.headOid], 'Branch must have a history fixture');
      assert.equal(variables.authorId, 'USER_ID');
      data = { node: { object: { history: connection(histories[variables.headOid].map((commit) => ({ parents: { totalCount: 1 }, ...commit })), variables.after) } } };
    } else {
      assert.fail('Unexpected activity query');
    }

    return { ok: true, status: 200, headers: new Headers({ 'x-oauth-scopes': 'repo, read:user' }), json: async () => ({ data }) };
  };
  return { fetchImpl, calls };
}

function options(fixture, env = { PROFILE_STATS_TOKEN: PRIVATE_TOKEN }) {
  return { env, fetchImpl: fixture.fetchImpl, now: NOW };
}

test('missing or repository-scoped token leaves activity totals unknown', async () => {
  for (const [env, reason] of [[{}, 'token-required'], [{ GITHUB_TOKEN: PRIVATE_TOKEN }, 'limited-token']]) {
    const fixture = graph();
    const result = await collectActivity(config, options(fixture, env));
    assert.deepEqual(result, { status: 'unavailable', reason, scope: 'authorized-branches', commits: null, additions: null, deletions: null });
    assert.equal(fixture.calls.length, 0);
  }
});

test('counts unique authored commits across private, external, and unmerged branches', async () => {
  const fixture = graph({
    repositories: [{ id: PRIVATE_REPOSITORY }],
    contributions: { 2024: [{ id: 'EXTERNAL_REPOSITORY' }] },
    heads: { [PRIVATE_REPOSITORY]: [oid(1), oid(2)], EXTERNAL_REPOSITORY: [oid(3)] },
    histories: {
      [oid(1)]: [{ oid: oid(10), additions: 12, deletions: 3 }],
      [oid(2)]: [{ oid: oid(20), additions: 20, deletions: 5 }, { oid: oid(10), additions: 12, deletions: 3 }],
      [oid(3)]: [{ oid: oid(10), additions: 12, deletions: 3 }, { oid: oid(30), additions: 7, deletions: 2 }],
    },
  });
  const result = await collectActivity(config, options(fixture));
  assert.deepEqual(result, { status: 'ready', reason: null, scope: 'authorized-branches', commits: 3, additions: 39, deletions: 10 });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|EXTERNAL_|USER_ID/);
  const periods = fixture.calls.filter(({ query }) => query.includes('query ActivityContributions'));
  assert.deepEqual(periods.map(({ variables }) => new Date(variables.from).getUTCFullYear()), [2024, 2025, 2026]);
  assert.ok(fixture.calls.some(({ query }) => /affiliations:\s*\[OWNER, COLLABORATOR, ORGANIZATION_MEMBER\]/.test(query)));
  assert.ok(fixture.calls.some(({ query }) => /refPrefix:\s*"refs\/heads\/"/.test(query)));
  assert.ok(fixture.calls.some(({ query }) => /author:\s*\{\s*id:\s*\$authorId\s*\}/.test(query)));
});

test('paginates repositories, branches, and authored histories beyond 100', async () => {
  const repositories = Array.from({ length: 101 }, (_, index) => ({ id: `REPOSITORY_${index}` }));
  const heads = Object.fromEntries(repositories.map(({ id }) => [id, []]));
  heads.REPOSITORY_100 = Array.from({ length: 101 }, (_, index) => oid(index + 1));
  const histories = Object.fromEntries(heads.REPOSITORY_100.map((head) => [head, []]));
  histories[oid(101)] = Array.from({ length: 101 }, (_, index) => ({ oid: oid(index + 200), additions: 2, deletions: 1 }));
  const fixture = graph({ repositories, heads, histories });
  const result = await collectActivity(config, options(fixture));
  assert.equal(result.status, 'ready');
  assert.equal(result.commits, 101);
  assert.equal(result.additions, 202);
  assert.equal(result.deletions, 101);
  for (const operation of ['ActivityRepositories', 'ActivityBranches', 'ActivityHistory']) {
    assert.ok(fixture.calls.some(({ query, variables }) => query.includes(`query ${operation}`) && variables.after === '100'));
  }
});

test('discovers organization-member repositories through both affiliation filters', async () => {
  const fixture = graph({ repositories: [] });
  const result = await collectActivity(config, options(fixture));
  assert.equal(result.status, 'ready');
  const { query } = fixture.calls.find((call) => call.query.includes('query ActivityRepositories'));
  assert.match(query, /affiliations:\s*\[OWNER, COLLABORATOR, ORGANIZATION_MEMBER\]/);
  assert.match(query, /ownerAffiliations:\s*\[OWNER, COLLABORATOR, ORGANIZATION_MEMBER\]/);
});

test('counts authored merge commits while excluding their duplicated line diffs', async () => {
  const fixture = graph({ histories: { [oid(1)]: [
    { oid: oid(10), additions: 12, deletions: 3, parents: { totalCount: 0 } },
    { oid: oid(20), additions: 12, deletions: 3, parents: { totalCount: 2 } },
  ] } });
  const result = await collectActivity(config, options(fixture));
  assert.equal(result.status, 'ready');
  assert.equal(result.commits, 2);
  assert.equal(result.additions, 12);
  assert.equal(result.deletions, 3);
  assert.ok(fixture.calls.some(({ query }) => /parents\(first:\s*1\)\s*\{\s*totalCount\s*\}/.test(query)));
});

test('collects independent repositories concurrently with at most four requests in flight', async () => {
  const repositories = Array.from({ length: 8 }, (_, index) => ({ id: `REPOSITORY_${index}` }));
  const heads = Object.fromEntries(repositories.map(({ id }, index) => [id, [oid(index + 1)]]));
  const histories = Object.fromEntries(repositories.map((repository, index) => [oid(index + 1), [{ oid: oid(index + 200), additions: 1, deletions: 0 }]]));
  let active = 0;
  let maximum = 0;
  const fixture = graph({ repositories, heads, histories, handler: async ({ query }) => {
    if (!query.includes('query ActivityBranches') && !query.includes('query ActivityHistory')) {
      return;
    }

    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active -= 1;
  } });
  const result = await collectActivity(config, options(fixture));
  assert.equal(result.status, 'ready');
  assert.equal(result.commits, 8);
  assert.ok(maximum >= 2);
  assert.ok(maximum <= 4);
});

test('splits capped contribution discovery into smaller complete periods', async () => {
  const repositories = Array.from({ length: 101 }, (_, index) => ({ id: `EXTERNAL_${index}` }));
  let contributionCalls = 0;
  const fixture = graph({
    repositories: [], createdAt: '2026-01-01T00:00:00Z',
    heads: Object.fromEntries(repositories.map(({ id }) => [id, []])),
    handler: ({ query, variables }) => {
      if (!query.includes('query ActivityContributions')) {
        return;
      }

      contributionCalls += 1;
      const fullPeriod = variables.from === '2026-01-01T00:00:00.000Z' && variables.to === NOW.toISOString();
      const selected = variables.from === '2026-01-01T00:00:00.000Z' ? repositories.slice(0, 100) : repositories.slice(100);
      return { ok: true, status: 200, json: async () => ({ data: { user: { contributionsCollection: {
        totalRepositoriesWithContributedCommits: fullPeriod ? 101 : selected.length,
        commitContributionsByRepository: selected.map((repository) => ({ repository })),
      } } } }) };
    },
  });
  const result = await collectActivity(config, options(fixture));
  assert.equal(result.status, 'ready');
  assert.equal(contributionCalls, 3);
  assert.equal(fixture.calls.filter(({ query }) => query.includes('query ActivityBranches')).length, 101);
});

test('reports discovery limits when even a single day is truncated', async () => {
  const fixture = graph({
    repositories: [], createdAt: '2026-09-13T23:00:00Z',
    handler: ({ query }) => query.includes('query ActivityContributions') ? {
      ok: true, status: 200, json: async () => ({ data: { user: { contributionsCollection: {
        totalRepositoriesWithContributedCommits: 101,
        commitContributionsByRepository: Array.from({ length: 100 }, (_, index) => ({ repository: { id: `EXTERNAL_${index}` } })),
      } } } }),
    } : undefined,
  });
  const result = await collectActivity(config, options(fixture));
  assert.equal(result.reason, 'discovery-limited');
  assert.equal(result.commits, null);
  assert.equal(result.additions, null);
});

test('rejects a token belonging to a different user', async () => {
  const fixture = graph({ viewer: 'someone-else' });
  const result = await collectActivity(config, options(fixture));
  assert.equal(result.reason, 'access-denied');
  assert.equal(fixture.calls.length, 1);
});

test('requires private repo and user scope when classic token scopes are known', async () => {
  for (const scopes of ['', 'repo, read:org', 'read:user, public_repo']) {
    const fixture = graph({ handler: () => ({ ok: true, status: 200, headers: new Headers({ 'x-oauth-scopes': scopes }) }) });
    const result = await collectActivity(config, options(fixture));
    assert.equal(result.reason, 'insufficient-scope');
    assert.equal(result.commits, null);
  }
});

test('rejects unverifiable token scopes before collecting partial or zero totals', async () => {
  for (const headers of [undefined, new Headers()]) {
    const fixture = graph({ repositories: [], handler: ({ query }) => query.includes('query ActivityIdentity') ? {
      ok: true, status: 200, headers,
      json: async () => ({ data: { viewer: { login: USERNAME }, user: { id: 'USER_ID', createdAt: '2024-01-01T00:00:00Z' } } }),
    } : undefined });
    const result = await collectActivity(config, options(fixture));
    assert.deepEqual(result, {
      status: 'unavailable', reason: 'unverifiable-scope', scope: 'authorized-branches',
      commits: null, additions: null, deletions: null,
    });
    assert.equal(fixture.calls.length, 1);
  }
});

test('discards partial aggregates and sanitizes HTTP, GraphQL, and network failures', async () => {
  const failures = [
    [{ ok: false, status: 429 }, 'rate-limited'],
    [{ ok: false, status: 403, headers: new Headers({ 'x-ratelimit-remaining': '0' }) }, 'rate-limited'],
    [{ ok: false, status: 403 }, 'access-denied'],
    [{ ok: true, status: 200, json: async () => ({ errors: [{ type: 'RATE_LIMITED', message: PRIVATE_TOKEN }] }) }, 'rate-limited'],
    [{ ok: true, status: 200, json: async () => ({ data: { secret: PRIVATE_REPOSITORY }, errors: [{ message: PRIVATE_TOKEN }] }) }, 'request-failed'],
    [{ ok: true, status: 200, json: async () => { throw new Error(PRIVATE_TOKEN); } }, 'invalid-response'],
  ];
  for (const [response, reason] of failures) {
    const fixture = graph({ heads: { [PRIVATE_REPOSITORY]: [oid(1), oid(2)] }, handler: ({ variables }) => variables.headOid === oid(2) ? response : undefined });
    const result = await collectActivity(config, options(fixture));
    assert.equal(result.reason, reason);
    assert.equal(result.commits, null);
    assert.equal(result.additions, null);
    assert.equal(result.deletions, null);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_/);
  }

  const result = await collectActivity(config, { env: { PROFILE_STATS_TOKEN: PRIVATE_TOKEN }, fetchImpl: async () => { throw new Error(PRIVATE_TOKEN); }, now: NOW });
  assert.equal(result.reason, 'request-failed');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_/);
});

test('malformed commit totals and pagination never become valid counts', async () => {
  for (const history of [
    connection([{ oid: oid(10), additions: -1, deletions: 0 }]),
    connection([{ oid: oid(10), additions: '5', deletions: 0 }]),
    { ...connection([]), totalCount: 1 },
    { ...connection([]), pageInfo: { hasNextPage: true, endCursor: null } },
  ]) {
    const fixture = graph({ handler: ({ query }) => query.includes('query ActivityHistory') ? {
      ok: true, status: 200, json: async () => ({ data: { node: { object: { history } } } }),
    } : undefined });
    const result = await collectActivity(config, options(fixture));
    assert.equal(result.reason, 'invalid-response');
    assert.equal(result.commits, null);
  }
});

test('empty complete histories can produce known zero totals', async () => {
  const fixture = graph({ repositories: [] });
  const result = await collectActivity(config, options(fixture));
  assert.deepEqual(result, { status: 'ready', reason: null, scope: 'authorized-branches', commits: 0, additions: 0, deletions: 0 });
});

test('rejects malformed usernames before network access', async () => {
  for (const username of ['../escape', 'https://example.com', '']) {
    await assert.rejects(collectActivity({ ...config, username }, { env: {}, fetchImpl: async () => assert.fail('must not fetch') }), /Invalid GitHub username/);
  }
});

function releases({ source = '2026-01-01T12:00:00Z', second = '2026-09-01T12:00:00Z', handler } = {}) {
  const calls = [];
  const dates = { source, second };
  const fetchImpl = async (input, requestOptions) => {
    const url = new URL(input);
    calls.push({ url, options: requestOptions });
    assert.equal(url.origin, 'https://api.github.com');
    assert.equal(requestOptions.redirect, 'error');
    assert.ok(requestOptions.signal instanceof AbortSignal);
    assert.notEqual(requestOptions.headers.Authorization, `Bearer ${PRIVATE_TOKEN}`);
    const custom = await handler?.(url, requestOptions);
    if (custom) {
      return custom;
    }

    const match = url.pathname.match(/^\/repos\/msoltanov\/(source|second)\/releases\/latest$/);
    assert.ok(match);
    const publishedAt = dates[match[1]];
    if (publishedAt === null) {
      return { ok: false, status: 404 };
    }

    return { ok: true, status: 200, json: async () => ({
      tag_name: 'v1.2.0', published_at: publishedAt, draft: false, prerelease: false,
      html_url: 'javascript:alert(1)', body: PRIVATE_REPOSITORY,
    }) };
  };
  return { fetchImpl, calls };
}

test('selects the latest featured public release and exports only permitted fields', async () => {
  const fixture = releases();
  const result = await collectLatestRelease(config, { env: { PROFILE_STATS_TOKEN: PRIVATE_TOKEN }, fetchImpl: fixture.fetchImpl });
  assert.deepEqual(result, {
    repository: 'second', tag: 'v1.2.0', publishedAt: '2026-09-01T12:00:00.000Z',
    url: 'https://github.com/msoltanov/second/releases/tag/v1.2.0',
  });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|javascript:/);
  assert.equal(fixture.calls.length, 2);
});

test('handles projects without a published release', async () => {
  const fixture = releases({ source: null, second: null });
  assert.equal(await collectLatestRelease(config, { env: {}, fetchImpl: fixture.fetchImpl }), null);
  assert.equal(await collectLatestRelease({ ...config, featuredRepositories: [] }, { env: {}, fetchImpl: async () => assert.fail('must not fetch') }), null);
});

test('retries rejected public release credentials anonymously', async () => {
  const fixture = releases({ handler: (url, requestOptions) => requestOptions.headers.Authorization ? { ok: false, status: 401 } : undefined });
  const result = await collectLatestRelease(config, { env: { GITHUB_TOKEN: 'invalid-public-token' }, fetchImpl: fixture.fetchImpl });
  assert.equal(result.repository, 'second');
  assert.ok(fixture.calls.some(({ options: requestOptions }) => requestOptions.headers.Authorization === undefined));
});

test('release failures are sanitized and do not silently select a partial latest result', async () => {
  for (const response of [
    { ok: false, status: 429 },
    { ok: true, status: 200, json: async () => { throw new Error(PRIVATE_TOKEN); } },
    { ok: true, status: 200, json: async () => ({ tag_name: 'v1', published_at: 'invalid', draft: false, prerelease: false }) },
  ]) {
    const fixture = releases({ handler: (url) => url.pathname.includes('/second/') ? response : undefined });
    await assert.rejects(collectLatestRelease(config, { env: {}, fetchImpl: fixture.fetchImpl }), (error) => {
      assert.equal(error.message, 'Latest public release unavailable.');
      assert.equal(error.cause, undefined);
      assert.doesNotMatch(error.stack, /PRIVATE_/);
      return true;
    });
  }
});

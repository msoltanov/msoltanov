const API_ORIGIN = 'https://api.github.com';
const WEB_ORIGIN = 'https://github.com';
const API_VERSION = '2022-11-28';
const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 20_000;
const MINIMUM_DISCOVERY_PERIOD_MS = 24 * 60 * 60 * 1_000;
const REPOSITORY_CONCURRENCY = 4;
const SCOPE = 'authorized-branches';
const USERNAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
const REPOSITORY_PATTERN = /^[a-zA-Z0-9_.-]{1,100}$/;
const OID_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;

const IDENTITY_QUERY = `query ActivityIdentity($username: String!) {
  viewer { login }
  user(login: $username) { id createdAt }
}`;

const REPOSITORIES_QUERY = `query ActivityRepositories($after: String) {
  viewer {
    repositories(first: ${PAGE_SIZE}, after: $after, affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER], ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]) {
      nodes { id }
      totalCount
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

const CONTRIBUTIONS_QUERY = `query ActivityContributions($username: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $username) {
    contributionsCollection(from: $from, to: $to) {
      totalRepositoriesWithContributedCommits
      commitContributionsByRepository(maxRepositories: ${PAGE_SIZE}) { repository { id } }
    }
  }
}`;

const BRANCHES_QUERY = `query ActivityBranches($repositoryId: ID!, $after: String) {
  node(id: $repositoryId) {
    ... on Repository {
      refs(refPrefix: "refs/heads/", first: ${PAGE_SIZE}, after: $after) {
        nodes { target { oid } }
        totalCount
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`;

const HISTORY_QUERY = `query ActivityHistory($repositoryId: ID!, $headOid: GitObjectID!, $authorId: ID!, $after: String) {
  node(id: $repositoryId) {
    ... on Repository {
      object(oid: $headOid) {
        ... on Commit {
          history(first: ${PAGE_SIZE}, after: $after, author: { id: $authorId }) {
            nodes { oid additions deletions parents(first: 1) { totalCount } }
            totalCount
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }
  }
}`;

class ActivityError extends Error {
  constructor(reason) {
    super('GitHub activity collection unavailable.');
    this.reason = reason;
  }
}

function invalidResponse() {
  throw new ActivityError('invalid-response');
}

function count(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    invalidResponse();
  }

  return value;
}

function identifier(value) {
  if (typeof value !== 'string' || !value.trim()) {
    invalidResponse();
  }

  return value;
}

function timestamp(value) {
  const result = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(result)) {
    invalidResponse();
  }

  return result;
}

function validateUsername(username) {
  if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) {
    throw new Error('Invalid GitHub username.');
  }
}

function unavailable(reason) {
  return { status: 'unavailable', reason, scope: SCOPE, commits: null, additions: null, deletions: null };
}

function createGraphqlClient(fetchImpl, token) {
  let verifiedScopes = false;

  return async (query, variables) => {
    let response;
    try {
      response = await fetchImpl(new URL('/graphql', API_ORIGIN), {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': API_VERSION,
          'User-Agent': 'alabay-code-profile',
        },
        body: JSON.stringify({ query, variables }),
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new ActivityError('request-failed');
    }

    if (response.status === 429 || (response.status === 403 && response.headers?.get('x-ratelimit-remaining') === '0')) {
      throw new ActivityError('rate-limited');
    }

    if (!response.ok) {
      throw new ActivityError(response.status === 401 || response.status === 403 ? 'access-denied' : 'request-failed');
    }

    const scopeHeader = response.headers?.get('x-oauth-scopes');
    if (typeof scopeHeader !== 'string' && !verifiedScopes) {
      throw new ActivityError('unverifiable-scope');
    }

    if (typeof scopeHeader === 'string') {
      const scopes = new Set(scopeHeader.split(',').map((scope) => scope.trim()));
      if (!scopes.has('repo') || (!scopes.has('read:user') && !scopes.has('user'))) {
        throw new ActivityError('insufficient-scope');
      }

      verifiedScopes = true;
    }

    let body;
    try {
      body = await response.json();
    } catch {
      invalidResponse();
    }

    if (Array.isArray(body?.errors) && body.errors.length > 0) {
      const rateLimited = body.errors.some((error) => error?.type === 'RATE_LIMITED');
      throw new ActivityError(rateLimited ? 'rate-limited' : 'request-failed');
    }

    if (!body?.data || typeof body.data !== 'object') {
      invalidResponse();
    }

    return body.data;
  };
}

async function collectConnection(readPage, consume) {
  let after = null;
  let received = 0;
  let expected;
  const cursors = new Set();

  while (true) {
    const page = await readPage(after);
    if (!Array.isArray(page?.nodes) || page.nodes.length > PAGE_SIZE || typeof page.pageInfo?.hasNextPage !== 'boolean') {
      invalidResponse();
    }

    const total = count(page.totalCount);
    expected ??= total;
    if (expected !== total) {
      invalidResponse();
    }

    for (const node of page.nodes) {
      await consume(node);
    }

    received += page.nodes.length;
    if (!page.pageInfo.hasNextPage) {
      if (received !== expected) {
        invalidResponse();
      }

      return;
    }

    after = identifier(page.pageInfo.endCursor);
    if (page.nodes.length === 0 || cursors.has(after) || received >= expected) {
      invalidResponse();
    }

    cursors.add(after);
  }
}

async function discoverContributions(request, username, from, to, addRepository) {
  const data = await request(CONTRIBUTIONS_QUERY, {
    username, from: new Date(from).toISOString(), to: new Date(to).toISOString(),
  });
  const collection = data.user?.contributionsCollection;
  const total = count(collection?.totalRepositoriesWithContributedCommits);
  const entries = collection?.commitContributionsByRepository;
  if (!Array.isArray(entries) || entries.length > PAGE_SIZE || entries.length > total) {
    invalidResponse();
  }

  if (entries.length < total) {
    if (total <= PAGE_SIZE || to - from < MINIMUM_DISCOVERY_PERIOD_MS) {
      throw new ActivityError('discovery-limited');
    }

    const middle = Math.floor((from + to) / 2);
    await discoverContributions(request, username, from, middle, addRepository);
    await discoverContributions(request, username, middle, to, addRepository);
    return;
  }

  const repositoryIds = new Set();
  for (const entry of entries) {
    const repositoryId = identifier(entry?.repository?.id);
    if (repositoryIds.has(repositoryId)) {
      invalidResponse();
    }

    repositoryIds.add(repositoryId);
    addRepository(entry.repository);
  }
}

async function discoverRepositories(request, username, createdAt, now) {
  const repositories = new Set();
  const addRepository = (repository) => repositories.add(identifier(repository?.id));
  await collectConnection(async (after) => {
    const data = await request(REPOSITORIES_QUERY, { after });
    return data.viewer?.repositories;
  }, addRepository);

  for (let year = new Date(createdAt).getUTCFullYear(); year <= now.getUTCFullYear(); year += 1) {
    const from = Math.max(createdAt, Date.UTC(year, 0, 1));
    const to = Math.min(now.getTime(), Date.UTC(year + 1, 0, 1) - 1);
    await discoverContributions(request, username, from, to, addRepository);
  }

  return repositories;
}

async function collectCommits(request, repositories, authorId) {
  const commits = new Set();
  const scannedHeads = new Set();
  let additions = 0;
  let deletions = 0;

  const collectRepository = async (repositoryId) => {
    const heads = new Set();
    await collectConnection(async (after) => {
      const data = await request(BRANCHES_QUERY, { repositoryId, after });
      return data.node?.refs;
    }, (branch) => {
      if (!OID_PATTERN.test(branch?.target?.oid)) {
        invalidResponse();
      }

      heads.add(branch.target.oid);
    });

    for (const headOid of heads) {
      if (scannedHeads.has(headOid)) {
        continue;
      }

      scannedHeads.add(headOid);
      await collectConnection(async (after) => {
        const data = await request(HISTORY_QUERY, { repositoryId, headOid, authorId, after });
        return data.node?.object?.history;
      }, (commit) => {
        if (!OID_PATTERN.test(commit?.oid)) {
          invalidResponse();
        }

        const added = count(commit.additions);
        const deleted = count(commit.deletions);
        const parents = count(commit.parents?.totalCount);
        if (commits.has(commit.oid)) {
          return;
        }

        commits.add(commit.oid);
        if (parents > 1) {
          return;
        }

        additions = count(additions + added);
        deletions = count(deletions + deleted);
      });
    }
  };

  const repositoryIds = [...repositories];
  let nextIndex = 0;
  let failure;
  const workers = Array.from({ length: Math.min(REPOSITORY_CONCURRENCY, repositoryIds.length) }, async () => {
    while (!failure && nextIndex < repositoryIds.length) {
      const repositoryId = repositoryIds[nextIndex];
      nextIndex += 1;
      try {
        await collectRepository(repositoryId);
      } catch (error) {
        failure ??= error;
      }
    }
  });
  await Promise.all(workers);
  if (failure) {
    throw failure;
  }

  return { commits: commits.size, additions, deletions };
}

export async function collectActivity(config, { env = process.env, fetchImpl = fetch, now = new Date() } = {}) {
  validateUsername(config.username);
  const token = typeof env.PROFILE_STATS_TOKEN === 'string' ? env.PROFILE_STATS_TOKEN.trim() : '';
  if (!token) {
    return unavailable(env.GITHUB_TOKEN ? 'limited-token' : 'token-required');
  }

  try {
    const request = createGraphqlClient(fetchImpl, token);
    const identity = await request(IDENTITY_QUERY, { username: config.username });
    if (typeof identity.viewer?.login !== 'string' || identity.viewer.login.toLowerCase() !== config.username.toLowerCase()) {
      throw new ActivityError('access-denied');
    }

    const authorId = identifier(identity.user?.id);
    const createdAt = timestamp(identity.user?.createdAt);
    if (!(now instanceof Date) || !Number.isFinite(now.getTime()) || createdAt > now.getTime()) {
      invalidResponse();
    }

    const repositories = await discoverRepositories(request, config.username, createdAt, now);
    const totals = await collectCommits(request, repositories, authorId);
    return { status: 'ready', reason: null, scope: SCOPE, ...totals };
  } catch (error) {
    return unavailable(error instanceof ActivityError ? error.reason : 'request-failed');
  }
}

export async function collectLatestRelease(config, { env = process.env, fetchImpl = fetch } = {}) {
  validateUsername(config.username);
  let token = typeof env.GITHUB_TOKEN === 'string' ? env.GITHUB_TOKEN.trim() : '';

  try {
    const repositories = config.featuredRepositories ?? [];
    if (!Array.isArray(repositories) || repositories.some((name) => typeof name !== 'string' || !REPOSITORY_PATTERN.test(name) || name === '.' || name === '..')) {
      invalidResponse();
    }

    let latest = null;
    for (const repository of new Set(repositories)) {
      const url = new URL(`/repos/${config.username}/${encodeURIComponent(repository)}/releases/latest`, API_ORIGIN);
      let response;
      while (true) {
        const headers = {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': API_VERSION,
          'User-Agent': 'alabay-code-profile',
        };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        response = await fetchImpl(url, { headers, redirect: 'error', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        if (token && (response.status === 401 || response.status === 403)) {
          token = '';
          continue;
        }

        break;
      }

      if (response.status === 404) {
        continue;
      }

      if (!response.ok) {
        invalidResponse();
      }

      const release = await response.json();
      const tag = identifier(release?.tag_name);
      const publishedAt = new Date(timestamp(release?.published_at)).toISOString();
      if (release.draft !== false || release.prerelease !== false) {
        invalidResponse();
      }

      if (latest && latest.publishedAt >= publishedAt) {
        continue;
      }

      latest = {
        repository, tag, publishedAt,
        url: `${WEB_ORIGIN}/${config.username}/${encodeURIComponent(repository)}/releases/tag/${encodeURIComponent(tag)}`,
      };
    }

    return latest;
  } catch {
    throw new Error('Latest public release unavailable.');
  }
}

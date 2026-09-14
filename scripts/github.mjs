import { summarizeLanguages } from './languages.mjs';

const API_ORIGIN = 'https://api.github.com';
const WEB_ORIGIN = 'https://github.com';
const API_VERSION = '2022-11-28';
const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 20_000;
const LANGUAGE_CONCURRENCY = 4;
const USERNAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
const REPOSITORY_PATTERN = /^[a-zA-Z0-9_.-]{1,100}$/;
const PRIVATE_FALLBACK_NOTICE = 'Private language collection unavailable; using public repositories only.';

function validRepositoryName(name) {
  return typeof name === 'string' && REPOSITORY_PATTERN.test(name) && name !== '.' && name !== '..';
}

function parseExclusions(configured = [], environment = '') {
  let environmental = [];

  if (environment) {
    try {
      environmental = JSON.parse(environment);
    } catch {
      throw new Error('Invalid repository exclusions.');
    }
  }

  if (!Array.isArray(configured) || !Array.isArray(environmental)) {
    throw new Error('Invalid repository exclusions.');
  }

  const excluded = new Set();

  for (const identifier of [...configured, ...environmental]) {
    if (typeof identifier !== 'string') {
      throw new Error('Invalid repository exclusions.');
    }

    const parts = identifier.split('/');

    if (parts.length !== 2 || !USERNAME_PATTERN.test(parts[0]) || !validRepositoryName(parts[1])) {
      throw new Error('Invalid repository exclusions.');
    }

    excluded.add(identifier.toLowerCase());
  }

  return excluded;
}

function createClient(fetchImpl, initialToken, anonymousFallback = false) {
  let token = typeof initialToken === 'string' ? initialToken.trim() : '';

  return async function request(path, parameters = {}) {
    const url = new URL(path, API_ORIGIN);

    for (const [key, value] of Object.entries(parameters)) {
      url.searchParams.set(key, String(value));
    }

    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': API_VERSION,
      'User-Agent': 'alabay-code-profile',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let response;

    try {
      response = await fetchImpl(url, { headers, redirect: 'error', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch {
      throw new Error('GitHub API request failed. Check connectivity and try again.');
    }

    if (anonymousFallback && token && (response.status === 401 || response.status === 403)) {
      token = '';
      return request(path, parameters);
    }

    if (!response.ok) {
      if (response.status === 429 || (response.status === 403 && response.headers?.get('x-ratelimit-remaining') === '0')) {
        throw new Error('GitHub API rate limit reached. Try again later.');
      }

      throw new Error('GitHub API request was rejected. Check access and try again.');
    }

    try {
      return await response.json();
    } catch {
      throw new Error('GitHub API returned an invalid response.');
    }
  };
}

async function listRepositories(request, path, parameters) {
  const repositories = [];

  for (let page = 1; ; page += 1) {
    const batch = await request(path, { ...parameters, per_page: PAGE_SIZE, page });

    if (!Array.isArray(batch) || batch.length > PAGE_SIZE) {
      throw new Error('GitHub API returned an invalid repository list.');
    }

    repositories.push(...batch);

    if (batch.length < PAGE_SIZE) {
      return repositories;
    }
  }
}

function selectOwned(repositories, username, visibility) {
  const selected = new Map();

  for (const repository of repositories) {
    if (!repository || repository.private !== visibility || typeof repository.owner?.login !== 'string'
      || repository.owner.login.toLowerCase() !== username.toLowerCase()) {
      continue;
    }

    if (!validRepositoryName(repository.name)) {
      throw new Error('GitHub API returned an invalid repository identifier.');
    }

    selected.set(repository.name.toLowerCase(), repository);
  }

  return [...selected.values()].sort((first, second) => {
    const firstName = first.name.toLowerCase();
    const secondName = second.name.toLowerCase();
    return firstName === secondName ? 0 : firstName < secondName ? -1 : 1;
  });
}

function includeLanguages(repository, username, filters, excluded) {
  if (excluded.has(`${username}/${repository.name}`.toLowerCase()) || repository.size === 0) {
    return false;
  }

  if (filters.includeForks !== true && repository.fork !== false) {
    return false;
  }

  if (filters.includeArchived !== true && repository.archived !== false) {
    return false;
  }

  return filters.includeMirrors === true || repository.mirror_url === null;
}

async function collectLanguages(repositories, request, username, filters, excluded) {
  const selected = repositories.filter((repository) => includeLanguages(repository, username, filters, excluded));
  const responses = new Array(selected.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(LANGUAGE_CONCURRENCY, selected.length) }, async () => {
    while (nextIndex < selected.length) {
      const index = nextIndex;
      nextIndex += 1;
      responses[index] = await request(`/repos/${username}/${encodeURIComponent(selected[index].name)}/languages`);
    }
  });
  const results = await Promise.allSettled(workers);
  const failed = results.find((result) => result.status === 'rejected');

  if (failed) {
    throw failed.reason;
  }

  return responses;
}

function publicCount(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Invalid public GitHub data.');
  }

  return value;
}

export async function collectProfile(config, { env = process.env, fetchImpl = fetch } = {}) {
  const username = config.username;

  if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) {
    throw new Error('Invalid GitHub username.');
  }

  const filters = config.filters ?? {};
  const excluded = parseExclusions(filters.excludeRepositories, env.PROFILE_EXCLUDE_REPOSITORIES);
  const publicRequest = createClient(fetchImpl, env.GITHUB_TOKEN, true);
  const user = await publicRequest(`/users/${username}`);
  const publicRepos = publicCount(user?.public_repos);
  const followers = publicCount(user?.followers);
  const publicRepositories = selectOwned(await listRepositories(publicRequest, `/users/${username}/repos`, {
    type: 'owner', sort: 'full_name', direction: 'asc',
  }), username, false);
  const starsEarned = publicCount(publicRepositories.reduce((total, repository) => total + publicCount(repository.stargazers_count), 0));
  const publicLanguages = await collectLanguages(publicRepositories, publicRequest, username, filters, excluded);
  let languages = { ...summarizeLanguages(publicLanguages, config.languageLimit, filters.excludeLanguages), scope: 'public' };
  const notices = [];

  if (typeof env.PROFILE_STATS_TOKEN === 'string' && env.PROFILE_STATS_TOKEN.trim()) {
    try {
      const privateRequest = createClient(fetchImpl, env.PROFILE_STATS_TOKEN);
      const privateRepositories = selectOwned(await listRepositories(privateRequest, '/user/repos', {
        affiliation: 'owner', visibility: 'private', sort: 'full_name', direction: 'asc',
      }), username, true);
      const privateLanguages = await collectLanguages(privateRepositories, privateRequest, username, filters, excluded);
      languages = { ...summarizeLanguages([...publicLanguages, ...privateLanguages], config.languageLimit, filters.excludeLanguages), scope: 'authorized' };
    } catch {
      notices.push(PRIVATE_FALLBACK_NOTICE);
    }
  }

  const featured = Array.isArray(config.featuredRepositories) ? config.featuredRepositories : [];
  const projects = featured.flatMap((name) => {
    const repository = publicRepositories.find((candidate) => candidate.name === name && candidate.fork === false);

    if (!repository) {
      return [];
    }

    return [{
      name: repository.name,
      description: typeof repository.description === 'string' ? repository.description : '',
      url: `${WEB_ORIGIN}/${username}/${encodeURIComponent(repository.name)}`,
    }];
  });

  const createdAt = typeof user.created_at === 'string' && Number.isFinite(Date.parse(user.created_at)) ? user.created_at : null;
  return { publicRepos, followers, starsEarned, projects, languages, notices, ...(createdAt ? { createdAt } : {}) };
}

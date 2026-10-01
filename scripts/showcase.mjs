const API_ORIGIN = 'https://api.github.com';
const WEB_ORIGIN = 'https://github.com';
const SHOWCASE_LIMIT = 6;
const REQUEST_TIMEOUT_MS = 20_000;
const USERNAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
const REPOSITORY_PATTERN = /^[a-zA-Z0-9_.-]{1,100}$/;
const SHOWCASE_ERROR = 'GitHub profile showcase unavailable. Try again later.';
const SHOWCASE_QUERY = `query ProfileShowcase($login: String!) {
  user(login: $login) {
    itemShowcase {
      hasPinnedItems
      items(first: 6) {
        nodes { __typename ... on Repository { name description isPrivate owner { login } } }
        pageInfo { hasNextPage }
      }
    }
  }
}`;

function project(name, owner, description) {
  if (
    typeof name !== 'string' ||
    !REPOSITORY_PATTERN.test(name) ||
    name === '.' ||
    name === '..' ||
    typeof owner !== 'string' ||
    !USERNAME_PATTERN.test(owner) ||
    (description !== null && typeof description !== 'string')
  ) {
    throw new Error(SHOWCASE_ERROR);
  }

  return {
    name,
    owner,
    description: description ?? '',
    url: `${WEB_ORIGIN}/${owner}/${name}`,
  };
}

function uniqueProjects(projects) {
  const paths = projects.map(({ url }) => url.toLowerCase());

  if (
    projects.length > SHOWCASE_LIMIT ||
    new Set(paths).size !== paths.length
  ) {
    throw new Error(SHOWCASE_ERROR);
  }

  return projects;
}

function attribute(attributes, name) {
  return (
    attributes.match(
      new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'),
    )?.[2] ?? ''
  );
}

function hasClass(attributes, name) {
  return attribute(attributes, 'class').split(/\s+/).includes(name);
}

function profilePaths(html) {
  const sections = [...html.matchAll(/<ol\b([^>]*)>([\s\S]*?)<\/ol>/gi)].filter(
    (match) => hasClass(match[1], 'js-pinned-items-reorder-list'),
  );

  if (sections.length !== 1) {
    throw new Error(SHOWCASE_ERROR);
  }

  const section = sections[0][2];
  const items = [...section.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)];

  if (items.length > SHOWCASE_LIMIT || (items.length === 0 && section.trim())) {
    throw new Error(SHOWCASE_ERROR);
  }

  return uniqueProjects(
    items.flatMap((item) => {
      const anchors = [...item[1].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
      const repositoryLinks = anchors.filter((anchor) =>
        [...anchor[2].matchAll(/<span\b([^>]*)>/gi)].some((span) =>
          hasClass(span[1], 'repo'),
        ),
      );

      if (
        repositoryLinks.length === 0 &&
        anchors.some((anchor) =>
          /^https:\/\/gist\.github\.com\//.test(attribute(anchor[1], 'href')),
        )
      ) {
        return [];
      }

      if (repositoryLinks.length !== 1) {
        throw new Error(SHOWCASE_ERROR);
      }

      const path = attribute(repositoryLinks[0][1], 'href').match(
        /^\/([^/]+)\/([^/]+)$/,
      );

      if (!path) {
        throw new Error(SHOWCASE_ERROR);
      }

      return [project(path[2], path[1], '')];
    }),
  );
}

async function request(fetchImpl, url, options = {}) {
  return fetchImpl(url, {
    ...options,
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { 'User-Agent': 'mekans-desk-profile', ...options.headers },
  });
}

async function anonymousShowcase(username, fetchImpl) {
  const response = await request(fetchImpl, `${WEB_ORIGIN}/${username}`, {
    headers: { Accept: 'text/html' },
  });

  if (!response.ok) {
    throw new Error(SHOWCASE_ERROR);
  }

  const selected = profilePaths(await response.text());
  const projects = [];

  for (const selection of selected) {
    const metadata = await request(
      fetchImpl,
      `${API_ORIGIN}/repos/${selection.owner}/${selection.name}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (!metadata.ok) {
      throw new Error(SHOWCASE_ERROR);
    }

    const repository = await metadata.json();

    if (
      repository?.private !== false ||
      repository.name?.toLowerCase() !== selection.name.toLowerCase() ||
      repository.owner?.login?.toLowerCase() !== selection.owner.toLowerCase()
    ) {
      throw new Error(SHOWCASE_ERROR);
    }

    projects.push(
      project(repository.name, repository.owner.login, repository.description),
    );
  }

  return uniqueProjects(projects);
}

export async function collectShowcase(
  username,
  { env = process.env, fetchImpl = fetch } = {},
) {
  if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) {
    throw new Error('Invalid GitHub username.');
  }

  try {
    const token =
      typeof env.GITHUB_TOKEN === 'string' ? env.GITHUB_TOKEN.trim() : '';

    if (!token) {
      return await anonymousShowcase(username, fetchImpl);
    }

    const response = await request(fetchImpl, `${API_ORIGIN}/graphql`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: SHOWCASE_QUERY,
        variables: { login: username },
      }),
    });

    if (response.status === 401 || response.status === 403) {
      return await anonymousShowcase(username, fetchImpl);
    }

    if (!response.ok) {
      throw new Error(SHOWCASE_ERROR);
    }

    const body = await response.json();
    const showcase = body?.data?.user?.itemShowcase;
    const nodes = showcase?.items?.nodes;

    if (
      body.errors ||
      typeof showcase?.hasPinnedItems !== 'boolean' ||
      !Array.isArray(nodes) ||
      nodes.length > SHOWCASE_LIMIT ||
      showcase.items.pageInfo?.hasNextPage !== false
    ) {
      throw new Error(SHOWCASE_ERROR);
    }

    return uniqueProjects(
      nodes.flatMap((node) => {
        if (node?.__typename === 'Gist') {
          return [];
        }

        if (node?.__typename !== 'Repository' || node.isPrivate !== false) {
          throw new Error(SHOWCASE_ERROR);
        }

        return [project(node.name, node.owner?.login, node.description)];
      }),
    );
  } catch {
    throw new Error(SHOWCASE_ERROR);
  }
}

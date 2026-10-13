import assert from 'node:assert/strict';
import test from 'node:test';
import { collectShowcase } from '../scripts/showcase.mjs';

const USERNAME = 'msoltanov';
const TOKEN = 'TOKEN_SENTINEL';
const ERROR = 'GitHub profile showcase unavailable. Try again later.';

function repository(name, owner = USERNAME, extra = {}) {
  return {
    __typename: 'Repository',
    name,
    owner: { login: owner },
    description: `${name} description`,
    isPrivate: false,
    ...extra,
  };
}

function showcase(nodes, hasPinnedItems = true, hasNextPage = false) {
  return {
    data: {
      user: {
        itemShowcase: {
          hasPinnedItems,
          items: { nodes, pageInfo: { hasNextPage } },
        },
      },
    },
  };
}

function response(body, status = 200) {
  return {
    ok: status === 200,
    status,
    json: async () => body,
    text: async () => body,
  };
}

function html(names, heading = 'Pinned') {
  return `<h2>${heading}</h2><ol class="list js-pinned-items-reorder-list">${names.map((name) => `<li class="pinned-item-list-item"><a href="/${name}"><span class="repo">${name.split('/')[1]}</span></a></li>`).join('')}</ol><a href="/unrelated/repository"><span class="repo">Ignore</span></a>`;
}

test('showcase uses six pins in profile order including external owners and forks', async () => {
  const nodes = [
    repository('zeta'),
    repository('fork', 'external', { isFork: true }),
    ...['delta', 'charlie', 'bravo', 'alpha'].map((name) => repository(name)),
  ];
  const result = await collectShowcase(USERNAME, {
    env: { GITHUB_TOKEN: TOKEN },
    fetchImpl: async (input, options) => {
      assert.equal(String(input), 'https://api.github.com/graphql');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, `Bearer ${TOKEN}`);
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      const body = JSON.parse(options.body);
      assert.equal(body.variables.login, USERNAME);
      assert.match(body.query, /itemShowcase/);
      assert.match(body.query, /first:\s*6/);
      return response(showcase(nodes));
    },
  });
  assert.deepEqual(
    result,
    nodes.map((node) => ({
      name: node.name,
      owner: node.owner.login,
      description: node.description,
      url: `https://github.com/${node.owner.login}/${node.name}`,
    })),
  );
});

test('showcase uses GitHub popular selection unchanged when no pins exist', async () => {
  const nodes = [repository('less-starred'), repository('more-starred')];
  const result = await collectShowcase(USERNAME, {
    env: { GITHUB_TOKEN: TOKEN },
    fetchImpl: async () => response(showcase(nodes, false)),
  });
  assert.deepEqual(
    result.map(({ name }) => name),
    ['less-starred', 'more-starred'],
  );
});

test('showcase ignores pinned gists and confirms a valid empty showcase', async () => {
  for (const nodes of [[], [{ __typename: 'Gist' }]]) {
    assert.deepEqual(
      await collectShowcase(USERNAME, {
        env: { GITHUB_TOKEN: TOKEN },
        fetchImpl: async () => response(showcase(nodes)),
      }),
      [],
    );
  }
});

test('anonymous showcase reads only the displayed pins or popular section and validates public metadata', async () => {
  for (const heading of ['Pinned', 'Popular repositories']) {
    const calls = [];
    const result = await collectShowcase(USERNAME, {
      env: { PROFILE_STATS_TOKEN: TOKEN },
      fetchImpl: async (input, options) => {
        const url = new URL(input);
        calls.push(url);
        assert.equal(options.headers.Authorization, undefined);
        assert.equal(options.redirect, 'error');
        if (url.origin === 'https://github.com') {
          assert.equal(url.pathname, `/${USERNAME}`);
          return response(
            html(['external/fork', `${USERNAME}/source`], heading),
          );
        }
        const [, , owner, name] = url.pathname.split('/');
        return response({
          name,
          owner: { login: owner },
          description: `${name} description`,
          private: false,
          fork: true,
          html_url: 'https://evil.invalid/',
        });
      },
    });
    assert.equal(calls.length, 3);
    assert.deepEqual(
      result.map(({ url }) => url),
      [
        'https://github.com/external/fork',
        `https://github.com/${USERNAME}/source`,
      ],
    );
  }
});

test('rejected public credentials fall back anonymously without exposing either token', async () => {
  let calls = 0;
  const result = await collectShowcase(USERNAME, {
    env: { GITHUB_TOKEN: TOKEN, PROFILE_STATS_TOKEN: 'PRIVATE_TOKEN' },
    fetchImpl: async (input, options) => {
      calls += 1;
      if (new URL(input).origin === 'https://api.github.com') {
        assert.equal(options.headers.Authorization, `Bearer ${TOKEN}`);
        return response({}, 401);
      }
      assert.equal(options.headers.Authorization, undefined);
      return response(html([]));
    },
  });
  assert.equal(calls, 2);
  assert.deepEqual(result, []);
});

test('invalid showcase responses never yield a partial selection or private metadata', async () => {
  const invalid = [
    showcase([
      repository('good'),
      repository('PRIVATE_SENTINEL', USERNAME, { isPrivate: true }),
    ]),
    showcase([repository('bad/name')]),
    showcase([repository('..')]),
    showcase([repository('name', '../bad')]),
    showcase([repository('same'), repository('same')]),
    showcase(
      Array.from({ length: 7 }, (_, index) => repository(`repo-${index}`)),
    ),
    showcase([repository('one')], true, true),
    { data: { user: null } },
    {
      errors: [{ message: 'TOKEN_SENTINEL' }],
      ...showcase([repository('partial')]),
    },
  ];
  for (const value of invalid) {
    await assert.rejects(
      collectShowcase(USERNAME, {
        env: { GITHUB_TOKEN: TOKEN },
        fetchImpl: async () => response(value),
      }),
      { message: ERROR },
    );
  }
});

test('malformed anonymous markup and metadata fail without clearing the last known selection', async () => {
  for (const body of [
    '<html>Login required</html>',
    html([`${USERNAME}/same`, `${USERNAME}/same`]),
    html(['../escape']),
    '<ol class="js-pinned-items-reorder-list"><li>Broken</li></ol>',
  ]) {
    await assert.rejects(
      collectShowcase(USERNAME, {
        env: {},
        fetchImpl: async () => response(body),
      }),
      { message: ERROR },
    );
  }
  await assert.rejects(
    collectShowcase(USERNAME, {
      env: {},
      fetchImpl: async (input) =>
        new URL(input).origin === 'https://github.com'
          ? response(html([`${USERNAME}/private`]))
          : response({
              name: 'PRIVATE_SENTINEL',
              private: true,
              owner: { login: USERNAME },
            }),
    }),
    { message: ERROR },
  );
});

test('HTTP, GraphQL, JSON and network failures use one sanitized error', async () => {
  for (const fetchImpl of [
    async () => response({}, 500),
    async () => {
      throw new Error(TOKEN);
    },
    async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error(TOKEN);
      },
    }),
  ]) {
    await assert.rejects(
      collectShowcase(USERNAME, { env: { GITHUB_TOKEN: TOKEN }, fetchImpl }),
      { message: ERROR },
    );
  }
});

test('invalid usernames fail before any showcase network request', async () => {
  for (const username of ['../escape', '', null, 'a/b']) {
    await assert.rejects(
      collectShowcase(username, {
        env: {},
        fetchImpl: () => {
          assert.fail('Unexpected network request');
        },
      }),
      { message: 'Invalid GitHub username.' },
    );
  }
});

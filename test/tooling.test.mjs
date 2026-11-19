import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { relative } from 'node:path';
import { ESLint } from 'eslint';

const root = fileURLToPath(new URL('../', import.meta.url));

test('dependency files contain one development entry per package', async () => {
  for (const name of ['package.json', 'package-lock.json']) {
    const source = await readFile(
      new URL(`../${name}`, import.meta.url),
      'utf8',
    );
    const block = source.match(/"devDependencies"\s*:\s*\{([^}]+)\}/)?.[1];
    assert.ok(block, `${name} must declare development dependencies.`);
    const names = [...block.matchAll(/"([^"\\]+)"\s*:/g)].map(
      ([, dependency]) => dependency,
    );
    assert.equal(
      new Set(names).size,
      names.length,
      `${name} has duplicate dependencies.`,
    );
  }
});

test('every development dependency matches the root lock entry and installed version', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  );
  const lock = JSON.parse(
    await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(lock.packages[''].devDependencies, manifest.devDependencies);
  for (const [name, version] of Object.entries(manifest.devDependencies)) {
    assert.equal(lock.packages[`node_modules/${name}`]?.version, version, name);
    const installed = JSON.parse(
      await readFile(
        new URL(`../node_modules/${name}/package.json`, import.meta.url),
        'utf8',
      ),
    );
    assert.equal(
      installed.version,
      version,
      `${name} must match the lockfile.`,
    );
  }
});

test('lint discovery includes every application and test module', async () => {
  const linter = new ESLint({ cwd: root });
  const results = await linter.lintFiles(['scripts/**/*.mjs', 'test/**/*.mjs']);
  const actual = results
    .map(({ filePath }) => relative(root, filePath).replaceAll('\\', '/'))
    .sort();
  const expected = [];
  for (const directory of ['scripts', 'test']) {
    for (const name of await readdir(
      new URL(`../${directory}/`, import.meta.url),
    )) {
      if (name.endsWith('.mjs')) {
        expected.push(`${directory}/${name}`);
      }
    }
  }
  assert.deepEqual(actual, expected.sort());
});

test('the project linter rejects undeclared identifiers in application code', async () => {
  const linter = new ESLint({ cwd: root });
  const [result] = await linter.lintText(
    'export function example() { return misspelledIdentifier; }',
    { filePath: 'scripts/style-contract-probe.mjs' },
  );
  assert.ok(result.messages.some(({ ruleId }) => ruleId === 'no-undef'));
});

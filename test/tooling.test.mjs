import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { relative } from 'node:path';
import { ESLint } from 'eslint';

const root = fileURLToPath(new URL('../', import.meta.url));

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

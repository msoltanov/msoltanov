import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const workflow = await readFile(
  new URL('../.github/workflows/update-profile.yml', import.meta.url),
  'utf8',
);
const publication = workflow.match(
  / {6}- name: Commit changed assets[\s\S]*? {8}run: \|\r?\n([\s\S]*)$/,
);
assert.ok(publication, 'The profile publication step is missing.');
const script = publication[1]
  .split(/\r?\n/)
  .map((line) => line.replace(/^ {10}/, ''))
  .join('\n');
const shell =
  process.platform === 'win32'
    ? [
        join(process.env.LOCALAPPDATA ?? '', 'Programs/Git/bin/bash.exe'),
        join(process.env.ProgramFiles ?? '', 'Git/bin/bash.exe'),
      ].find(existsSync)
    : 'bash';
const mockCommands = `
push_count=0
git() {
  printf 'COMMAND:%s\\n' "git $*"
  case "$1" in
    diff) return "$DIFF_STATUS" ;;
    commit) return "$COMMIT_STATUS" ;;
    fetch) return "$FETCH_STATUS" ;;
    rebase) return "$REBASE_STATUS" ;;
    push)
      push_count=$((push_count + 1))
      if ((push_count <= PUSH_FAILURES)); then
        return 1
      fi
      ;;
  esac
  return 0
}
gh() {
  printf 'COMMAND:%s\\n' "gh $*"
  return 0
}
readonly -f git gh
`;

function runPublication(environment = {}) {
  assert.ok(shell, 'Install Bash to check the workflow shell logic.');
  const result = spawnSync(
    shell,
    ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-s'],
    {
      input: mockCommands + script,
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...process.env,
        PROFILE_DEFAULT_BRANCH: 'release/profile',
        DIFF_STATUS: '1',
        COMMIT_STATUS: '0',
        FETCH_STATUS: '0',
        REBASE_STATUS: '0',
        PUSH_FAILURES: '0',
        ...environment,
      },
    },
  );
  assert.ifError(result.error);
  return {
    ...result,
    commands: result.stdout
      .split(/\r?\n/)
      .filter((line) => line.startsWith('COMMAND:'))
      .map((line) => line.slice('COMMAND:'.length)),
  };
}

test('publication rebases onto the latest default branch before its first push', () => {
  const result = runPublication();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.commands.slice(-3), [
    'git fetch origin release/profile',
    'git rebase FETCH_HEAD',
    'git push origin HEAD:release/profile',
  ]);
  assert.ok(
    result.commands.indexOf('gh auth setup-git') <
      result.commands.indexOf('git fetch origin release/profile'),
  );
});

test('a rejected publication fetches and rebases again before retrying', () => {
  const result = runPublication({ PUSH_FAILURES: '1' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    result.commands.filter((command) =>
      /^git (fetch|rebase|push) /.test(command),
    ),
    [
      'git fetch origin release/profile',
      'git rebase FETCH_HEAD',
      'git push origin HEAD:release/profile',
      'git fetch origin release/profile',
      'git rebase FETCH_HEAD',
      'git push origin HEAD:release/profile',
    ],
  );
});

test('publication stops after three rejected pushes and never forces a push', () => {
  const result = runPublication({ PUSH_FAILURES: '3' });
  assert.notEqual(result.status, 0);
  assert.equal(
    result.commands.filter((command) => command.startsWith('git push ')).length,
    3,
  );
  assert.ok(
    result.commands.every((command) => !/--force|\s-f(?:\s|$)/.test(command)),
  );
});

test('a rebase conflict stops publication without a push', () => {
  const result = runPublication({ REBASE_STATUS: '1' });
  assert.notEqual(result.status, 0);
  assert.ok(result.commands.includes('git rebase FETCH_HEAD'));
  assert.ok(
    result.commands.every((command) => !command.startsWith('git push ')),
  );
});

test('a fetch failure stops publication before a rebase or push', () => {
  const result = runPublication({ FETCH_STATUS: '1' });
  assert.notEqual(result.status, 0);
  assert.ok(result.commands.includes('git fetch origin release/profile'));
  assert.ok(
    result.commands.every((command) => !/^git (rebase|push) /.test(command)),
  );
});

test('unchanged generated assets do not create a commit or contact the remote', () => {
  const result = runPublication({ DIFF_STATUS: '0' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.commands, [
    'git add -A -- assets README.md data/stats.json',
    'git diff --cached --quiet',
  ]);
});

test('a commit failure stops publication before remote authentication', () => {
  const result = runPublication({ COMMIT_STATUS: '1' });
  assert.notEqual(result.status, 0);
  assert.ok(result.commands.every((command) => !command.startsWith('gh ')));
  assert.ok(
    result.commands.every(
      (command) => !/^git (fetch|rebase|push) /.test(command),
    ),
  );
});

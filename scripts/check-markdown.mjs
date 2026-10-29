import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const documents = ['CONTRIBUTING.md'];
if (existsSync('docs/ARCHITECTURE.md')) {
  documents.push('docs/ARCHITECTURE.md');
}

for (const [config, files] of [
  ['.markdownlint.json', documents],
  ['.markdownlint-profile.json', ['README.md']],
]) {
  const result = spawnSync(
    'python',
    ['-B', '-m', 'pymarkdown', '--config', config, 'scan', ...files],
    { stdio: 'inherit' },
  );
  if (result.error || result.status !== 0) {
    process.exitCode = 1;
    break;
  }
}

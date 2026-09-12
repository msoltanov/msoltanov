import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DOMParser } from '@xmldom/xmldom';

const directories = ['scripts', 'test'];
for (const directory of directories) {
  for (const name of await readdir(directory)) {
    if (!name.endsWith('.mjs')) {
      continue;
    }
    const path = join(directory, name);
    const source = await readFile(path, 'utf8');
    assert.doesNotMatch(source, /^\s*(?:\/\/|\/\*|\*)/m, `${path}: source comments are not permitted`);
    const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${path}: JavaScript syntax check failed`);
  }
}

const assets = (await readdir('assets')).filter((name) => name.endsWith('.svg'));
assert.equal(assets.length, 8, 'Generate all eight profile assets before this check.');
for (const name of assets) {
  const svg = await readFile(join('assets', name), 'utf8');
  const document = new DOMParser({ onError: () => { throw new Error(`Invalid SVG XML: ${name}`); } }).parseFromString(svg, 'image/svg+xml');
  assert.equal(document.documentElement.nodeName, 'svg');
  assert.ok(document.getElementsByTagName('title').length);
  assert.ok(document.getElementsByTagName('desc').length);
  assert.doesNotMatch(svg, /<script\b|<foreignObject\b|<image\b|<animate\b|\son[a-z]+\s*=|<!DOCTYPE|<!ENTITY|\bhref\s*=/i);
  assert.doesNotMatch(svg, /(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}/);
}
process.stdout.write(`JavaScript syntax and source policy passed. ${assets.length} SVG files passed XML and static-content checks.\n`);

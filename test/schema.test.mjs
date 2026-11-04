import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  validateCachePayload,
  validateProfile,
  validateStats,
} from '../scripts/validate-data.mjs';

const profile = JSON.parse(
  await readFile(new URL('../config/profile.json', import.meta.url), 'utf8'),
);
const stats = JSON.parse(
  await readFile(new URL('../data/stats.json', import.meta.url), 'utf8'),
);

test('the owned profile and statistics formats accept current persisted data', () => {
  assert.equal(validateProfile(profile), profile);
  assert.equal(validateStats(stats), stats);
});

test('the profile schema rejects unknown settings and malformed supported values', () => {
  for (const change of [
    { unexpectedSetting: true },
    { username: '../outside' },
    { languageLimit: 10 },
    { animated: 'true' },
    { workingWith: [''] },
    { projectSource: 'invented' },
    { activity: { enabled: true, maxCommitLines: 0 } },
    { contact: { emails: ['not an email'] } },
    { filters: { includeForks: 'false' } },
  ]) {
    assert.throws(
      () => validateProfile({ ...profile, ...change }),
      /Invalid profile configuration/,
    );
  }
});

test('the statistics schema rejects invented counts, invalid dates and unknown persisted fields', () => {
  for (const change of [
    { updatedAt: '2026-02-30' },
    { unexpectedSetting: true },
    { activity: { commits: -1, additions: 0, deletions: 0 } },
    { activity: { commits: 1.5, additions: 0, deletions: 0 } },
    { languages: { ...stats.languages, scope: 'invented' } },
    {
      languages: {
        ...stats.languages,
        rows: [{ name: 'Go', percentage: 101 }],
      },
    },
    {
      latestRelease: {
        repository: 'example',
        tag: 'v1',
        publishedAt: 'yesterday',
        url: 'https://github.com/example',
      },
    },
  ]) {
    assert.throws(
      () => validateStats({ ...stats, ...change }),
      /Invalid statistics snapshot/,
    );
  }
});

test('nullable unavailable totals and complete zero totals keep distinct meanings', () => {
  const unavailable = { ...stats, activity: null, latestRelease: null };
  const zero = {
    ...stats,
    activity: { commits: 0, additions: 0, deletions: 0 },
  };
  assert.equal(validateStats(unavailable), unavailable);
  assert.equal(validateStats(zero), zero);
});

test('the cache schema describes complete version-one commit records and rejects unknown versions', () => {
  const value = {
    version: 1,
    authorId: 'FIXTURE_AUTHOR',
    commits: [['b'.repeat(40), 5, 1, 0]],
    heads: { ['a'.repeat(40)]: [0] },
  };
  assert.equal(validateCachePayload(value), value);
  for (const change of [
    { version: 2 },
    { commits: [['b'.repeat(40), 5, 1]] },
    { heads: { invalid: [0] } },
  ]) {
    assert.throws(
      () => validateCachePayload({ ...value, ...change }),
      /Invalid decoded activity cache/,
    );
  }
});

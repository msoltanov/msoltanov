import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeLanguages } from '../scripts/languages.mjs';

test('weights languages by bytes across repositories', () => {
  assert.deepEqual(summarizeLanguages([{ Python: 100 }, { Python: 100, Go: 800 }]), {
    rows: [{ name: 'Go', percentage: 80 }, { name: 'Python', percentage: 20 }],
    alsoUsed: [],
  });
});

test('rounds to tenths that total 100 and orders ties by language name', () => {
  assert.deepEqual(summarizeLanguages([{ Python: 1, Go: 1, C: 1 }]).rows, [
    { name: 'C', percentage: 33.4 },
    { name: 'Go', percentage: 33.3 },
    { name: 'Python', percentage: 33.3 },
  ]);
});

test('Other represents every language outside the configured limit', () => {
  assert.deepEqual(summarizeLanguages([{ Python: 500, Go: 300, Ruby: 100, C: 100 }], 2), {
    rows: [
      { name: 'Python', percentage: 50 },
      { name: 'Go', percentage: 30 },
      { name: 'Other', percentage: 20 },
    ],
    alsoUsed: ['C', 'Ruby'],
  });
});

test('empty and zero-byte repositories have no language rows', () => {
  assert.deepEqual(summarizeLanguages([]), { rows: [], alsoUsed: [] });
  assert.deepEqual(summarizeLanguages([{}, { Python: 0 }]), { rows: [], alsoUsed: [] });
});

test('excludes configured languages before ranking, percentages, and Other', () => {
  const result = summarizeLanguages([
    { HTML: 9000, CSS: 1000, Python: 40, Go: 30 },
    { HTML: 2000, CSS: 500, Python: 10, Ruby: 10, C: 10 },
  ], 2, ['HTML', 'CSS']);
  assert.deepEqual(result, {
    rows: [
      { name: 'Python', percentage: 50 },
      { name: 'Go', percentage: 30 },
      { name: 'Other', percentage: 20 },
    ],
    alsoUsed: ['C', 'Ruby'],
  });
});

test('has no language rows when every language is excluded', () => {
  assert.deepEqual(summarizeLanguages([{ HTML: 100, CSS: 200 }], 6, ['HTML', 'CSS']), {
    rows: [], alsoUsed: [],
  });
});

test('still validates byte counts for excluded languages', () => {
  assert.throws(() => summarizeLanguages([{ HTML: -1 }], 6, ['HTML']), /Invalid language data/);
});

test('rejects malformed language exclusions', () => {
  for (const excluded of ['HTML', null, {}, [42], [''], ['bad\u0000key']]) {
    assert.throws(() => summarizeLanguages([], 6, excluded), /Invalid language exclusions/);
  }
});

test('language output is independent of repository and object-key order', () => {
  const first = summarizeLanguages([{ Python: 17, Go: 23 }, { C: 23, Go: 4 }], 2);
  const second = summarizeLanguages([{ Go: 4, C: 23 }, { Go: 23, Python: 17 }], 2);
  assert.deepEqual(first, second);
});

test('rejects malformed responses, unsafe keys, and invalid byte counts', () => {
  const invalid = [
    null, [], 'secret', { Python: -1 }, { Python: NaN }, { Python: Infinity },
    { Python: '2' }, { Python: 1.2 }, { Python: Number.MAX_SAFE_INTEGER + 1 },
    { description: 'PRIVATE_METADATA_SENTINEL' },
    JSON.parse('{"__proto__": 1}'), { constructor: 1 }, { 'bad\u0000key': 1 },
  ];
  for (const value of invalid) {
    assert.throws(() => summarizeLanguages([value]), /^Error: Invalid language data\.$/);
  }
});

test('handles very large safe byte totals without overflowing the percentage calculation', () => {
  const result = summarizeLanguages([{ C: Number.MAX_SAFE_INTEGER, Go: Number.MAX_SAFE_INTEGER }]);
  assert.deepEqual(result.rows, [{ name: 'C', percentage: 50 }, { name: 'Go', percentage: 50 }]);
});

test('rejects unusable display limits', () => {
  for (const limit of [0, -1, NaN, 1.1, '6']) {
    assert.throws(() => summarizeLanguages([], limit), /Invalid language limit/);
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';

test('every month uses the requested season', async () => {
  const { SEASONS, seasonForDate } = await import('../scripts/seasons.mjs');
  assert.deepEqual(SEASONS, ['winter', 'spring', 'summer', 'autumn']);
  const expected = [
    'winter',
    'winter',
    'spring',
    'spring',
    'spring',
    'summer',
    'summer',
    'summer',
    'autumn',
    'autumn',
    'winter',
    'winter',
  ];
  expected.forEach((season, month) => {
    assert.equal(seasonForDate(new Date(Date.UTC(2026, month, 15))), season);
  });
});

test('seasons switch exactly at Ashgabat midnight, including leap years', async () => {
  const { seasonForDate } = await import('../scripts/seasons.mjs');
  const boundaries = [
    ['2026-02-28T19:00:00.000Z', 'winter', 'spring'],
    ['2028-02-29T19:00:00.000Z', 'winter', 'spring'],
    ['2026-05-31T19:00:00.000Z', 'spring', 'summer'],
    ['2026-08-31T19:00:00.000Z', 'summer', 'autumn'],
    ['2026-10-31T19:00:00.000Z', 'autumn', 'winter'],
  ];
  for (const [value, previous, next] of boundaries) {
    const date = new Date(value);
    assert.equal(seasonForDate(new Date(date.getTime() - 1)), previous);
    assert.equal(seasonForDate(date), next);
  }
});

test('invalid season dates fail with a fixed error', async () => {
  const { seasonForDate } = await import('../scripts/seasons.mjs');
  for (const invalid of [new Date('invalid'), null, '2026-11-01']) {
    assert.throws(() => seasonForDate(invalid), {
      message: 'Invalid season date.',
    });
  }
});

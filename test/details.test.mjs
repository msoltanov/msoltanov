import assert from 'node:assert/strict';
import test from 'node:test';

async function uptime(start, now) {
  const module = await import('../scripts/details.mjs');
  return module.formatUptime(start, new Date(now));
}

test('uptime counts complete calendar months and days across leap years', async () => {
  assert.equal(await uptime('2020-02-29', '2026-02-28T18:00:00Z'), '6y 0m 0d');
  assert.equal(await uptime('2020-02-29', '2026-02-27T18:00:00Z'), '5y 11m 29d');
  assert.equal(await uptime('2015-08-31', '2026-09-14T00:00:00Z'), '11y 0m 14d');
});

test('missing, invalid, and future uptime dates remain unavailable', async () => {
  for (const start of [undefined, '', 'invalid', '2026-02-30', '2030-01-01']) {
    assert.equal(await uptime(start, '2026-09-14T00:00:00Z'), 'Unavailable');
  }
});

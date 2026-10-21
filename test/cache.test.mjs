import assert from 'node:assert/strict';
import { createCipheriv, hkdfSync } from 'node:crypto';
import { mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { emptyCache, readCache, writeCache } from '../scripts/cache.mjs';

const SECRET = 'cache-fixture-token';
const HEAD = 'a'.repeat(40);
const COMMIT = 'b'.repeat(40);
const ENCRYPTED_LIMIT = 16 * 1024 * 1024;
const DECODED_LIMIT = 64 * 1024 * 1024;

test('the committed version-one cache fixture remains readable and round trips without exposing metadata', async (t) => {
  const cache = await readCache(
    new URL('fixtures/cache-v1.bin', import.meta.url),
    SECRET,
  );
  assert.equal(cache.authorId, 'FIXTURE_AUTHOR');
  assert.deepEqual(cache.heads.get(HEAD), [[COMMIT, 5, 1, 0]]);
  const path = await cachePath(t);
  await writeCache(path, SECRET, cache);
  const bytes = await readFile(path);
  assert.equal(bytes.subarray(0, 4).toString(), 'ACC1');
  assert.ok(!bytes.includes(Buffer.from('FIXTURE_AUTHOR')));
  assert.deepEqual(await readCache(path, SECRET), cache);
  assert.deepEqual(await readCache(path, 'another-token'), emptyCache());
});

test('truncated, tampered and unsupported cache payloads are discarded', async (t) => {
  const path = await cachePath(t);
  const valid = encryptedPayload(JSON.stringify(payload()));
  const tampered = Buffer.from(valid);
  tampered[tampered.length - 1] ^= 1;
  for (const bytes of [
    valid.subarray(0, 3),
    valid.subarray(0, 20),
    valid.subarray(0, valid.length - 1),
    tampered,
    encryptedPayload(JSON.stringify({ ...payload(), version: 2 })),
    encryptedPayload('{not JSON}'),
    encryptedPayload(JSON.stringify({ ...payload(), heads: { [HEAD]: [9] } })),
    encryptedPayload(JSON.stringify({ ...payload(), heads: [] })),
    encryptedPayload(
      JSON.stringify({ ...payload(), authorId: 'x'.repeat(1025) }),
    ),
  ]) {
    await writeFile(path, bytes);
    assert.deepEqual(await readCache(path, SECRET), emptyCache());
  }
});

test('complete cache histories support SHA-256 identifiers and shared commits', async (t) => {
  const path = await cachePath(t);
  const wideHead = 'c'.repeat(64);
  const merge = ['d'.repeat(64), 10, 2, 2];
  const cache = {
    authorId: 'FIXTURE_AUTHOR',
    heads: new Map([
      [HEAD, [[COMMIT, 5, 1, 0], merge]],
      [wideHead, [merge]],
    ]),
  };
  await writeCache(path, SECRET, cache);
  assert.deepEqual(await readCache(path, SECRET), cache);
});

test('the writer preserves an accepted cache when replacement records are malformed', async (t) => {
  const path = await cachePath(t);
  const previous = encryptedPayload(JSON.stringify(payload()));
  await writeFile(path, previous);
  await assert.rejects(
    writeCache(path, SECRET, {
      authorId: 'FIXTURE_AUTHOR',
      heads: new Map([[HEAD, [[COMMIT, -1, 0, 0]]]]),
    }),
    /Invalid activity cache/,
  );
  assert.ok((await readFile(path)).equals(previous));
});

test('oversized cache files are rejected before decoding', async (t) => {
  const path = await cachePath(t);
  const file = await open(path, 'w');
  await file.truncate(ENCRYPTED_LIMIT + 1);
  await file.close();
  assert.deepEqual(await readCache(path, SECRET), emptyCache());
});

test('deterministic malformed-cache fuzz cases never produce accepted partial data', async (t) => {
  const path = await cachePath(t);
  const fixture = await readFile(
    new URL('fixtures/cache-v1.bin', import.meta.url),
  );
  for (let index = 0; index < 64; index += 1) {
    const bytes = Buffer.from(fixture);
    bytes[(index * 7919) % bytes.length] ^= 1 << (index % 8);
    await writeFile(path, bytes);
    assert.deepEqual(await readCache(path, SECRET), emptyCache());
  }
});

test('authenticated compressed payloads cannot exceed the decoded size limit', async (t) => {
  const path = await cachePath(t);
  const value = { ...payload(), authorId: 'x'.repeat(DECODED_LIMIT + 1) };
  await writeFile(path, encryptedPayload(JSON.stringify(value)));
  const cache = await readCache(path, SECRET);
  assert.ok(
    cache.authorId === null,
    'An oversized decoded cache must be discarded.',
  );
});

test('the writer rejects oversized payloads without replacing the previous cache', async (t) => {
  const path = await cachePath(t);
  const previous = encryptedPayload(JSON.stringify(payload()));
  await writeFile(path, previous);
  const oversized = {
    authorId: 'x'.repeat(DECODED_LIMIT + 1),
    heads: new Map(),
  };
  await assert.rejects(
    writeCache(path, SECRET, oversized),
    /Activity cache exceeds the size limit/,
  );
  assert.ok((await readFile(path)).equals(previous));
});

async function cachePath(t) {
  const directory = await mkdtemp(join(tmpdir(), 'profile-cache-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return join(directory, 'activity.bin');
}

function payload() {
  return {
    version: 1,
    authorId: 'FIXTURE_AUTHOR',
    commits: [[COMMIT, 5, 1, 0]],
    heads: { [HEAD]: [0] },
  };
}

function encryptedPayload(plain) {
  const iv = Buffer.alloc(12);
  const key = Buffer.from(
    hkdfSync('sha256', SECRET, 'alabay-code-profile', 'activity-cache-v1', 32),
  );
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(gzipSync(plain)),
    cipher.final(),
  ]);
  return Buffer.concat([
    Buffer.from('ACC1'),
    iv,
    cipher.getAuthTag(),
    encrypted,
  ]);
}

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const VERSION = 1;
const MAGIC = Buffer.from('ACC1');
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const OID_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;

function key(secret) {
  return Buffer.from(hkdfSync('sha256', secret, 'alabay-code-profile', 'activity-cache-v1', 32));
}

export function emptyCache() {
  return { authorId: null, heads: new Map() };
}

function encode(cache) {
  const indexes = new Map();
  const commits = [];
  const heads = {};
  for (const [head, entries] of cache.heads) {
    heads[head] = entries.map((entry) => {
      if (!indexes.has(entry[0])) {
        indexes.set(entry[0], commits.length);
        commits.push(entry);
      }
      return indexes.get(entry[0]);
    });
  }
  return JSON.stringify({ version: VERSION, authorId: cache.authorId, commits, heads });
}

function decode(text) {
  const value = JSON.parse(text);
  const valid = (entry) => Array.isArray(entry) && entry.length === 4 && OID_PATTERN.test(entry[0])
    && entry.slice(1).every((number) => Number.isSafeInteger(number) && number >= 0);
  if (value?.version !== VERSION || typeof value.authorId !== 'string' || !Array.isArray(value.commits)
    || !value.commits.every(valid) || !value.heads || typeof value.heads !== 'object') {
    return emptyCache();
  }
  const heads = new Map();
  for (const [head, indexes] of Object.entries(value.heads)) {
    if (!OID_PATTERN.test(head) || !Array.isArray(indexes) || !indexes.every((index) => Number.isSafeInteger(index) && value.commits[index])) {
      return emptyCache();
    }
    heads.set(head, indexes.map((index) => value.commits[index]));
  }
  return { authorId: value.authorId, heads };
}

export async function readCache(path, secret) {
  if (!secret) {
    return emptyCache();
  }
  try {
    const file = await readFile(path);
    if (!file.subarray(0, MAGIC.length).equals(MAGIC)) {
      return emptyCache();
    }
    const iv = file.subarray(MAGIC.length, MAGIC.length + IV_LENGTH);
    const tag = file.subarray(MAGIC.length + IV_LENGTH, MAGIC.length + IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', key(secret), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(file.subarray(MAGIC.length + IV_LENGTH + TAG_LENGTH)), decipher.final()]);
    return decode(gunzipSync(plain).toString('utf8'));
  } catch {
    return emptyCache();
  }
}

export async function writeCache(path, secret, cache) {
  if (!secret || !cache.authorId) {
    return;
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const encrypted = Buffer.concat([cipher.update(gzipSync(encode(cache))), cipher.final()]);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, Buffer.concat([MAGIC, iv, cipher.getAuthTag(), encrypted]));
  await rename(temporary, path);
}

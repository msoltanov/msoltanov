import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { mkdir, open, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const VERSION = 1;
const MAGIC = Buffer.from('ACC1');
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const MAX_CACHE_FILE_BYTES = 16 * 1024 * 1024;
const MAX_CACHE_DECODED_BYTES = 64 * 1024 * 1024;
const MAX_CACHE_COMMITS = 1_000_000;
const MAX_CACHE_HEADS = 100_000;
const MAX_AUTHOR_ID_LENGTH = 1024;
const ENVELOPE_BYTES = MAGIC.length + IV_LENGTH + TAG_LENGTH;
const OID_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;

function key(secret) {
  return Buffer.from(
    hkdfSync('sha256', secret, 'alabay-code-profile', 'activity-cache-v1', 32),
  );
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
  return JSON.stringify({
    version: VERSION,
    authorId: cache.authorId,
    commits,
    heads,
  });
}

function decode(text) {
  const value = JSON.parse(text);
  const valid = (entry) =>
    Array.isArray(entry) &&
    entry.length === 4 &&
    OID_PATTERN.test(entry[0]) &&
    entry
      .slice(1)
      .every((number) => Number.isSafeInteger(number) && number >= 0);
  if (
    value?.version !== VERSION ||
    typeof value.authorId !== 'string' ||
    !value.authorId ||
    value.authorId.length > MAX_AUTHOR_ID_LENGTH ||
    !Array.isArray(value.commits) ||
    value.commits.length > MAX_CACHE_COMMITS ||
    !value.commits.every(valid) ||
    !value.heads ||
    typeof value.heads !== 'object' ||
    Array.isArray(value.heads) ||
    Object.keys(value.heads).length > MAX_CACHE_HEADS
  ) {
    return emptyCache();
  }
  const heads = new Map();
  for (const [head, indexes] of Object.entries(value.heads)) {
    if (
      !OID_PATTERN.test(head) ||
      !Array.isArray(indexes) ||
      indexes.length > MAX_CACHE_COMMITS ||
      !indexes.every(
        (index) =>
          Number.isSafeInteger(index) && index >= 0 && value.commits[index],
      )
    ) {
      return emptyCache();
    }
    heads.set(
      head,
      indexes.map((index) => value.commits[index]),
    );
  }
  return { authorId: value.authorId, heads };
}

export async function readCache(path, secret) {
  if (!secret) {
    return emptyCache();
  }
  try {
    const file = await readCacheFile(path);
    if (
      file.length < ENVELOPE_BYTES ||
      !file.subarray(0, MAGIC.length).equals(MAGIC)
    ) {
      return emptyCache();
    }
    const iv = file.subarray(MAGIC.length, MAGIC.length + IV_LENGTH);
    const tag = file.subarray(
      MAGIC.length + IV_LENGTH,
      MAGIC.length + IV_LENGTH + TAG_LENGTH,
    );
    const decipher = createDecipheriv('aes-256-gcm', key(secret), iv, {
      authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([
      decipher.update(file.subarray(MAGIC.length + IV_LENGTH + TAG_LENGTH)),
      decipher.final(),
    ]);
    return decode(
      gunzipSync(plain, { maxOutputLength: MAX_CACHE_DECODED_BYTES }).toString(
        'utf8',
      ),
    );
  } catch {
    return emptyCache();
  }
}

export async function writeCache(path, secret, cache) {
  if (!secret || !cache.authorId) {
    return;
  }
  const plain = encode(cache);
  if (Buffer.byteLength(plain, 'utf8') > MAX_CACHE_DECODED_BYTES) {
    throw new Error('Activity cache exceeds the size limit.');
  }
  if (!decode(plain).authorId) {
    throw new Error('Invalid activity cache.');
  }
  const compressed = gzipSync(plain);
  if (compressed.length + ENVELOPE_BYTES > MAX_CACHE_FILE_BYTES) {
    throw new Error('Activity cache exceeds the size limit.');
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(
    temporary,
    Buffer.concat([MAGIC, iv, cipher.getAuthTag(), encrypted]),
  );
  await rename(temporary, path);
}

async function readCacheFile(path) {
  const file = await open(path, 'r');
  try {
    const metadata = await file.stat();
    if (!metadata.isFile() || metadata.size > MAX_CACHE_FILE_BYTES) {
      throw new Error('Activity cache exceeds the size limit.');
    }
    const bytes = Buffer.alloc(metadata.size + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const result = await file.read(
        bytes,
        offset,
        bytes.length - offset,
        null,
      );
      if (result.bytesRead === 0) {
        break;
      }
      offset += result.bytesRead;
    }
    if (offset !== metadata.size) {
      throw new Error('Activity cache size changed during reading.');
    }
    return bytes.subarray(0, offset);
  } finally {
    await file.close();
  }
}

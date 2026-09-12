const PERCENTAGE_TENTHS = 1000n;
const TENTHS_PER_PERCENT = 10;
const MAX_LANGUAGE_NAME_LENGTH = 100;
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function compareNames(first, second) {
  if (first === second) {
    return 0;
  }

  return first < second ? -1 : 1;
}

export function summarizeLanguages(repositoryLanguages, limit = 6) {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error('Invalid language limit.');
  }

  if (!Array.isArray(repositoryLanguages)) {
    throw new Error('Invalid language data.');
  }

  const totals = new Map();

  for (const languages of repositoryLanguages) {
    if (languages === null || typeof languages !== 'object' || Array.isArray(languages)) {
      throw new Error('Invalid language data.');
    }

    for (const [name, bytes] of Object.entries(languages)) {
      if (!name || name.length > MAX_LANGUAGE_NAME_LENGTH || /[\u0000-\u001f\u007f]/.test(name)
        || RESERVED_KEYS.has(name) || !Number.isSafeInteger(bytes) || bytes < 0) {
        throw new Error('Invalid language data.');
      }

      if (bytes > 0) {
        totals.set(name, (totals.get(name) ?? 0n) + BigInt(bytes));
      }
    }
  }

  const sorted = [...totals].map(([name, bytes]) => ({ name, bytes })).sort((first, second) => {
    if (first.bytes === second.bytes) {
      return compareNames(first.name, second.name);
    }

    return first.bytes > second.bytes ? -1 : 1;
  });

  if (sorted.length === 0) {
    return { rows: [], alsoUsed: [] };
  }

  const visible = sorted.slice(0, limit);
  const remaining = sorted.slice(limit);
  const totalBytes = sorted.reduce((total, language) => total + language.bytes, 0n);

  if (remaining.length > 0) {
    visible.push({ name: 'Other', bytes: remaining.reduce((total, language) => total + language.bytes, 0n) });
  }

  const portions = visible.map(({ name, bytes }, index) => ({
    name,
    index,
    tenths: bytes * PERCENTAGE_TENTHS / totalBytes,
    remainder: bytes * PERCENTAGE_TENTHS % totalBytes,
  }));
  const unallocated = Number(PERCENTAGE_TENTHS - portions.reduce((total, portion) => total + portion.tenths, 0n));
  const byRemainder = [...portions].sort((first, second) => {
    if (first.remainder === second.remainder) {
      return first.index - second.index;
    }

    return first.remainder > second.remainder ? -1 : 1;
  });

  for (let index = 0; index < unallocated; index += 1) {
    byRemainder[index].tenths += 1n;
  }

  return {
    rows: portions.map(({ name, tenths }) => ({ name, percentage: Number(tenths) / TENTHS_PER_PERCENT })),
    alsoUsed: remaining.map(({ name }) => name),
  };
}

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validators = new Map();
for (const name of ['profile', 'stats', 'cache']) {
  const path = new URL(`../schemas/${name}.schema.json`, import.meta.url);
  validators.set(name, ajv.compile(JSON.parse(await readFile(path, 'utf8'))));
}

export function validateProfile(value) {
  return validate(
    value,
    validators.get('profile'),
    'Invalid profile configuration.',
  );
}

export function validateStats(value) {
  return validate(
    value,
    validators.get('stats'),
    'Invalid statistics snapshot.',
  );
}

export function validateCachePayload(value) {
  return validate(
    value,
    validators.get('cache'),
    'Invalid decoded activity cache.',
  );
}

export async function validateDataFiles(root = PROJECT_ROOT) {
  const profile = JSON.parse(
    await readFile(join(root, 'config/profile.json'), 'utf8'),
  );
  const stats = JSON.parse(
    await readFile(join(root, 'data/stats.json'), 'utf8'),
  );
  validateProfile(profile);
  validateStats(stats);
}

function validate(value, validator, message) {
  if (!validator(value)) {
    throw new Error(message);
  }
  return value;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await validateDataFiles();
    process.stdout.write(
      'Profile configuration and statistics snapshot match their schemas.\n',
    );
  } catch {
    process.stderr.write(
      'Data schema validation failed. Check the profile configuration and statistics snapshot.\n',
    );
    process.exitCode = 1;
  }
}

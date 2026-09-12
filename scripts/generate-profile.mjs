import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectProfile } from './github.mjs';
import { renderAssets } from './svg.mjs';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_FOCUS_ITEMS = 8;

function validateConfig(config) {
  const shortText = (value, maximum) => typeof value === 'string' && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f]/.test(value);
  if (!shortText(config.name, 23) || !shortText(config.username, 23) || !shortText(config.editorName, 20)
    || !Array.isArray(config.focus) || config.focus.length > MAX_FOCUS_ITEMS
    || config.focus.some((focus) => !shortText(focus, 29))
    || !Array.isArray(config.featuredRepositories) || config.featuredRepositories.length > 3
    || !Number.isInteger(config.languageLimit) || config.languageLimit < 1 || config.languageLimit > 8) {
    throw new Error('Invalid profile configuration. Check the documented content limits.');
  }
}

export async function generateProfile({ root = PROJECT_ROOT, env = process.env, collect = collectProfile } = {}) {
  const config = JSON.parse(await readFile(join(root, 'config/profile.json'), 'utf8'));
  validateConfig(config);
  const data = await collect(config, { env });
  const assets = renderAssets(config, data);
  const directory = join(root, 'assets');
  await mkdir(directory, { recursive: true });
  let changed = 0;
  for (const [name, svg] of Object.entries(assets)) {
    const destination = join(directory, name);
    let existing;
    try {
      existing = await readFile(destination, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    if (existing === svg) {
      continue;
    }
    const temporary = `${destination}.tmp`;
    await writeFile(temporary, svg, 'utf8');
    await rename(temporary, destination);
    changed += 1;
  }
  return { changed, notices: data.notices };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await generateProfile();
    for (const notice of result.notices) {
      process.stdout.write(`${notice}\n`);
    }
    process.stdout.write(result.changed ? `Updated ${result.changed} profile assets.\n` : 'Profile assets unchanged.\n');
  } catch {
    process.stderr.write('Profile generation failed. Check API access, rate limits, and configuration. No API details are logged.\n');
    process.exitCode = 1;
  }
}

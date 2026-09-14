import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectProfile } from './github.mjs';
import { collectActivity, collectLatestRelease } from './activity.mjs';
import { formatUptime } from './details.mjs';
import { updateReadme } from './readme.mjs';
import { renderAssets } from './svg.mjs';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_FOCUS_ITEMS = 8;
const MAX_NAMED_LANGUAGES = 9;
const MAX_DETAIL_ITEMS = 10;
const MAX_DETAIL_LENGTH = 48;
const MAX_CONTACT_LENGTH = 100;

function validateConfig(config) {
  const shortText = (value, maximum) => typeof value === 'string' && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f]/.test(value);
  const textList = (values) => Array.isArray(values) && values.length <= MAX_DETAIL_ITEMS && values.every((value) => shortText(value, MAX_DETAIL_LENGTH));
  if (!shortText(config.name, 23) || !shortText(config.username, 23) || !shortText(config.editorName, 20)
    || !Array.isArray(config.focus) || config.focus.length > MAX_FOCUS_ITEMS
    || config.focus.some((focus) => !shortText(focus, 29))
    || !Array.isArray(config.featuredRepositories) || config.featuredRepositories.length > 3
    || !Number.isInteger(config.languageLimit) || config.languageLimit < 1 || config.languageLimit > MAX_NAMED_LANGUAGES) {
    throw new Error('Invalid profile configuration. Check the documented content limits.');
  }
  if (config.system !== undefined && (!config.system || Array.isArray(config.system) || typeof config.system !== 'object' || !Object.values(config.system).every(textList))) {
    throw new Error('Invalid system configuration. Use short lists of text.');
  }
  if (config.uptime !== undefined && (!config.uptime || !['github', 'birth', 'coding', 'custom'].includes(config.uptime.source)
    || (config.uptime.source !== 'github' && formatUptime(config.uptime.since) === 'Unavailable'))) {
    throw new Error('Invalid uptime configuration. Use a valid start date.');
  }
  if (config.contact !== undefined) {
    const { emails = [], socials = [] } = config.contact ?? {};
    if (!Array.isArray(emails) || emails.length > 2 || emails.some((email) => !shortText(email, MAX_CONTACT_LENGTH) || !/^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(email))
      || !Array.isArray(socials) || socials.length > 4 || socials.some((social) => !shortText(social?.label, MAX_DETAIL_LENGTH)
        || (social.url !== null && (typeof social.url !== 'string' || !/^https:\/\/[^\s<>"']+$/.test(social.url))))) {
      throw new Error('Invalid contact configuration. Use email addresses and HTTPS profile links.');
    }
  }
}

export async function generateProfile({ root = PROJECT_ROOT, env = process.env, collect = collectProfile, activityCollect = collectActivity, releaseCollect = collectLatestRelease, now = new Date() } = {}) {
  const config = JSON.parse(await readFile(join(root, 'config/profile.json'), 'utf8'));
  validateConfig(config);
  const collected = await collect(config, { env });
  const data = { ...collected, notices: [...collected.notices] };
  if (config.uptime) {
    const accountAge = config.uptime.source === 'github';
    data.uptime = { label: accountAge ? 'GitHub uptime' : 'Uptime', value: formatUptime(accountAge ? data.createdAt : config.uptime.since, now) };
  }
  if (config.activity?.enabled) {
    data.activity = await activityCollect(config, { env, now });
    if (data.activity.status !== 'ready') {
      data.notices.push(data.activity.reason === 'insufficient-scope'
        ? 'Activity totals require PROFILE_STATS_TOKEN with repo and read:user scopes.'
        : 'Activity totals unavailable. Check PROFILE_STATS_TOKEN access and GitHub API limits.');
    }
  }
  if (config.latestRelease) {
    try {
      data.latestRelease = await releaseCollect({ ...config, featuredRepositories: data.projects.map((project) => project.name) }, { env });
    } catch {
      data.notices.push('Latest public release unavailable. Check GitHub API access.');
    }
  }
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
  const readmePath = join(root, 'README.md');
  let readme;
  try {
    readme = await readFile(readmePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  if (readme !== undefined) {
    const updated = updateReadme(readme, config, assets);
    if (updated !== readme) {
      const temporary = `${readmePath}.tmp`;
      await writeFile(temporary, updated, 'utf8');
      await rename(temporary, readmePath);
      changed += 1;
    }
  }
  return { changed, notices: data.notices };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await generateProfile();
    for (const notice of result.notices) {
      process.stdout.write(`${notice}\n`);
    }
    process.stdout.write(result.changed ? `Updated ${result.changed} profile files.\n` : 'Profile files unchanged.\n');
  } catch {
    process.stderr.write('Profile generation failed. Check API access, rate limits, and configuration. No API details are logged.\n');
    process.exitCode = 1;
  }
}

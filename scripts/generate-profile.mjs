import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectProfile } from './github.mjs';
import { collectActivity, collectLatestRelease } from './activity.mjs';
import { readCache, writeCache } from './cache.mjs';
import { formatUptime } from './details.mjs';
import { updateReadme } from './readme.mjs';
import { BADGE_ICON_NAMES, renderAssets } from './svg.mjs';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_FOCUS_ITEMS = 8;
const MAX_NAMED_LANGUAGES = 9;
const MAX_DETAIL_ITEMS = 10;
const MAX_DETAIL_LENGTH = 48;
const MAX_CONTACT_LENGTH = 100;
const MAX_TECH_STACK_ITEMS = 30;
const ACTIVITY_BUDGET_MS = 20 * 60 * 1_000;
const STATS_PATH = 'data/stats.json';
const CACHE_PATH = '.cache/activity.bin';

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
        || (social.url !== null && (typeof social.url !== 'string' || !/^https:\/\/[^\s<>"']+$/.test(social.url)))
        || (social.icon !== undefined && !BADGE_ICON_NAMES.includes(social.icon))
        || (social.handle !== undefined && !shortText(social.handle, MAX_DETAIL_LENGTH)))) {
      throw new Error('Invalid contact configuration. Use email addresses and HTTPS profile links.');
    }
  }
  if (config.techStack !== undefined && (!Array.isArray(config.techStack) || config.techStack.length > MAX_TECH_STACK_ITEMS
    || config.techStack.some((item) => !shortText(item?.label, MAX_DETAIL_LENGTH) || typeof item.icon !== 'string' || !/^[a-z0-9-]{1,32}$/.test(item.icon)
      || typeof item.url !== 'string' || !/^https:\/\/[^\s<>"']+$/.test(item.url)))) {
    throw new Error('Invalid tech stack configuration. Use a label, a skill icon identifier, and an HTTPS link.');
  }
  if (config.activity !== undefined && (!config.activity || typeof config.activity !== 'object'
    || (config.activity.maxCommitLines !== undefined && (!Number.isSafeInteger(config.activity.maxCommitLines) || config.activity.maxCommitLines < 1)))) {
    throw new Error('Invalid activity configuration. Use a positive whole number for maxCommitLines.');
  }
}

function count(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

async function readStats(path) {
  let stats;
  try {
    stats = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return {};
  }
  const result = {};
  if (typeof stats?.updatedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(stats.updatedAt)) {
    result.updatedAt = stats.updatedAt;
  }
  const { activity, languages, latestRelease } = stats ?? {};
  if (activity && count(activity.commits) && count(activity.additions) && count(activity.deletions)) {
    result.activity = { commits: activity.commits, additions: activity.additions, deletions: activity.deletions };
  }
  if (languages && ['public', 'authorized'].includes(languages.scope) && Array.isArray(languages.rows) && Array.isArray(languages.alsoUsed)
    && languages.rows.every((row) => typeof row?.name === 'string' && Number.isFinite(row.percentage))
    && languages.alsoUsed.every((name) => typeof name === 'string')) {
    result.languages = { rows: languages.rows, alsoUsed: languages.alsoUsed, scope: languages.scope };
  }
  if (latestRelease && ['repository', 'tag', 'publishedAt', 'url'].every((field) => typeof latestRelease[field] === 'string')) {
    result.latestRelease = latestRelease;
  }
  return result;
}

async function replaceFile(path, content) {
  let existing;
  try {
    existing = await readFile(path, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  if (existing === content) {
    return false;
  }
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, content, 'utf8');
  await rename(temporary, path);
  return true;
}

async function unchanged(directory, assets) {
  for (const [name, svg] of Object.entries(assets)) {
    try {
      if (await readFile(join(directory, name), 'utf8') !== svg) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

const ACTIVITY_NOTICES = {
  'insufficient-scope': 'Activity totals require PROFILE_STATS_TOKEN with repo and read:user scopes.',
  'time-budget': 'Activity scan reached its time budget. Progress is cached and the next run continues.',
};

export async function generateProfile({
  root = PROJECT_ROOT, env = process.env, collect = collectProfile, activityCollect = collectActivity,
  releaseCollect = collectLatestRelease, now = new Date(), activityBudgetMs = ACTIVITY_BUDGET_MS,
} = {}) {
  const config = JSON.parse(await readFile(join(root, 'config/profile.json'), 'utf8'));
  validateConfig(config);
  const previous = await readStats(join(root, STATS_PATH));
  const collected = await collect(config, { env });
  const data = { ...collected, notices: [...collected.notices] };
  if (data.privateUnavailable && previous.languages?.scope === 'authorized') {
    data.languages = previous.languages;
    data.notices.push('Kept the last known private language totals.');
  }
  if (config.uptime) {
    const accountAge = config.uptime.source === 'github';
    data.uptime = { label: accountAge ? 'GitHub uptime' : 'Uptime', value: formatUptime(accountAge ? data.createdAt : config.uptime.since, now) };
  }
  if (config.activity?.enabled) {
    const secret = typeof env.PROFILE_STATS_TOKEN === 'string' ? env.PROFILE_STATS_TOKEN.trim() : '';
    const cachePath = join(root, CACHE_PATH);
    const cache = await readCache(cachePath, secret);
    try {
      data.activity = await activityCollect(config, { env, now, cache, deadline: Date.now() + activityBudgetMs });
    } finally {
      await writeCache(cachePath, secret, cache).catch(() => data.notices.push('Activity cache could not be saved.'));
    }
    if (data.activity.status !== 'ready') {
      data.notices.push(ACTIVITY_NOTICES[data.activity.reason] ?? 'Activity totals unavailable. Check PROFILE_STATS_TOKEN access and GitHub API limits.');
      if (previous.activity) {
        data.activity = { status: 'ready', reason: null, scope: data.activity.scope, ...previous.activity };
        data.notices.push('Kept the last known activity totals.');
      }
    }
  }
  if (config.latestRelease) {
    try {
      data.latestRelease = await releaseCollect({ ...config, featuredRepositories: data.projects.map((project) => project.name) }, { env });
    } catch {
      data.notices.push('Latest public release unavailable. Check GitHub API access.');
      if (previous.latestRelease) {
        data.latestRelease = previous.latestRelease;
      }
    }
  }
  const directory = join(root, 'assets');
  const today = now.toISOString().slice(0, 10);
  let assets = renderAssets(config, { ...data, updatedAt: previous.updatedAt ?? today });
  let updatedAt = previous.updatedAt ?? today;
  if (updatedAt !== today && !(await unchanged(directory, assets))) {
    updatedAt = today;
    assets = renderAssets(config, { ...data, updatedAt });
  }
  let changed = 0;
  for (const [name, svg] of Object.entries(assets)) {
    changed += await replaceFile(join(directory, name), svg) ? 1 : 0;
  }
  for (const name of await readdir(directory)) {
    if (/^(?:profile|languages|badge)-.+\.svg$/.test(name) && !(name in assets)) {
      await rm(join(directory, name));
      changed += 1;
    }
  }
  const stats = {
    updatedAt,
    activity: data.activity?.status === 'ready' ? { commits: data.activity.commits, additions: data.activity.additions, deletions: data.activity.deletions } : null,
    languages: data.languages,
    latestRelease: data.latestRelease ?? null,
  };
  changed += await replaceFile(join(root, STATS_PATH), `${JSON.stringify(stats, null, 2)}\n`) ? 1 : 0;
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
    changed += await replaceFile(readmePath, updateReadme(readme, config, assets)) ? 1 : 0;
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

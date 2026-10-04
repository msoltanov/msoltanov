import { badgeItems } from './svg.mjs';
import { DOMParser } from '@xmldom/xmldom';

const TECH_STACK =
  /(<!-- tech-stack:start -->)[\s\S]*?(<!-- tech-stack:end -->)/;
const SOCIALS = /(<!-- socials:start -->)[\s\S]*?(<!-- socials:end -->)/;
const PROJECTS = /(<!-- projects:start -->)[\s\S]*?(<!-- projects:end -->)/;
const OPENING = /(<!-- opening:start -->)[\s\S]*?(<!-- opening:end -->)/;
const WORKSHOP = /(<!-- workshop:start -->)[\s\S]*?(<!-- workshop:end -->)/;
const ENVIRONMENT =
  /(<!-- environment:start -->)[\s\S]*?(<!-- environment:end -->)/;
const ACTIVITY_SCOPE =
  /(<!-- activity-scope:start -->)[\s\S]*?(<!-- activity-scope:end -->)/;
const USERNAME = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
const REPOSITORY = /^[a-zA-Z0-9_.-]{1,100}$/;
const PROJECT_THUMBNAIL_WIDTH = 96;
const MOBILE_MEDIA = '(max-width: 600px)';
const REDUCED_MOTION_MEDIA = '(prefers-reduced-motion: reduce)';

function attribute(value) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ],
  );
}

function techStack(items, newline) {
  const icon = (item, theme) =>
    `https://skillicons.dev/icons?i=${item.icon}&amp;theme=${theme}`;
  return [
    '<p>',
    ...items.flatMap((item) => [
      `  <a href="${attribute(item.url)}" title="${attribute(item.label)}"><picture>`,
      `    <source media="(prefers-color-scheme: dark)" srcset="${icon(item, 'dark')}">`,
      `    <img src="${icon(item, 'light')}" alt="${attribute(item.label)}" width="48" height="48">`,
      '  </picture></a>',
    ]),
    '</p>',
  ].join(newline);
}

function socials(items, newline) {
  return [
    '<p>',
    items
      .map(
        (item) =>
          `<a href="${attribute(item.url)}" title="${attribute(item.handle)}">${attribute(item.label)}</a>`,
      )
      .join(' · '),
    '</p>',
  ].join(newline);
}

function picture(
  name,
  description,
  assets,
  newline,
  alignment = '',
  width = 860,
) {
  const light =
    assets[`${name}-light.gif`] && assets[`${name}-dark.gif`]
      ? `${name}-light.gif`
      : `${name}-light.svg`;
  const dark = light.replace('-light.', '-dark.');
  const mobile = name === 'workshop' && assets['workshop-mobile-dark.svg'];
  const mobileExtension = assets['workshop-mobile-dark.gif'] ? 'gif' : 'svg';
  return [
    '<picture>',
    ...(mobile && mobileExtension === 'gif'
      ? [
          `  <source media="${MOBILE_MEDIA} and ${REDUCED_MOTION_MEDIA}" srcset="assets/workshop-mobile-dark.svg">`,
        ]
      : []),
    ...(light.endsWith('.gif')
      ? [
          `  <source media="${REDUCED_MOTION_MEDIA}" srcset="assets/${name}-dark.svg">`,
        ]
      : []),
    ...(mobile
      ? [
          `  <source media="${MOBILE_MEDIA}" srcset="assets/workshop-mobile-dark.${mobileExtension}">`,
        ]
      : []),
    `  <source media="(prefers-color-scheme: dark)" srcset="assets/${dark}">`,
    `  <img alt="${description}" src="assets/${light}" width="${width}"${['top', 'right'].includes(alignment) ? ` align="${alignment}"` : ''}>`,
    '</picture>',
  ].join(newline);
}

function workshop(assets, newline, presentation = 'standalone') {
  const description = assets['workshop-light.svg']?.match(
    /<desc id="desc">([\s\S]*?)<\/desc>/,
  )?.[1];
  if (!assets['workshop-dark.svg'] || description === undefined) {
    return '';
  }
  return picture(
    'workshop',
    description,
    assets,
    newline,
    presentation === 'opening' ? 'top' : '',
  );
}

function opening(assets, newline) {
  const description = assets['workshop-light.svg']?.match(
    /<desc id="desc">([\s\S]*?)<\/desc>/,
  )?.[1];
  if (!assets['workshop-dark.svg'] || description === undefined) {
    return '';
  }
  const statsDescription = assets['stats-light.svg']?.match(
    /<desc id="desc">([\s\S]*?)<\/desc>/,
  )?.[1];
  return [
    '<div class="profile-opening">',
    '<!-- workshop:start -->',
    workshop(assets, newline, 'opening'),
    '<!-- workshop:end -->',
    ...(statsDescription !== undefined && assets['stats-dark.svg']
      ? [picture('stats', statsDescription, assets, newline, 'top')]
      : []),
    '</div>',
  ].join(newline);
}

function projectCards(config, assets, newline, projects) {
  const automatic = config.projectSource === 'github-profile';
  if (
    !USERNAME.test(config.username ?? '') ||
    (!automatic && !Array.isArray(config.featuredRepositories))
  ) {
    return '';
  }
  return Object.keys(assets)
    .filter((name) => /^project-[1-9]\d*-light\.svg$/.test(name))
    .sort(
      (left, right) => Number(left.split('-')[1]) - Number(right.split('-')[1]),
    )
    .flatMap((name) => {
      const dark = name.replace('-light.svg', '-dark.svg');
      let metadata;
      try {
        const document = new DOMParser({
          onError: (level, message) => {
            throw new Error(`${level}: ${message}`);
          },
        }).parseFromString(assets[name], 'image/svg+xml');
        metadata = {
          repository: document.getElementsByTagName('title')[0]?.textContent,
          description: document.getElementsByTagName('desc')[0]?.textContent,
        };
      } catch {
        return [];
      }
      const { repository, description } = metadata;
      const selected = automatic
        ? projects?.[Number(name.split('-')[1]) - 1]
        : null;
      const owner = automatic ? selected?.owner : config.username;
      if (
        !assets[dark] ||
        !REPOSITORY.test(repository ?? '') ||
        repository === '.' ||
        repository === '..' ||
        !USERNAME.test(owner ?? '') ||
        description === undefined ||
        (automatic
          ? selected?.name !== repository
          : !config.featuredRepositories.includes(repository))
      ) {
        return [];
      }
      const inferredDescription = description.startsWith(`${repository}.`)
        ? description.slice(repository.length + 1).trimStart()
        : description;
      const publicDescription =
        typeof selected?.description === 'string'
          ? selected.description
          : inferredDescription;
      const label =
        owner.toLowerCase() === config.username.toLowerCase()
          ? repository
          : `${owner}/${repository}`;
      return [
        '<div class="workbench-entry">',
        picture(
          name.replace('-light.svg', ''),
          attribute(description),
          assets,
          newline,
          'right',
          PROJECT_THUMBNAIL_WIDTH,
        ),
        `<h4><a href="https://github.com/${owner}/${repository}">${attribute(label)}</a></h4>`,
        ...(publicDescription
          ? [`<p>${attribute(publicDescription)}</p>`]
          : []),
        '<br clear="right">',
        '</div>',
        '',
      ];
    })
    .join(newline)
    .trimEnd();
}

function environment(config, newline) {
  const system = config.system;
  const mobileSystems = (system.os ?? []).filter((value) =>
    /^Android\b/i.test(value),
  );
  const workspaceSystems = (system.os ?? []).filter(
    (value) => !/^Android\b/i.test(value),
  );
  const everyday = [
    ['Workspace', workspaceSystems],
    ['Editors', system.ides],
    ['Terminals', system.terminals],
  ].filter(([, values]) => values?.length);
  const learningRust = /\bRust\b/.test(config.currentlyLearning ?? '');
  const groups = [
    [
      'Programming',
      system.programming?.map((value) =>
        value === 'Rust' && learningRust ? 'Rust (learning)' : value,
      ),
    ],
    ['Mobile', [...new Set([...mobileSystems, ...(system.mobile ?? [])])]],
    ['Configuration & scripting', system.daily],
    ['Earlier experience', system.previous],
    ['Human languages', system.human],
  ];
  const details = groups
    .filter(([, values]) => values?.length)
    .map(
      ([label, values]) =>
        `<p><strong>${attribute(label)}</strong><br>${values.map(attribute).join(' · ')}</p>`,
    );
  return [
    '',
    '### My toolbox',
    '',
    ...(everyday.length
      ? [
          '<table>',
          '<thead><tr><th scope="col">Group</th><th scope="col">Tools</th></tr></thead>',
          '<tbody>',
          ...everyday.map(
            ([label, values]) =>
              `<tr><th scope="row">${label}</th><td>${values.map(attribute).join(' · ')}</td></tr>`,
          ),
          '</tbody>',
          '</table>',
          '',
        ]
      : []),
    ...(details.length
      ? [
          '<details>',
          '<summary>More tools &amp; background</summary>',
          '',
          ...details,
          '',
          '</details>',
        ]
      : []),
  ].join(newline);
}

function replaceSection(readme, pattern, content, newline) {
  const block = content ? `${newline}${content}${newline}` : newline;
  return readme.replace(
    pattern,
    (original, start, end) => `${start}${block}${end}`,
  );
}

function activityScope(config) {
  if (!config.activity?.enabled) {
    return '';
  }
  const sentences = [
    'Commits: public + private, all branches.',
    'Lines of code: added − deleted.',
  ];
  const limit = config.activity.maxCommitLines;
  if (Number.isSafeInteger(limit) && limit > 0) {
    sentences.push(
      `Line totals exclude commits over ${limit.toLocaleString('en-US')} changed lines.`,
    );
  }
  return `<sub>${sentences.join(' ')}</sub>`;
}

export function updateReadme(readme, config, assets, projects) {
  const newline = readme.includes('\r\n') ? '\r\n' : '\n';
  let result = readme.replace(
    /(<img\b[^>]*\balt=")[^"]*("[^>]*\bsrc="assets\/([^"]+)"[^>]*>)/g,
    (original, before, after, name) => {
      const description = assets[name.replace(/\.gif$/, '.svg')]?.match(
        /<desc id="desc">([\s\S]*?)<\/desc>/,
      )?.[1];
      return description === undefined
        ? original
        : `${before}${description}${after}`;
    },
  );
  result = replaceSection(
    result,
    ACTIVITY_SCOPE,
    activityScope(config),
    newline,
  );
  if (config.system) {
    result = replaceSection(
      result,
      ENVIRONMENT,
      environment(config, newline),
      newline,
    );
  }
  if (Array.isArray(config.techStack)) {
    result = replaceSection(
      result,
      TECH_STACK,
      techStack(config.techStack, newline),
      newline,
    );
  }
  if (assets['profile-light.svg']) {
    result = replaceSection(result, OPENING, opening(assets, newline), newline);
    result = replaceSection(
      result,
      PROJECTS,
      projectCards(config, assets, newline, projects),
      newline,
    );
    result = replaceSection(
      result,
      WORKSHOP,
      workshop(
        assets,
        newline,
        OPENING.test(result) ? 'opening' : 'standalone',
      ),
      newline,
    );
  }
  const items = badgeItems(config);
  const block = items.length
    ? `${newline}${socials(items, newline)}${newline}`
    : newline;
  if (SOCIALS.test(result)) {
    return result.replace(
      SOCIALS,
      (original, start, end) => `${start}${block}${end}`,
    );
  }
  return items.length
    ? `${result.trimEnd()}${newline}${newline}<!-- socials:start -->${block}<!-- socials:end -->${newline}`
    : result;
}

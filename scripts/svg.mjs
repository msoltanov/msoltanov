import { drawProject } from './alabay.mjs';
import { drawWorkshop } from './workshop.mjs';
import { SEASON_ACCENTS } from './seasons.mjs';

const WIDTH = 860;
const THEMES = {
  dark: {
    background: '#101315',
    raised: '#1e2528',
    border: '#34403b',
    text: '#e3ebe8',
    muted: '#7d8f87',
    accent: '#91d7bd',
    ink: '#0d1f18',
    outline: '#0d1f18',
    coat: '#e9e4d8',
    copper: '#d7a278',
  },
  light: {
    background: '#fbfcfa',
    raised: '#e6ede8',
    border: '#c3d0c7',
    text: '#1f332a',
    muted: '#62786c',
    accent: '#21634d',
    ink: '#f3faf6',
    outline: '#1f332a',
    coat: '#eee6d8',
    copper: '#b68459',
  },
};
const LANGUAGE_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  PHP: '#4F5D95',
  Go: '#00ADD8',
  Dart: '#00B4AB',
  Rust: '#dea584',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#663399',
  C: '#555555',
  'C++': '#f34b7d',
  Ruby: '#701516',
  Java: '#b07219',
  Lua: '#000080',
  Swift: '#F05138',
  Astro: '#ff5a03',
  QML: '#44a51c',
  MDX: '#fcb32c',
  SCSS: '#c6538c',
  Kotlin: '#A97BFF',
  Elixir: '#6e4a7e',
  Dockerfile: '#384d54',
  Perl: '#0298c3',
  PowerShell: '#012456',
  CMake: '#DA3434',
  QMake: '#3f5a1b',
  'Objective-C': '#438eff',
  'Common Lisp': '#3fb68b',
  Racket: '#3c5caa',
  Tcl: '#e4cc98',
  Just: '#384d54',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  'C#': '#178600',
  Scala: '#c22d40',
  Haskell: '#5e5086',
  Clojure: '#db5855',
  Zig: '#ec915c',
  Nix: '#7e7eff',
  'Jupyter Notebook': '#DA5B0B',
  'Vim Script': '#199f4b',
  HCL: '#844FBA',
  Makefile: '#427819',
  Batchfile: '#C1F12E',
};
const FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace';
const CHARACTER_WIDTH = 0.6;
const HERO_HEIGHT = 540;
const WORKSPACE_X = 270;
const WORKSPACE_Y = 165;
const WORKSPACE_SCALE = 0.68;
const MOBILE_WIDTH = 480;
const MOBILE_INSET = 24;
const MOBILE_FONT_SIZE = 24;
const MOBILE_LINE_HEIGHT = 30;
const MOBILE_PARAGRAPH_GAP = 24;
const MOBILE_SUMMARY_GAP = 12;
const MOBILE_BODY_Y = 270;
const MOBILE_WRAP = 30;
const MOBILE_WORKSPACE_X = -3;
const MOBILE_WORKSPACE_SCALE = 0.56;
const MOBILE_SCENE_HEIGHT = 320;
const MOBILE_FOOTER_OFFSET = 292;
const LAMP_SWITCH_X = 799;
const LAMP_SWITCH_Y = 307.5;
const ROLE_TEXT_MAX_WIDTH = 540;
const PRINCIPLES_LABEL_WIDTH = 240;
const PRINCIPLES = 'Systems. Direction. Delivery.';
const ROLE_FONT_SIZE = 18;
const ROLE_TEXT_X = 50;
const ROLE_BASELINE_Y = 181;
const ROLE_TYPING_SHARE = 0.36;
const ROLE_ERASE_START = 0.88;
const PROJECT_PHASE_STEP = 1 / 8;
const ROLE_CURSOR_GAP = 2;
const WORK_INFO_Y = 292;
const EMPLOYMENT_Y = 225;
const EMPLOYMENT_LINE_HEIGHT = 18;
const MAX_EMPLOYMENT_LINES = 3;
const INTRODUCTION_Y = 411;
const INTRODUCTION_LINE_HEIGHT = 20;
const WORK_INFO_LINE_HEIGHT = 20;
const WORK_INFO_WRAP = 32;
const MAX_WORK_INFO_LINES = 2;
const HERO_FOOTER_Y = 511;
const CURSOR_STEPS_PER_LOOP = 24;
const INTRODUCTION_LINES = [
  'Building software and platforms.',
  'Connecting engineering with growth.',
];
const STATS_HEIGHT = 124;
const PROJECT_WIDTH = 128;
const PROJECT_HEIGHT = 112;
const PROJECT_ILLUSTRATION_SCALE = 0.8;
const ACTIVITY_SCOPE = 'public + private, all branches';
const MOTION_STYLES = `
@keyframes cursor-blink { 0%, 49%, 100% { opacity: 1; } 50%, 99% { opacity: 0; } }
@keyframes bar-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.editor-cursor { animation: cursor-blink 1s steps(1, end) infinite; }
.language-bar { animation: bar-grow 800ms ease-out 1 both; transform-box: fill-box; transform-origin: left center; }
@media (max-width: 600px) {
  .intro-title { font-size: var(--name-mobile-size, 54px); }
  .intro-summary { font-size: var(--summary-mobile-size, 15px); }
  .intro-uptime { display: none; }
  .panel-index { display: none; }
  .hero-stat { font-size: var(--metric-size, 28px); }
  .stat-label { font-size: 23px; }
  .language-heading { font-size: 20px; }
  .language-name, .language-value { font-size: 26px; }
  .language-caption { font-size: 18px; }
}
@media (prefers-reduced-motion: reduce) { .editor-cursor, .language-bar { animation: none; } }
`;

export function escapeXml(value) {
  return String(value)
    .replace(
      /[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu,
      '',
    )
    .replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&apos;',
        })[character],
    );
}

function wrap(value, limit) {
  const words = String(value)
    .replace(/[\r\n\t]+/g, ' ')
    .split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line.length + word.length + 1 <= limit) {
      line += `${line ? ' ' : ''}${word}`;
      continue;
    }
    if (line) {
      lines.push(line);
    }
    let remainder = word;
    while (remainder.length > limit) {
      lines.push(remainder.slice(0, limit));
      remainder = remainder.slice(limit);
    }
    line = remainder;
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}

function countKnown(value, known = true) {
  return known && Number.isSafeInteger(value) && value >= 0;
}

function formatCount(value, known = true) {
  return countKnown(value, known)
    ? value.toLocaleString('en-US')
    : 'Unavailable';
}

function githubValues(config, data) {
  const activity = data.activity;
  const ready = activity?.status === 'ready';
  const loc =
    ready &&
    Number.isSafeInteger(activity.additions) &&
    Number.isSafeInteger(activity.deletions)
      ? activity.additions - activity.deletions
      : null;
  return [
    ...(config.activity?.enabled
      ? [
          ['commits', 'Commits', activity?.commits, ready],
          ['loc', 'Lines of code', loc, loc !== null],
        ]
      : []),
    ['stars', 'Stars', data.starsEarned, true],
    ['followers', 'Followers', data.followers, true],
  ];
}

function locNote(config) {
  const limit = config.activity?.maxCommitLines;
  return Number.isSafeInteger(limit)
    ? `added - deleted, skips commits > ${limit.toLocaleString('en-US')} lines`
    : 'added - deleted';
}

function activityScope(config) {
  return `commits: ${ACTIVITY_SCOPE}; lines of code: ${locNote(config)}`;
}

function canvas(
  theme,
  title,
  description,
  height,
  frame = 'complete',
  season,
  width = WIDTH,
) {
  const colors = {
    ...THEMES[theme],
    accent: SEASON_ACCENTS[season]?.[theme] ?? THEMES[theme].accent,
  };
  const parts = [];
  const bottom = height - 0.5;
  const right = width - 0.5;
  const corner = width - 10.5;
  const framePath = {
    top: `M0.5 ${height}V10.5Q0.5 0.5 10.5 0.5H${corner}Q${right} 0.5 ${right} 10.5V${height}`,
    middle: `M0.5 0V${height}M${right} 0V${height}`,
    bottom: `M0.5 0V${height - 10.5}Q0.5 ${bottom} 10.5 ${bottom}H${corner}Q${right} ${bottom} ${right} ${height - 10.5}V0`,
  };
  const background =
    frame === 'complete'
      ? `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="${colors.background}" stroke="${colors.border}"/>`
      : `<rect width="${width}" height="${height}" fill="${colors.background}"/><path d="${framePath[frame]}" fill="none" stroke="${colors.border}"/>`;
  const rect = (x, y, w, h, color, radius = 0, extra = '') =>
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${color}"${extra ? ` ${extra}` : ''}/>`,
    );
  const text = (x, y, value, color = colors.text, size = 13, extra = '') =>
    parts.push(
      `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" ${extra}>${escapeXml(value)}</text>`,
    );
  const line = (x1, y1, x2, y2, color = colors.border) =>
    parts.push(
      `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${color}"/>`,
    );
  const raw = (markup) => parts.push(markup);
  const finish =
    () => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc" data-frame="${frame}">
<title id="title">${escapeXml(title)}</title>
<desc id="desc">${escapeXml(description)}</desc>
<style>${MOTION_STYLES}</style>
<g font-family="${FONT}" letter-spacing="0">
${background}
${parts.join('\n')}
</g>
</svg>
`;
  return { colors, width, height, rect, text, line, raw, finish };
}

function shorten(value, limit) {
  const text = String(value);
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function languageDescription(data) {
  const { rows, alsoUsed, scope } = data.languages;
  const scopeLabel =
    scope === 'authorized'
      ? 'public + authorized private'
      : 'public repositories';
  if (!rows.length) {
    return 'No language bytes reported.';
  }
  return `Language byte share across eligible owned ${scopeLabel}: ${rows.map((row) => `${row.name} ${row.percentage.toFixed(1)}%`).join(', ')}.${alsoUsed.length ? ` Other includes: ${alsoUsed.join(', ')}.` : ''}`;
}

function listWithAnd(values) {
  if (values.length < 2) {
    return values[0] ?? '';
  }
  return `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`;
}

function mobileIntroduction(config, employment, workingWith) {
  const rows = [];
  let y = MOBILE_BODY_Y;
  const paragraph = (value, className, gap) => {
    const lines = wrap(value, MOBILE_WRAP);
    lines.forEach((text, index) =>
      rows.push({ text, className, y: y + index * MOBILE_LINE_HEIGHT }),
    );
    y += lines.length * MOBILE_LINE_HEIGHT + gap;
  };
  if (employment) {
    paragraph(`${employment}.`, 'intro-employment', MOBILE_PARAGRAPH_GAP);
  }
  if (workingWith) {
    paragraph(`${workingWith}.`, 'intro-working-with', MOBILE_PARAGRAPH_GAP);
  }
  if (config.currentlyLearning) {
    paragraph(
      `Currently learning ${config.currentlyLearning}.`,
      'intro-learning',
      MOBILE_PARAGRAPH_GAP,
    );
  }
  INTRODUCTION_LINES.forEach((value, index) =>
    paragraph(value, 'intro-summary', index === 0 ? MOBILE_SUMMARY_GAP : 0),
  );
  const sceneY = y - MOBILE_LINE_HEIGHT;
  return { rows, sceneY, height: sceneY + MOBILE_SCENE_HEIGHT };
}

function profile(config, data, theme, phase = null, layout = 'desktop') {
  const season = ['winter', 'spring', 'summer', 'autumn'].includes(data.season)
    ? data.season
    : 'winter';
  const values = githubValues(config, data);
  const employment = config.employment
    ? `Working as ${config.employment.role} at ${config.employment.company}${config.employment.location ? ` in ${config.employment.location}` : ''}`
    : '';
  const workingWith = config.workingWith?.length
    ? `Working with ${listWithAnd(config.workingWith)}`
    : '';
  const interests = config.interests?.length
    ? config.interests.join(' · ')
    : '';
  const { system = {} } = config;
  const groups = [
    ['OS', system.os],
    ['IDE', system.ides],
    ['Terminals', system.terminals],
    ['Programming', system.programming],
    ['Mobile stack', system.mobile],
    ['Daily languages', system.daily],
    ['Previous languages', system.previous],
    ['Human languages', system.human],
  ]
    .filter(([, list]) => list?.length)
    .map(([label, list]) => `${label}: ${list.join(', ')}`);
  const release = data.latestRelease;
  const summary = [
    `${config.name}’s ${season} engineering workspace. A sleeping Alabay rests beside a seasonal tree near the desk, computer, server and architecture notebook`,
    config.editorName,
    `Hello, my name is ${config.name}`,
    `Roles: ${config.focus.join(' · ')}`,
    ...(interests ? [`Interests: ${interests}`] : []),
    ...(employment ? [employment] : []),
    ...(workingWith ? [workingWith] : []),
    ...(config.currentlyLearning
      ? [`Currently learning ${config.currentlyLearning}`]
      : []),
    ...(data.uptime ? [`${data.uptime.label}: ${data.uptime.value}`] : []),
    ...groups,
    ...values.map(
      ([, label, value, known]) => `${label}: ${formatCount(value, known)}`,
    ),
    ...(config.activity?.enabled ? [`Scope: ${activityScope(config)}`] : []),
    ...(release
      ? [
          `Latest release: ${release.repository} ${release.tag}, ${release.publishedAt.slice(0, 10)}`,
        ]
      : []),
    ...(data.projects.length
      ? [`Projects: ${data.projects.map((project) => project.name).join(', ')}`]
      : []),
  ]
    .join('. ')
    .concat('. ', languageDescription(data));
  const mobile =
    layout === 'mobile'
      ? mobileIntroduction(config, employment, workingWith)
      : null;
  const width = mobile ? MOBILE_WIDTH : WIDTH;
  const height = mobile?.height ?? HERO_HEIGHT;
  const workspaceX = mobile ? MOBILE_WORKSPACE_X : WORKSPACE_X;
  const workspaceY = mobile?.sceneY ?? WORKSPACE_Y;
  const workspaceScale = mobile ? MOBILE_WORKSPACE_SCALE : WORKSPACE_SCALE;
  const s = canvas(
    theme,
    `${config.editorName} / seasonal workspace`,
    summary,
    height,
    'top',
    data.season,
    width,
  );
  const { colors: c, text, line, rect } = s;
  const inset = mobile ? MOBILE_INSET : 32;
  const name = String(config.name);
  const nameSize = Math.min(
    mobile ? 32 : 34,
    (width - inset * 2) / ((name.length + 1) * CHARACTER_WIDTH),
  );
  const mobileNameSize = nameSize;
  text(
    inset,
    34,
    config.editorName,
    c.accent,
    mobile ? 18 : 13,
    'font-weight="700" letter-spacing="2"',
  );
  if (!mobile) {
    text(
      width - inset,
      34,
      'SOFTWARE / PLATFORMS / GROWTH',
      c.muted,
      11,
      'text-anchor="end" class="panel-index"',
    );
  }
  line(inset, 52, width - inset, 52);
  text(
    width / 2,
    91,
    'Hello, my name is',
    c.text,
    mobile ? 20 : 17,
    'text-anchor="middle" class="intro-greeting"',
  );
  text(
    width / 2,
    132,
    `${name}.`,
    c.text,
    nameSize,
    `font-weight="650" letter-spacing="-1.2" text-anchor="middle" class="intro-title" style="--name-mobile-size: ${mobileNameSize}px"`,
  );
  if (config.focus.length) {
    const slot = phase === null ? 0 : phase * config.focus.length;
    const role =
      config.focus[Math.min(config.focus.length - 1, Math.floor(slot))];
    const progress = slot % 1;
    let characterCount = role.length;
    let state = 'holding';
    if (phase !== null && progress < ROLE_TYPING_SHARE) {
      characterCount = Math.floor((role.length * progress) / ROLE_TYPING_SHARE);
      state = 'typing';
    } else if (phase !== null && progress >= ROLE_ERASE_START) {
      characterCount = Math.floor(
        (role.length * (1 - progress)) / (1 - ROLE_ERASE_START),
      );
      state = 'erasing';
    }
    const typed = role.slice(0, characterCount);
    const roleFontSize = mobile ? 26 : ROLE_FONT_SIZE;
    const roleTextX = mobile ? 48 : ROLE_TEXT_X;
    const roleWidth = mobile ? width - roleTextX - inset : ROLE_TEXT_MAX_WIDTH;
    const size = Math.min(
      roleFontSize,
      roleWidth / (role.length * CHARACTER_WIDTH),
    );
    s.raw(
      `<g class="intro-role" data-role="${escapeXml(role)}" data-state="${state}" opacity="1.000">`,
    );
    text(
      inset,
      ROLE_BASELINE_Y,
      '>',
      c.accent,
      roleFontSize,
      'class="terminal-prompt"',
    );
    text(
      roleTextX,
      ROLE_BASELINE_Y,
      typed,
      c.text,
      size,
      `class="intro-role-title"${typed ? ` textLength="${typed.length * size * CHARACTER_WIDTH}" lengthAdjust="spacingAndGlyphs"` : ''}`,
    );
    rect(
      roleTextX + typed.length * size * CHARACTER_WIDTH + ROLE_CURSOR_GAP,
      ROLE_BASELINE_Y - roleFontSize + 3,
      size * CHARACTER_WIDTH,
      mobile ? 27 : 19,
      c.accent,
      1,
      `class="editor-cursor" opacity="${phase === null || state !== 'holding' || Math.floor(phase * CURSOR_STEPS_PER_LOOP) % 2 === 0 ? 1 : 0}"`,
    );
    s.raw('</g>');
  }
  const principlesSize = mobile
    ? 20
    : Math.min(
        13,
        PRINCIPLES_LABEL_WIDTH / (PRINCIPLES.length * CHARACTER_WIDTH),
      );
  text(
    width - inset,
    mobile ? 217 : ROLE_BASELINE_Y,
    PRINCIPLES,
    c.accent,
    principlesSize,
    'text-anchor="end" class="intro-principles"',
  );
  if (mobile) {
    mobile.rows.forEach((row) =>
      text(
        inset,
        row.y,
        row.text,
        c.text,
        MOBILE_FONT_SIZE,
        `class="${row.className}" style="--summary-mobile-size: ${MOBILE_FONT_SIZE}px"`,
      ),
    );
  } else {
    if (employment) {
      wrap(`${employment}.`, WORK_INFO_WRAP)
        .slice(0, MAX_EMPLOYMENT_LINES)
        .forEach((value, index) =>
          text(
            inset,
            EMPLOYMENT_Y + index * EMPLOYMENT_LINE_HEIGHT,
            value,
            c.text,
            13,
            'class="intro-employment"',
          ),
        );
    }
    let learningY = WORK_INFO_Y;
    if (workingWith) {
      const languages = wrap(`${workingWith}.`, WORK_INFO_WRAP).slice(
        0,
        MAX_WORK_INFO_LINES,
      );
      languages.forEach((value, index) =>
        text(
          inset,
          WORK_INFO_Y + index * WORK_INFO_LINE_HEIGHT,
          value,
          c.text,
          13,
          'class="intro-working-with"',
        ),
      );
      learningY = WORK_INFO_Y + languages.length * WORK_INFO_LINE_HEIGHT + 19;
    }
    if (config.currentlyLearning) {
      wrap(`Currently learning ${config.currentlyLearning}.`, WORK_INFO_WRAP)
        .slice(0, MAX_WORK_INFO_LINES)
        .forEach((value, index) =>
          text(
            inset,
            learningY + index * WORK_INFO_LINE_HEIGHT,
            value,
            c.text,
            13,
            'class="intro-learning"',
          ),
        );
    }
    INTRODUCTION_LINES.forEach((value, index) =>
      text(
        inset,
        INTRODUCTION_Y + index * INTRODUCTION_LINE_HEIGHT,
        value,
        c.text,
        13,
        'class="intro-summary"',
      ),
    );
  }
  const lampX = ((workspaceX + workspaceScale * LAMP_SWITCH_X) / width) * 100;
  const lampY = ((workspaceY + workspaceScale * LAMP_SWITCH_Y) / height) * 100;
  s.raw(
    `<g data-composition="integrated-workspace" data-layout="${layout}" data-lamp-x="${lampX.toFixed(4)}" data-lamp-y="${lampY.toFixed(4)}" transform="translate(${workspaceX} ${workspaceY}) scale(${workspaceScale})">`,
  );
  drawWorkshop(s, phase ?? 0, season, 'integrated', {
    projects: data.projects,
    lamp: data.lamp ?? 'on',
  });
  s.raw('</g>');
  const footerY = mobile ? workspaceY + MOBILE_FOOTER_OFFSET : HERO_FOOTER_Y;
  text(
    inset,
    footerY,
    'ARCHITECTURE / DECISIONS / DELIVERY',
    c.muted,
    mobile ? 12 : 11,
    'letter-spacing="1.2"',
  );
  if (data.uptime) {
    text(
      width - inset,
      footerY,
      `${data.uptime.value} ${data.uptime.label === 'GitHub uptime' ? 'on GitHub' : 'of uptime'}`,
      c.accent,
      mobile ? 14 : 13,
      'text-anchor="end" class="intro-uptime"',
    );
  }
  return s.finish();
}

function statistics(config, data, theme) {
  const values = githubValues(config, data);
  const release = data.latestRelease;
  const description =
    values
      .map(
        ([, label, value, known]) => `${label}: ${formatCount(value, known)}`,
      )
      .join('. ') +
    (config.activity?.enabled ? `. Scope: ${activityScope(config)}.` : '.');
  const s = canvas(
    theme,
    `${config.editorName} / statistics`,
    description,
    STATS_HEIGHT,
    'bottom',
    data.season,
  );
  const { colors: c, text, line } = s;
  const inset = 32;
  line(inset, 4, WIDTH - inset, 4);
  const metricWidth = (WIDTH - inset * 2) / Math.max(values.length, 1);
  values.forEach(([key, label, value, known], index) => {
    const x = inset + index * metricWidth;
    const formatted = formatCount(value, known);
    const fittedSize =
      (metricWidth - 24) / (formatted.length * CHARACTER_WIDTH);
    text(
      x,
      39,
      formatted,
      c.text,
      Math.min(23, fittedSize),
      `font-weight="700" class="hero-stat" style="--metric-size: ${Math.min(28, fittedSize)}px"`,
    );
    text(
      x,
      65,
      key === 'loc' ? 'lines of code' : label.toLowerCase(),
      c.muted,
      12,
      'class="stat-label"',
    );
  });
  text(
    inset,
    102,
    release
      ? shorten(`${release.repository} ${release.tag}`, 63)
      : 'Engineering with intent.',
    c.muted,
    11,
  );
  if (data.updatedAt) {
    text(
      WIDTH - inset,
      102,
      `updated ${data.updatedAt}`,
      c.muted,
      10,
      'text-anchor="end"',
    );
  }
  return s.finish();
}

function languages(config, data, theme) {
  const { rows, alsoUsed, scope } = data.languages;
  const inset = 32;
  const columnWidth = 410;
  const rowHeight = 34;
  const rowCount = Math.max(Math.ceil(rows.length / 2), 1);
  const footerY = 116 + rowCount * rowHeight;
  const scopeLabel =
    scope === 'authorized'
      ? 'public + authorized private'
      : 'public repositories';
  const repositoryLabel =
    config.filters?.includeForks || config.filters?.includeMirrors
      ? 'owned repositories'
      : 'owned source';
  const captions = wrap(
    `${scopeLabel} / ${repositoryLabel} / language bytes`,
    70,
  );
  const height = footerY + captions.length * 18 + (alsoUsed.length ? 28 : 10);
  const s = canvas(
    theme,
    `${config.editorName} / languages`,
    languageDescription(data),
    height,
    'complete',
    data.season,
  );
  const { colors: c, text, rect, raw } = s;
  text(
    inset,
    34,
    'THE LANGUAGE MIX',
    c.accent,
    13,
    'font-weight="700" letter-spacing="2" class="language-heading"',
  );
  text(
    WIDTH - inset,
    34,
    `${rows.filter((row) => row.name !== 'Other').length} languages${rows.some((row) => row.name === 'Other') ? ' + Other' : ''}`,
    c.muted,
    12,
    'text-anchor="end" class="panel-index"',
  );
  const barY = 61;
  const meterWidth = WIDTH - inset * 2;
  rect(inset, barY, meterWidth, 10, c.raised, 2);
  let offset = 0;
  raw('<g class="language-bar">');
  for (const row of rows) {
    const width =
      (meterWidth * Math.max(0, Math.min(100, row.percentage))) / 100;
    const color =
      row.name === 'Other' ? c.muted : (LANGUAGE_COLORS[row.name] ?? c.accent);
    if (width > 0) {
      rect(inset + offset, barY, width, 10, color);
    }
    offset += width;
  }
  raw('</g>');
  rows.forEach((row, index) => {
    const column = index % 2;
    const x = inset + column * columnWidth;
    const y = 111 + Math.floor(index / 2) * rowHeight;
    const color =
      row.name === 'Other' ? c.muted : (LANGUAGE_COLORS[row.name] ?? c.accent);
    rect(x, y - 11, 9, 9, color, 2);
    text(x + 20, y, shorten(row.name, 16), c.text, 15, 'class="language-name"');
    text(
      x + 356,
      y,
      `${row.percentage.toFixed(1)}%`,
      c.muted,
      14,
      'text-anchor="end" class="language-value"',
    );
  });
  if (!rows.length) {
    text(inset, 111, 'No language bytes reported.', c.muted, 15);
  }
  captions.forEach((caption, index) =>
    text(
      inset,
      footerY + index * 18,
      caption,
      c.muted,
      12,
      'class="language-caption"',
    ),
  );
  if (alsoUsed.length) {
    text(
      inset,
      footerY + captions.length * 18 + 8,
      `Other includes ${alsoUsed.length} more ${alsoUsed.length === 1 ? 'language' : 'languages'}.`,
      c.muted,
      12,
      'class="language-caption"',
    );
  }
  return s.finish();
}

function projectCard(project, theme, phase = 0, season) {
  const description = `${project.name}.${project.description ? ` ${project.description}` : ''}`;
  const s = canvas(
    theme,
    project.name,
    description,
    PROJECT_HEIGHT,
    'complete',
    season,
    PROJECT_WIDTH,
  );
  s.rect(10, 104, 20, 2, s.colors.accent, 1, 'class="project-accent"');
  s.raw(
    `<g class="project-thumbnail" transform="translate(8 8) scale(${PROJECT_ILLUSTRATION_SCALE})">`,
  );
  drawProject(s, project.name, 0, 0, phase);
  s.raw('</g>');
  return s.finish();
}

function workshop(config, data, theme, phase = null) {
  return profile(config, data, theme, phase);
}

export function renderMotionFrame(config, data, progress) {
  const phase = progress - Math.floor(progress);
  const frames = {};
  for (const theme of Object.keys(THEMES)) {
    frames[`workshop-${theme}.svg`] = workshop(config, data, theme, phase);
    frames[`workshop-mobile-${theme}.svg`] = profile(
      config,
      data,
      theme,
      phase,
      'mobile',
    );
    data.projects.forEach((project, index) => {
      const projectPhase = (phase + index * PROJECT_PHASE_STEP) % 1;
      frames[`project-${index + 1}-${theme}.svg`] = projectCard(
        project,
        theme,
        projectPhase,
        data.season,
      );
    });
  }
  return Object.fromEntries(
    Object.entries(frames).map(([name, svg]) => [
      name,
      svg.replace(/<style>[\s\S]*?<\/style>/, ''),
    ]),
  );
}

const BADGE_ICONS = {
  email:
    'M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z',
  x: 'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z',
  linkedin:
    'M0 2a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zM3.6 9v11.4h3.6V9zm1.8-5.8a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2zM9.1 9v11.4h3.6v-5.5c0-1.5.3-2.9 2.1-2.9s1.8 1.7 1.8 3v5.4H20v-6.1c0-3.2-.7-5.6-4.4-5.6-1.8 0-3 1-3.5 1.9V9z',
  link: 'M10.6 13.4a1 1 0 0 1 0-1.4l4-4a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0zM6.3 20.5a4.8 4.8 0 0 1-3.4-8.2l2.8-2.8a1 1 0 0 1 1.4 1.4l-2.8 2.8a2.8 2.8 0 0 0 4 4l2.8-2.8a1 1 0 0 1 1.4 1.4l-2.8 2.8a4.8 4.8 0 0 1-3.4 1.4zm11-6.3a1 1 0 0 1-.7-1.7l2.8-2.8a2.8 2.8 0 0 0-4-4l-2.8 2.8a1 1 0 0 1-1.4-1.4l2.8-2.8a4.8 4.8 0 0 1 6.8 6.8l-2.8 2.8a1 1 0 0 1-.7.3z',
  hn: 'M0 24V0h24v24H0zM6.951 5.896l4.112 7.708v5.064h1.583v-4.972l4.148-7.799h-1.749l-2.457 4.875c-.372.745-.688 1.434-.688 1.434s-.297-.708-.651-1.434L8.831 5.896h-1.88z',
};

export const BADGE_ICON_NAMES = Object.keys(BADGE_ICONS);

function badge(item, theme) {
  const c = THEMES[theme];
  const label = item.label.toUpperCase();
  const value = item.handle;
  const size = 11;
  const labelWidth = Math.ceil(
    34 + label.length * (size * CHARACTER_WIDTH + 1.5) + 12,
  );
  const valueWidth = Math.ceil(value.length * (size * CHARACTER_WIDTH) + 24);
  const width = labelWidth + valueWidth;
  const height = 28;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(item.label)}</title>
<desc id="desc">${escapeXml(`${item.label}: ${value}`)}</desc>
<g font-family="${FONT}">
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="5" fill="${c.raised}" stroke="${c.border}"/>
<path d="M${labelWidth} 0.5H${width - 5.5}a5 5 0 0 1 5 5v17a5 5 0 0 1-5 5H${labelWidth}z" fill="${c.accent}"/>
<path transform="translate(10 5) scale(0.75)" d="${BADGE_ICONS[item.icon]}" fill="${c.accent}" fill-rule="evenodd"/>
<text x="36" y="18" fill="${c.text}" font-size="${size}" font-weight="700" letter-spacing="1.5">${escapeXml(label)}</text>
<text x="${labelWidth + 12}" y="18" fill="${c.ink}" font-size="${size}" font-weight="700">${escapeXml(value)}</text>
</g>
</svg>
`;
}

export function badgeItems(config) {
  const { emails = [], socials = [] } = config.contact ?? {};
  const used = new Map();
  const unique = (base) => {
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  };
  return [
    ...emails.map((email) => ({
      icon: 'email',
      label: 'Email',
      handle: email,
      url: `mailto:${email}`,
    })),
    ...socials
      .filter((social) => social.url)
      .map((social) => ({
        icon: BADGE_ICONS[social.icon] ? social.icon : 'link',
        label: social.label,
        handle: social.handle ?? social.label,
        url: social.url,
      })),
  ].map((item) => ({
    ...item,
    id: unique(
      item.icon === 'link'
        ? item.label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'link'
        : item.icon,
    ),
  }));
}

export function renderAssets(config, data) {
  const assets = {};
  for (const theme of Object.keys(THEMES)) {
    assets[`profile-${theme}.svg`] = profile(config, data, theme);
    assets[`workshop-${theme}.svg`] = workshop(config, data, theme);
    assets[`workshop-mobile-${theme}.svg`] = profile(
      config,
      data,
      theme,
      null,
      'mobile',
    );
    assets[`stats-${theme}.svg`] = statistics(config, data, theme);
    assets[`languages-${theme}.svg`] = languages(config, data, theme);
    data.projects.forEach((project, index) => {
      assets[`project-${index + 1}-${theme}.svg`] = projectCard(
        project,
        theme,
        0,
        data.season,
      );
    });
  }
  for (const item of badgeItems(config)) {
    for (const theme of Object.keys(THEMES)) {
      assets[`badge-${item.id}-${theme}.svg`] = badge(item, theme);
    }
  }
  return assets;
}

const WIDTH = { desktop: 860, mobile: 420 };
const THEMES = {
  dark: { background: '#141719', panel: '#1b2023', raised: '#242c2f', border: '#3c4945', text: '#e8eeed', muted: '#a4b5ac', accent: '#91d7bd', copper: '#eebd95', keyword: '#c4b4e5', string: '#c5dda8', number: '#9dcced' },
  light: { background: '#fafcfa', panel: '#f0f4f1', raised: '#e3ece6', border: '#bdccc2', text: '#20342b', muted: '#526b5d', accent: '#21634d', copper: '#905023', keyword: '#704d8f', string: '#49701e', number: '#205f8e' },
};
const LANGUAGE_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', PHP: '#4F5D95', Go: '#00ADD8',
  Dart: '#00B4AB', Rust: '#dea584', Shell: '#89e051', HTML: '#e34c26', CSS: '#663399',
  C: '#555555', 'C++': '#f34b7d', Ruby: '#701516', Java: '#b07219', Lua: '#000080', Swift: '#F05138',
};
const FONT = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace';
const CODE_ROW_HEIGHT = 25;
const DETAIL_LINE_HEIGHT = 22;
const DETAIL_GROUP_GAP = 26;
const DETAIL_HEADER_HEIGHT = 64;
const COMMAND_DURATION_MS = 1000;
const BAR_DURATION_MS = 800;
const BAR_STAGGER_MS = 90;
const ACTIVITY_SCOPE = 'accessible public + private / all branches';
const MOTION_STYLES = `
@keyframes cursor-blink { 0%, 49%, 100% { opacity: 1; } 50%, 99% { opacity: 0; } }
@keyframes command-type { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes bar-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.editor-cursor { animation: cursor-blink 1s steps(1, end) 3; }
.terminal-command { animation: command-type ${COMMAND_DURATION_MS}ms steps(18, end) 1 both; transform-box: fill-box; }
.language-bar { animation: bar-grow ${BAR_DURATION_MS}ms ease-out 1 both; transform-box: fill-box; transform-origin: left center; }
`;

export function escapeXml(value) {
  return String(value)
    .replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu, '')
    .replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
}

function wrap(value, limit) {
  const words = String(value).replace(/[\r\n\t]+/g, ' ').split(/\s+/);
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
      const hyphen = remainder.lastIndexOf('-', limit - 1);
      const boundary = hyphen >= Math.floor(limit / 2) ? hyphen + 1 : limit;
      lines.push(remainder.slice(0, boundary));
      remainder = remainder.slice(boundary);
    }
    line = remainder;
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}

function canvas(theme, mode, title, description, height) {
  const colors = THEMES[theme];
  const width = WIDTH[mode];
  const parts = [];
  const rect = (x, y, w, h, color, radius = 0, extra = '') => parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${color}"${extra ? ` ${extra}` : ''}/>`);
  const text = (x, y, value, color = colors.text, size = 16, extra = '') => parts.push(`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" ${extra}>${escapeXml(value)}</text>`);
  const line = (x1, y1, x2, y2) => parts.push(`<path d="M${x1} ${y1}H${x2}V${y2}" fill="none" stroke="${colors.border}"/>`);
  const code = (x, y, value) => {
    const tokens = value.split(/("(?:\\.|[^"\\])*"|\b(?:export|const)\b)/g);
    parts.push(`<text x="${x}" y="${y}" fill="${colors.text}" font-size="16" xml:space="preserve">${tokens.map((token) => {
      const color = token.startsWith('"') ? colors.string : /^(export|const)$/.test(token) ? colors.keyword : colors.text;
      return `<tspan fill="${color}">${escapeXml(token)}</tspan>`;
    }).join('')}</text>`);
  };
  const finish = () => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(title)}</title>
<desc id="desc">${escapeXml(description)}</desc>
<style>${MOTION_STYLES}</style>
<g font-family="${FONT}" letter-spacing="0">
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="7" fill="${colors.background}" stroke="${colors.border}"/>
${parts.join('\n')}
</g>
</svg>
`;
  return { colors, width, rect, text, line, code, finish };
}

function masthead(surface, config, mode, suffix) {
  const { colors: c, width, rect, text, line } = surface;
  rect(20, 22, 36, 36, c.raised, 4);
  text(26, 47, 'A', c.accent, 25, 'font-weight="700"');
  rect(48, 46, 4, 8, c.copper);
  text(70, 40, config.editorName, c.text, 24, 'font-weight="700"');
  text(71, 60, suffix, c.muted, 12);
  if (mode === 'desktop') {
    text(width - 22, 45, `github:${config.username}`, c.muted, 14, 'text-anchor="end"');
  }
  line(0, 78, width, 78);
}

function systemInformation(config, data, mode) {
  if (!config.system) {
    return null;
  }
  const { system, contact = {} } = config;
  const groups = (entries) => entries.filter(([, values]) => values?.length).map(([label, values]) => ({ label, lines: wrap(values.join(' / '), 43) }));
  const environment = groups([
    ['OS', system.os],
    [data.uptime?.label ?? 'Uptime', [data.uptime?.value ?? 'Unavailable']],
    ['IDE', system.ides], ['Terminals', system.terminals],
    ['Email', contact.emails], ['Socials', contact.socials?.map((social) => social.label)],
  ]);
  const languages = groups([
    ['Programming', system.programming], ['Mobile stack', system.mobile],
    ['Daily languages', system.daily], ['Previous languages', system.previous], ['Human languages', system.human],
  ]);
  const columnHeight = (column) => column.reduce((total, group) => total + DETAIL_GROUP_GAP + group.lines.length * DETAIL_LINE_HEIGHT, 0);
  const contentHeight = mode === 'mobile' ? columnHeight(environment) + columnHeight(languages) + 16 : Math.max(columnHeight(environment), columnHeight(languages));
  const activityHeight = config.activity?.enabled ? (mode === 'mobile' ? 170 : 134) : 0;
  const release = data.latestRelease;
  const releaseLines = release ? wrap(`${release.repository} / ${release.tag} / ${release.publishedAt.slice(0, 10)}`, mode === 'mobile' ? 43 : 93) : [];
  const releaseHeight = releaseLines.length ? 46 + releaseLines.length * DETAIL_LINE_HEIGHT : 0;
  const activityDescription = config.activity?.enabled ? `${activityValues(data.activity).map(([label, value]) => `${label}: ${value}`).join('. ')}. Scope: ${ACTIVITY_SCOPE}` : '';
  return {
    environment, languages, contentHeight, activityHeight, releaseLines,
    height: DETAIL_HEADER_HEIGHT + contentHeight + activityHeight + releaseHeight + 18,
    description: [...environment, ...languages].map((group) => `${group.label}: ${group.lines.join(' ')}`).concat(
      activityDescription ? [activityDescription] : [], releaseLines.length ? [`Latest release: ${releaseLines.join(' ')}`] : [],
    ).join('. '),
  };
}

function activityValues(activity) {
  const count = (value) => activity?.status === 'ready' && Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString('en-US') : 'Unavailable';
  return [['Commits', count(activity?.commits)], ['Lines added', count(activity?.additions)], ['Lines deleted', count(activity?.deletions)]];
}

function drawSystemInformation(surface, info, data, mode, startY) {
  const { colors: c, width, text, line } = surface;
  const mobile = mode === 'mobile';
  line(0, startY, width, startY);
  text(22, startY + 27, 'SYSTEM', c.muted, 11);
  text(width - 22, startY + 27, '$ whoami --details', c.accent, 13, 'text-anchor="end"');
  const drawColumn = (groups, x, start) => {
    let y = start;
    for (const group of groups) {
      text(x, y, group.label, c.copper, 12);
      group.lines.forEach((value, index) => text(x, y + 22 + index * DETAIL_LINE_HEIGHT, value, c.text, 14));
      y += DETAIL_GROUP_GAP + group.lines.length * DETAIL_LINE_HEIGHT;
    }
    return y;
  };
  const columnY = startY + DETAIL_HEADER_HEIGHT;
  const environmentEnd = drawColumn(info.environment, 22, columnY);
  drawColumn(info.languages, mobile ? 22 : width / 2 + 16, mobile ? environmentEnd + 16 : columnY);
  let y = columnY + info.contentHeight;
  if (info.activityHeight) {
    line(22, y, width - 22, y);
    text(22, y + 27, 'GITHUB / LIFETIME', c.muted, 11);
    const values = activityValues(data.activity);
    values.forEach(([label, value], index) => {
      if (mobile) {
        text(22, y + 56 + index * 28, label, c.muted, 13);
        text(width - 22, y + 56 + index * 28, value, c.text, 16, 'text-anchor="end"');
        return;
      }
      const x = 22 + index * (width - 44) / values.length;
      text(x, y + 61, value, c.text, 24);
      text(x, y + 85, label, c.muted, 12);
    });
    text(22, y + (mobile ? 144 : 113), ACTIVITY_SCOPE, c.muted, mobile ? 11 : 12);
    y += info.activityHeight;
  }
  if (info.releaseLines.length) {
    line(22, y, width - 22, y);
    text(22, y + 26, 'LATEST RELEASE', c.muted, 11);
    info.releaseLines.forEach((value, index) => text(22, y + 50 + index * DETAIL_LINE_HEIGHT, value, c.accent, 14));
  }
}

function profile(config, data, theme, mode) {
  const mobile = mode === 'mobile';
  const codeLines = [
    'export const developer = {',
    `  name: ${JSON.stringify(config.name)},`,
    `  handle: ${JSON.stringify(config.username)},`,
    '',
    '  interests: [',
    ...config.focus.map((focus, index) => `    ${JSON.stringify(focus)}${index < config.focus.length - 1 ? ',' : ''}`),
    '  ]',
    '};',
  ];
  const projectTreeBottom = 337 + data.projects.reduce((height, project) => height + wrap(project.name, 21).length * 21 + 13, 0);
  const editorBottom = Math.max(162 + codeLines.length * CODE_ROW_HEIGHT, mobile ? 0 : projectTreeBottom);
  const projectLines = mobile ? data.projects.flatMap((project) => wrap(project.name, 43)) : [];
  const projectHeight = mobile && data.projects.length ? 56 + projectLines.length * 22 : 0;
  const info = systemInformation(config, data, mode);
  const height = editorBottom + projectHeight + (info?.height ?? 0) + 35;
  const summary = `${config.editorName}. ${config.name}, @${config.username}. Interests: ${config.focus.join(', ')}. Public projects: ${data.projects.map((project) => `${project.name}: ${project.description}`).join('. ')}${info ? `. ${info.description}.` : ''}`;
  const s = canvas(theme, mode, `${config.editorName} / profile.ts`, summary, height);
  const { colors: c, width, text, rect, line, code } = s;
  masthead(s, config, mode, 'developer workstation');
  const editorX = mobile ? 0 : 230;
  rect(editorX + 1, 79, width - editorX - 2, 43, c.panel);
  rect(editorX + 1, 79, 173, 2, c.accent);
  text(editorX + 20, 105, 'TS', c.number, 13);
  text(editorX + 51, 105, 'profile.ts', c.text, 14);
  text(width - 20, 105, 'READ ONLY', c.muted, 11, 'text-anchor="end"');
  line(editorX, 122, width, 122);
  if (!mobile) {
    rect(1, 79, 228, editorBottom - 79, c.panel);
    line(230, 78, 230, editorBottom);
    text(22, 107, 'EXPLORER', c.muted, 12);
    text(22, 153, `~/` + config.username, c.text, 15);
    rect(10, 169, 209, 30, c.raised, 3);
    rect(10, 169, 3, 30, c.accent);
    text(26, 189, 'TS', c.number, 12);
    text(54, 189, 'profile.ts', c.text, 14);
    text(26, 222, '{}', c.copper, 13);
    text(54, 222, 'interests.json', c.muted, 14);
    text(26, 255, '{}', c.copper, 13);
    text(54, 255, 'languages.json', c.muted, 14);
    if (data.projects.length) {
      text(22, 305, 'PUBLIC PROJECTS', c.muted, 12);
      let y = 337;
      for (const project of data.projects) {
        text(22, y, '/', c.accent, 14);
        for (const part of wrap(project.name, 21)) {
          text(42, y, part, c.text, 13);
          y += 21;
        }
        y += 13;
      }
    }
  }
  const contentX = editorX + (mobile ? 43 : 60);
  rect(contentX + 17, 151, 1, codeLines.length * CODE_ROW_HEIGHT - 10, c.raised);
  codeLines.forEach((value, index) => {
    const y = 161 + index * CODE_ROW_HEIGHT;
    text(editorX + (mobile ? 28 : 40), y, String(index + 1).padStart(2, '0'), c.muted, 12, 'text-anchor="end"');
    code(contentX, y, value);
  });
  rect(contentX + 24, 146 + (codeLines.length - 1) * CODE_ROW_HEIGHT, 9, 19, c.accent, 0, 'class="editor-cursor"');
  line(0, editorBottom, width, editorBottom);
  if (projectHeight) {
    const projectY = editorBottom;
    text(22, projectY + 27, 'PUBLIC PROJECTS', c.muted, 11);
    projectLines.forEach((part, index) => text(22, projectY + 53 + index * 22, part, c.text, 14));
  }
  if (info) {
    drawSystemInformation(s, info, data, mode, editorBottom + projectHeight);
  }
  rect(1, height - 34, width - 2, 33, c.raised);
  text(20, height - 12, `@${config.username}`, c.accent, 12);
  text(width - 20, height - 12, mobile ? 'TypeScript   UTF-8' : 'profile.ts     TypeScript     UTF-8   LF', c.muted, 12, 'text-anchor="end"');
  return s.finish();
}

function languages(config, data, theme, mode) {
  const mobile = mode === 'mobile';
  const { rows, alsoUsed, scope } = data.languages;
  const scopeLabel = scope === 'authorized' ? 'public + authorized private' : 'public repositories';
  const alsoLines = wrap(alsoUsed.join(' / '), mobile ? 38 : 83);
  const rowHeight = mobile ? 62 : 39;
  const startY = mobile ? 215 : 193;
  const height = startY + Math.max(rows.length, 1) * rowHeight + (alsoLines.length ? 52 + alsoLines.length * 22 : 20) + 53;
  const description = `Language byte share across eligible owned ${scopeLabel}. ${rows.map((row) => `${row.name}: ${row.percentage.toFixed(1)}%`).join(', ')}.${alsoUsed.length ? ` Other includes: ${alsoUsed.join(', ')}.` : ''}`;
  const s = canvas(theme, mode, `${config.editorName} / languages`, description, height);
  const { colors: c, width, text, rect, line } = s;
  masthead(s, config, mode, 'language telemetry');
  text(22, 111, 'TERMINAL', c.muted, 11);
  text(width - 22, 111, 'languages.json', c.muted, 12, 'text-anchor="end"');
  text(22, 147, '$ language --stats', c.accent, 17, 'class="terminal-command"');
  text(22, 174, scopeLabel, c.muted, 13);
  if (!mobile) {
    text(width - 22, 147, 'BYTE SHARE', c.muted, 11, 'text-anchor="end"');
  }
  rows.forEach((row, index) => {
    const y = startY + 26 + index * rowHeight;
    const label = row.name.length > (mobile ? 30 : 25) ? `${row.name.slice(0, mobile ? 27 : 22)}...` : row.name;
    rect(22, y - 11, 7, 7, LANGUAGE_COLORS[row.name] ?? c.accent, 1);
    text(39, y, label, c.text, 15);
    text(width - 22, y, `${row.percentage.toFixed(1)}%`, c.text, 15, 'text-anchor="end"');
    const barX = mobile ? 22 : 310;
    const barY = mobile ? y + 15 : y - 9;
    const barWidth = mobile ? width - 44 : width - barX - 115;
    rect(barX, barY, barWidth, 6, c.raised, 2);
    rect(barX, barY, Number((barWidth * Math.min(100, Math.max(0, row.percentage)) / 100).toFixed(3)), 6, c.accent, 2, `class="language-bar" style="animation-delay: ${COMMAND_DURATION_MS + index * BAR_STAGGER_MS}ms"`);
  });
  if (!rows.length) {
    text(22, startY + 26, 'No language bytes reported.', c.muted, 15);
  }
  if (alsoLines.length) {
    const alsoY = startY + rows.length * rowHeight + 34;
    text(22, alsoY, 'ALSO USED / included in Other', c.muted, 11);
    alsoLines.forEach((value, index) => text(22, alsoY + 26 + index * 22, value, c.text, 14));
  }
  line(0, height - 43, width, height - 43);
  const repositoryLabel = config.filters?.includeForks || config.filters?.includeMirrors ? 'owned repositories' : 'owned source';
  text(22, height - 17, `${repositoryLabel} / language bytes`, c.muted, 12);
  if (!mobile) {
    text(width - 22, height - 17, 'ALABAY CODE', c.accent, 12, 'text-anchor="end"');
  }
  return s.finish();
}

export function renderAssets(config, data) {
  const assets = {};
  for (const theme of Object.keys(THEMES)) {
    for (const mode of Object.keys(WIDTH)) {
      const suffix = mode === 'mobile' ? '-mobile' : '';
      assets[`profile-${theme}${suffix}.svg`] = profile(config, data, theme, mode);
      assets[`languages-${theme}${suffix}.svg`] = languages(config, data, theme, mode);
    }
  }
  for (const [name, svg] of Object.entries(assets)) {
    assets[name.replace('.svg', '-still.svg')] = svg.replace(/<style>[\s\S]*?<\/style>\n/, '')
      .replace(/ class="(?:editor-cursor|terminal-command|language-bar)"/g, '')
      .replace(/ style="animation-delay: [0-9]+ms"/g, '');
  }
  return assets;
}

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
  const rect = (x, y, w, h, color, radius = 0) => parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${color}"/>`);
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
  const terminalHeight = mobile ? 142 : 126;
  const height = editorBottom + terminalHeight + projectHeight + 35;
  const summary = `${config.editorName}. ${config.name}, @${config.username}. Interests: ${config.focus.join(', ')}. ${data.publicRepos} public repositories, ${data.starsEarned} stars earned by owned public repositories, ${data.followers} followers. Public projects: ${data.projects.map((project) => `${project.name}: ${project.description}`).join('. ')}`;
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
  line(0, editorBottom, width, editorBottom);
  text(22, editorBottom + 25, 'TERMINAL', c.muted, 11);
  text(mobile ? 22 : 130, editorBottom + (mobile ? 54 : 26), '$ github stats --public', c.accent, 14);
  const metricsY = editorBottom + (mobile ? 92 : 70);
  const metricWidth = (width - 44) / 3;
  [['public repos', data.publicRepos], ['stars earned', data.starsEarned], ['followers', data.followers]].forEach(([label, value], index) => {
    const x = 22 + metricWidth * index;
    text(x, metricsY, String(value), c.text, 26, 'font-weight="600"');
    text(x, metricsY + 24, label, c.muted, mobile ? 12 : 13);
  });
  if (projectHeight) {
    const projectY = editorBottom + terminalHeight;
    line(0, projectY, width, projectY);
    text(22, projectY + 27, 'PUBLIC PROJECTS', c.muted, 11);
    projectLines.forEach((part, index) => text(22, projectY + 53 + index * 22, part, c.text, 14));
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
  text(22, 147, '$ language --stats', c.accent, 17);
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
    rect(barX, barY, Number((barWidth * Math.min(100, Math.max(0, row.percentage)) / 100).toFixed(3)), 6, c.accent, 2);
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
  return assets;
}

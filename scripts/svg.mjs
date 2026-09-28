import { ALABAY } from './alabay.mjs';

const WIDTH = { desktop: 860, mobile: 420 };
const THEMES = {
  dark: { background: '#101315', raised: '#1e2528', border: '#34403b', text: '#e3ebe8', muted: '#7d8f87', accent: '#91d7bd', ink: '#0d1f18', copper: '#eebd95', keyword: '#c4b4e5', string: '#c5dda8', number: '#9dcced' },
  light: { background: '#fbfcfa', raised: '#e6ede8', border: '#c3d0c7', text: '#1f332a', muted: '#62786c', accent: '#21634d', ink: '#f3faf6', copper: '#905023', keyword: '#704d8f', string: '#49701e', number: '#205f8e' },
};
const LANGUAGE_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', PHP: '#4F5D95', Go: '#00ADD8',
  Dart: '#00B4AB', Rust: '#dea584', Shell: '#89e051', HTML: '#e34c26', CSS: '#663399',
  C: '#555555', 'C++': '#f34b7d', Ruby: '#701516', Java: '#b07219', Lua: '#000080', Swift: '#F05138',
  Astro: '#ff5a03', QML: '#44a51c', MDX: '#fcb32c', SCSS: '#c6538c', Kotlin: '#A97BFF', Elixir: '#6e4a7e',
  Dockerfile: '#384d54', Perl: '#0298c3', PowerShell: '#012456', CMake: '#DA3434', QMake: '#3f5a1b', 'Objective-C': '#438eff',
  'Common Lisp': '#3fb68b', Racket: '#3c5caa', Tcl: '#e4cc98', Just: '#384d54', Vue: '#41b883', Svelte: '#ff3e00',
  'C#': '#178600', Scala: '#c22d40', Haskell: '#5e5086', Clojure: '#db5855', Zig: '#ec915c', Nix: '#7e7eff',
  'Jupyter Notebook': '#DA5B0B', 'Vim Script': '#199f4b', HCL: '#844FBA', Makefile: '#427819', Batchfile: '#C1F12E',
};
const FONT = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace';
const CHARACTER_WIDTH = 0.6;
const PADDING = 12;
const STATUS_HEIGHT = 26;
const COMMAND_DURATION_MS = 1000;
const BAR_DURATION_MS = 800;
const BAR_STAGGER_MS = 90;
const ACTIVITY_SCOPE = 'public + private, all branches';
const LAYOUT = {
  desktop: { artSize: 10.5, artLine: 12.5, codeSize: 13, codeLine: 19, columns: 64, cells: 40 },
  mobile: { artSize: 8, artLine: 9.5, codeSize: 12, codeLine: 17, columns: 54, cells: 34 },
};
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
    .replace(/[^\u0009\u000a\u000d -퟿-�\u{10000}-\u{10ffff}]/gu, '')
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

function textWidth(value, size) {
  return String(value).length * size * CHARACTER_WIDTH;
}

function formatCount(value, known = true) {
  return known && Number.isSafeInteger(value) ? value.toLocaleString('en-US') : 'Unavailable';
}

function tomlCount(value, known = true) {
  return known && Number.isSafeInteger(value) ? [['number', value.toLocaleString('en-US').replaceAll(',', '_')]] : [['string', '"unavailable"']];
}

function githubValues(config, data) {
  const activity = data.activity;
  const ready = activity?.status === 'ready';
  const loc = ready && Number.isSafeInteger(activity.additions) && Number.isSafeInteger(activity.deletions) ? activity.additions - activity.deletions : null;
  return [
    ...(config.activity?.enabled ? [['commits', 'Commits', activity?.commits, ready], ['loc', 'Lines of code', loc, loc !== null]] : []),
    ['stars', 'Stars', data.starsEarned, true], ['followers', 'Followers', data.followers, true],
  ];
}

function activityScope(config) {
  const limit = config.activity?.maxCommitLines;
  return Number.isSafeInteger(limit) ? `${ACTIVITY_SCOPE}; lines of code skip commits over ${limit.toLocaleString('en-US')} lines` : ACTIVITY_SCOPE;
}

function tomlDocument(config, data, columns) {
  const lines = [];
  const quote = (value) => JSON.stringify(String(value));
  const section = (name) => {
    if (lines.length) {
      lines.push([]);
    }
    lines.push([['punctuation', '['], ['keyword', name], ['punctuation', ']']]);
  };
  const entries = (pairs) => {
    const present = pairs.filter(([, value]) => value !== undefined && value !== null && !(Array.isArray(value) && !value.length));
    const width = Math.max(0, ...present.map(([key]) => key.length));
    for (const [key, value, comment] of present) {
      const head = [['key', key.padEnd(width)], ['punctuation', ' = ']];
      const headLength = width + 3;
      let body;
      if (Array.isArray(value) && typeof value[0] === 'string') {
        const items = value.map(quote);
        const inline = `[${items.join(', ')}]`;
        if (headLength + inline.length <= columns) {
          body = [[['punctuation', '[']], ...items.map((item, index) => [['string', item], ...(index < items.length - 1 ? [['punctuation', ', ']] : [])]), [['punctuation', ']']]].flat();
        } else {
          lines.push([...head, ['punctuation', '[']]);
          let row = [];
          let rowLength = 2;
          const flush = () => {
            if (row.length) {
              lines.push([['plain', '  '], ...row]);
            }
            row = [];
            rowLength = 2;
          };
          items.forEach((item) => {
            if (rowLength + item.length + 2 > columns && row.length) {
              flush();
            }
            row.push(['string', item], ['punctuation', ', ']);
            rowLength += item.length + 2;
          });
          flush();
          lines.push([['punctuation', ']']]);
          continue;
        }
      } else {
        body = Array.isArray(value) ? value : [['string', quote(value)]];
      }
      const bodyLength = body.reduce((total, [, text]) => total + text.length, 0);
      if (comment && headLength + bodyLength + comment.length + 4 > columns) {
        wrap(comment, columns - 2).forEach((part) => lines.push([['comment', `# ${part}`]]));
        lines.push([...head, ...body]);
      } else {
        lines.push([...head, ...body, ...(comment ? [['comment', `  # ${comment}`]] : [])]);
      }
    }
  };
  const { system = {} } = config;
  section('user');
  entries([
    ['name', config.name], ['handle', config.username],
    ['uptime', data.uptime?.value, data.uptime?.label === 'GitHub uptime' ? 'on github' : undefined],
    ['interests', config.focus],
  ]);
  if (config.system) {
    section('system');
    entries([['os', system.os], ['ide', system.ides], ['terminals', system.terminals]]);
    section('languages');
    entries([['programming', system.programming], ['mobile', system.mobile], ['daily', system.daily], ['previous', system.previous], ['human', system.human]]);
  }
  section('github');
  const comments = { commits: ACTIVITY_SCOPE, loc: config.activity?.maxCommitLines ? `added - deleted, skips commits > ${config.activity.maxCommitLines.toLocaleString('en-US')} lines` : 'added - deleted' };
  const release = data.latestRelease;
  entries([
    ...githubValues(config, data).map(([key, , value, known]) => [key, tomlCount(value, known), comments[key]]),
    ...(release ? [['release', `${release.repository} ${release.tag}`, release.publishedAt.slice(0, 10)]] : []),
  ]);
  if (data.projects.length) {
    section('projects');
    entries([['featured', data.projects.map((project) => project.name)]]);
  }
  return lines;
}

function canvas(theme, mode, title, description, height) {
  const colors = THEMES[theme];
  const width = WIDTH[mode];
  const parts = [];
  const rect = (x, y, w, h, color, radius = 0, extra = '') => parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${color}"${extra ? ` ${extra}` : ''}/>`);
  const text = (x, y, value, color = colors.text, size = 13, extra = '') => parts.push(`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" ${extra}>${escapeXml(value)}</text>`);
  const line = (x1, y1, x2, y2, color = colors.border) => parts.push(`<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${color}"/>`);
  const segments = (x, y, pieces, size, extra = '') => {
    const palette = { key: colors.copper, keyword: colors.keyword, string: colors.string, number: colors.number, comment: colors.muted, punctuation: colors.muted, prompt: colors.accent, plain: colors.text };
    parts.push(`<text x="${x}" y="${y}" fill="${colors.text}" font-size="${size}" xml:space="preserve"${extra ? ` ${extra}` : ''}>${pieces.map(([type, value]) => `<tspan fill="${palette[type] ?? colors.text}">${escapeXml(value)}</tspan>`).join('')}</text>`);
  };
  const raw = (markup) => parts.push(markup);
  const finish = () => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(title)}</title>
<desc id="desc">${escapeXml(description)}</desc>
<style>${MOTION_STYLES}</style>
<g font-family="${FONT}" letter-spacing="0">
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="${colors.background}" stroke="${colors.border}"/>
${parts.join('\n')}
</g>
</svg>
`;
  return { colors, width, rect, text, line, segments, raw, finish };
}

function paneTitle(surface, x1, x2, y, label, active) {
  const { colors: c, line, rect, text } = surface;
  const color = active ? c.accent : c.border;
  line(x1, y, x2, y, color);
  const labelWidth = textWidth(` ${label} `, 12);
  rect(x1 + 10, y - 9, labelWidth, 18, c.background);
  text(x1 + 10 + textWidth(' ', 12), y + 4, label, active ? c.accent : c.muted, 12);
}

function statusBar(surface, config, data, mode, activeWindow) {
  const { colors: c, width, rect, text } = surface;
  const height = surface.height;
  const y = height - PADDING - STATUS_HEIGHT;
  rect(PADDING, y, width - PADDING * 2, STATUS_HEIGHT, c.accent, 4);
  const baseline = y + 17;
  text(PADDING + 10, baseline, `[${config.username}]`, c.ink, 12, 'font-weight="700"');
  let x = PADDING + 10 + textWidth(`[${config.username}] `, 12);
  const windows = mode === 'mobile' ? [activeWindow] : ['profile', 'languages'];
  for (const name of windows) {
    const index = name === 'profile' ? 0 : 1;
    const label = `${index}:${name}${name === activeWindow ? '*' : '-'}`;
    text(x, baseline, label, c.ink, 12, name === activeWindow ? 'font-weight="700"' : '');
    x += textWidth(`${label} `, 12);
  }
  if (data.updatedAt) {
    text(width - PADDING - 10, baseline, mode === 'mobile' ? data.updatedAt : `updated ${data.updatedAt}`, c.ink, 12, 'text-anchor="end"');
  }
}

function artBlock(surface, x, y, mode) {
  const { colors: c } = surface;
  const { artSize, artLine } = LAYOUT[mode];
  const tone = (character) => (/[@%#]/.test(character) ? 'patch' : /[*+=]/.test(character) ? 'coat' : 'edge');
  const fills = { patch: c.copper, coat: c.text, edge: c.muted };
  ALABAY.forEach((row, index) => {
    const runs = [];
    for (const character of row) {
      const kind = character === ' ' ? 'space' : tone(character);
      if (runs.length && runs.at(-1)[0] === kind) {
        runs.at(-1)[1] += character;
      } else {
        runs.push([kind, character]);
      }
    }
    surface.raw(`<text x="${x}" y="${y + index * artLine}" font-size="${artSize}" xml:space="preserve">${runs.map(([kind, value]) => kind === 'space'
      ? `<tspan fill="${c.background}">${value}</tspan>`
      : `<tspan fill="${fills[kind]}">${escapeXml(value)}</tspan>`).join('')}</text>`);
  });
  return ALABAY.length * artLine;
}

function profile(config, data, theme, mode) {
  const mobile = mode === 'mobile';
  const layout = LAYOUT[mode];
  const width = WIDTH[mode];
  const artColumns = Math.max(...ALABAY.map((row) => row.length));
  const artWidth = textWidth('x'.repeat(artColumns), layout.artSize);
  const leftWidth = mobile ? width - PADDING * 2 : Math.ceil(artWidth) + 36;
  const codeX = mobile ? PADDING + 14 : PADDING + leftWidth + 20;
  const columns = mobile ? layout.columns : Math.floor((width - codeX - PADDING - 12) / (layout.codeSize * CHARACTER_WIDTH));
  const document = tomlDocument(config, data, columns);
  const codeLines = [[['prompt', '❯ '], ['plain', 'cat mekan.toml']], ...document, [], [['prompt', '❯ ']]];
  const artHeight = ALABAY.length * layout.artLine + 58;
  const top = PADDING + 10;
  const artTop = mobile ? top + 30 : top + 30;
  const codeTop = mobile ? top + 30 + artHeight + 40 : top + 30;
  const codeHeight = codeLines.length * layout.codeLine;
  const bodyBottom = Math.max(mobile ? codeTop + codeHeight : codeTop + codeHeight, artTop + artHeight) + 10;
  const height = bodyBottom + STATUS_HEIGHT + PADDING + 8;
  const values = githubValues(config, data);
  const summary = `${config.editorName}. ${config.name}, @${config.username}. Interests: ${config.focus.join(', ')}. ${
    config.system ? `OS: ${config.system.os?.join(', ') ?? ''}. IDE: ${config.system.ides?.join(', ') ?? ''}. Programming: ${config.system.programming?.join(', ') ?? ''}. ` : ''
  }${data.uptime ? `${data.uptime.label}: ${data.uptime.value}. ` : ''}${values.map(([, label, value, known]) => `${label}: ${formatCount(value, known)}`).join('. ')}.${
    config.activity?.enabled ? ` Scope: ${activityScope(config)}.` : ''
  }${data.projects.length ? ` Projects: ${data.projects.map((project) => project.name).join(', ')}.` : ''}`;
  const s = canvas(theme, mode, `${config.editorName} / tmux`, summary, height);
  s.height = height;
  const { colors: c, line, text, segments, rect } = s;
  if (mobile) {
    paneTitle(s, PADDING, width - PADDING, top, '0 alabay', false);
    paneTitle(s, PADDING, width - PADDING, codeTop - 28, '1 zsh', true);
  } else {
    const divider = PADDING + leftWidth;
    paneTitle(s, PADDING, divider, top, '0 alabay', false);
    paneTitle(s, divider, width - PADDING, top, '1 zsh', true);
    line(divider, top, divider, bodyBottom, c.border);
  }
  const artX = mobile ? (width - artWidth) / 2 : PADDING + (leftWidth - artWidth) / 2;
  const artY = mobile ? artTop : Math.max(artTop, top + (bodyBottom - top - artHeight) / 2);
  const drawnArt = artBlock(s, Number(artX.toFixed(1)), Number((artY + 10).toFixed(1)), mode);
  const labelX = mobile ? width / 2 : PADDING + leftWidth / 2;
  text(labelX, Number((artY + drawnArt + 26).toFixed(1)), config.editorName, c.accent, mobile ? 15 : 17, 'font-weight="700" text-anchor="middle" letter-spacing="2"');
  text(labelX, Number((artY + drawnArt + 46).toFixed(1)), `github.com/${config.username}`, c.muted, 12, 'text-anchor="middle"');
  codeLines.forEach((pieces, index) => {
    const y = codeTop + 14 + index * layout.codeLine;
    if (index === 0) {
      segments(codeX, y, [pieces[0]], layout.codeSize);
      text(codeX + textWidth('❯ ', layout.codeSize), y, 'cat mekan.toml', c.text, layout.codeSize, 'class="terminal-command"');
      return;
    }
    if (pieces.length) {
      segments(codeX, y, pieces, layout.codeSize);
    }
  });
  const cursorY = codeTop + 14 + (codeLines.length - 1) * layout.codeLine;
  rect(Number((codeX + textWidth('❯ ', layout.codeSize)).toFixed(1)), cursorY - layout.codeSize + 2, 8, layout.codeSize + 2, c.accent, 0, 'class="editor-cursor"');
  statusBar(s, config, data, mode, 'profile');
  return s.finish();
}

function languages(config, data, theme, mode) {
  const mobile = mode === 'mobile';
  const layout = LAYOUT[mode];
  const width = WIDTH[mode];
  const { rows, alsoUsed, scope } = data.languages;
  const scopeLabel = scope === 'authorized' ? 'public + authorized private' : 'public repositories';
  const repositoryLabel = config.filters?.includeForks || config.filters?.includeMirrors ? 'owned repositories' : 'owned source';
  const columns = mobile ? layout.columns : Math.floor((width - PADDING * 2 - 28) / (layout.codeSize * CHARACTER_WIDTH));
  const captionLines = wrap(`${scopeLabel} / ${repositoryLabel} / language bytes`, columns - 2);
  const alsoLines = alsoUsed.length ? wrap(alsoUsed.join(', '), columns - 2) : [];
  const rowHeight = mobile ? 38 : 26;
  const top = PADDING + 10;
  const contentTop = top + 30;
  const x = PADDING + 14;
  const rowsTop = contentTop + 14 + (1 + captionLines.length + 1) * layout.codeLine;
  const rowsHeight = Math.max(rows.length, 1) * rowHeight;
  const alsoTop = rowsTop + rowsHeight + 10;
  const promptY = alsoTop + (alsoLines.length ? (alsoLines.length + 1) * layout.codeLine : 0) + layout.codeLine;
  const bodyBottom = promptY + 16;
  const height = bodyBottom + STATUS_HEIGHT + PADDING + 8;
  const description = `Language byte share across eligible owned ${scopeLabel}. ${rows.map((row) => `${row.name}: ${row.percentage.toFixed(1)}%`).join(', ')}.${alsoUsed.length ? ` Other includes: ${alsoUsed.join(', ')}.` : ''}`;
  const s = canvas(theme, mode, `${config.editorName} / languages`, description, height);
  s.height = height;
  const { colors: c, text, segments, rect, raw } = s;
  paneTitle(s, PADDING, width - PADDING, top, '1 zsh', true);
  const firstY = contentTop + 14;
  segments(x, firstY, [['prompt', '❯ ']], layout.codeSize);
  text(x + textWidth('❯ ', layout.codeSize), firstY, `languages --top ${rows.filter((row) => row.name !== 'Other').length}`, c.text, layout.codeSize, 'class="terminal-command"');
  captionLines.forEach((value, index) => segments(x, firstY + (index + 1) * layout.codeLine, [['comment', `# ${value}`]], layout.codeSize));
  const cellWidth = mobile ? 8 : 7;
  const cellGap = 2;
  const nameWidth = mobile ? 0 : 150;
  rows.forEach((row, index) => {
    const y = rowsTop + index * rowHeight;
    const label = row.name.length > (mobile ? 30 : 17) ? `${row.name.slice(0, mobile ? 27 : 14)}...` : row.name;
    text(x, y, label, c.text, layout.codeSize);
    text(width - PADDING - 14, y, `${row.percentage.toFixed(1)}%`, c.text, layout.codeSize, 'text-anchor="end"');
    const meterX = mobile ? x : x + nameWidth;
    const meterY = mobile ? y + 9 : y - 10;
    const filled = row.percentage > 0 ? Math.max(1, Math.round(layout.cells * Math.min(100, row.percentage) / 100)) : 0;
    const color = row.name === 'Other' ? c.muted : LANGUAGE_COLORS[row.name] ?? c.accent;
    for (let cell = 0; cell < layout.cells; cell += 1) {
      rect(meterX + cell * (cellWidth + cellGap), meterY, cellWidth, 11, c.raised, 1);
    }
    if (filled) {
      raw(`<g class="language-bar" style="animation-delay: ${COMMAND_DURATION_MS + index * BAR_STAGGER_MS}ms">${Array.from({ length: filled }, (_, cell) => `<rect x="${meterX + cell * (cellWidth + cellGap)}" y="${meterY}" width="${cellWidth}" height="11" rx="1" fill="${color}"/>`).join('')}</g>`);
    }
  });
  if (!rows.length) {
    text(x, rowsTop, 'No language bytes reported.', c.muted, layout.codeSize);
  }
  if (alsoLines.length) {
    segments(x, alsoTop + layout.codeLine * 0.5, [['comment', '# also used, included in Other:']], layout.codeSize);
    alsoLines.forEach((value, index) => segments(x, alsoTop + layout.codeLine * (index + 1.5), [['comment', `# ${value}`]], layout.codeSize));
  }
  segments(x, promptY, [['prompt', '❯ ']], layout.codeSize);
  rect(Number((x + textWidth('❯ ', layout.codeSize)).toFixed(1)), promptY - layout.codeSize + 2, 8, layout.codeSize + 2, c.accent, 0, 'class="editor-cursor"');
  statusBar(s, config, data, mode, 'languages');
  return s.finish();
}

const BADGE_ICONS = {
  email: 'M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z',
  x: 'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z',
  linkedin: 'M0 2a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zM3.6 9v11.4h3.6V9zm1.8-5.8a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2zM9.1 9v11.4h3.6v-5.5c0-1.5.3-2.9 2.1-2.9s1.8 1.7 1.8 3v5.4H20v-6.1c0-3.2-.7-5.6-4.4-5.6-1.8 0-3 1-3.5 1.9V9z',
  hn: 'M0 24V0h24v24H0zM6.951 5.896l4.112 7.708v5.064h1.583v-4.972l4.148-7.799h-1.749l-2.457 4.875c-.372.745-.688 1.434-.688 1.434s-.297-.708-.651-1.434L8.831 5.896h-1.88z',
};

export const BADGE_ICON_NAMES = Object.keys(BADGE_ICONS);

function badge(item, theme) {
  const c = THEMES[theme];
  const label = item.label.toUpperCase();
  const value = item.handle;
  const size = 11;
  const labelWidth = Math.ceil(34 + label.length * (size * CHARACTER_WIDTH + 1.5) + 12);
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
  return [
    ...emails.map((email, index) => ({ id: index ? `email-${index + 1}` : 'email', icon: 'email', label: 'Email', handle: email, url: `mailto:${email}` })),
    ...socials.filter((social) => social.url && BADGE_ICONS[social.icon]).map((social) => ({
      id: social.icon, icon: social.icon, label: social.label, handle: social.handle ?? social.label, url: social.url,
    })),
  ];
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
  for (const item of badgeItems(config)) {
    for (const theme of Object.keys(THEMES)) {
      assets[`badge-${item.id}-${theme}.svg`] = badge(item, theme);
    }
  }
  return assets;
}

function link(label, url) {
  const text = label.replace(/[\\[\]]/g, '\\$&');
  const target = url.replace(/[()]/g, (character) => encodeURIComponent(character).replace('(', '%28').replace(')', '%29'));
  return `[${text}](${target})`;
}

const TECH_STACK = /(<!-- tech-stack:start -->)[\s\S]*?(<!-- tech-stack:end -->)/;

function attribute(value) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function techStack(items, newline) {
  const icon = (item, theme) => `https://skillicons.dev/icons?i=${item.icon}&amp;theme=${theme}`;
  return ['<p>', ...items.flatMap((item) => [
    `  <a href="${attribute(item.url)}" title="${attribute(item.label)}"><picture>`,
    `    <source media="(prefers-color-scheme: dark)" srcset="${icon(item, 'dark')}">`,
    `    <img src="${icon(item, 'light')}" alt="${attribute(item.label)}" width="48" height="48">`,
    '  </picture></a>',
  ]), '</p>'].join(newline);
}

export function updateReadme(readme, config, assets) {
  let result = readme.replace(/(<img\b[^>]*\balt=")[^"]*("[^>]*\bsrc="assets\/([^"]+)"[^>]*>)/g, (original, before, after, name) => {
    const description = assets[name]?.match(/<desc id="desc">([\s\S]*?)<\/desc>/)?.[1];
    return description === undefined ? original : `${before}${description}${after}`;
  });
  if (Array.isArray(config.techStack)) {
    const newline = result.includes('\r\n') ? '\r\n' : '\n';
    result = result.replace(TECH_STACK, (original, start, end) => `${start}${newline}${techStack(config.techStack, newline)}${newline}${end}`);
  }
  const { emails = [], socials = [] } = config.contact ?? {};
  const links = [...emails.map((email) => link(email, `mailto:${email}`)), ...socials.filter((social) => social.url).map((social) => link(social.label, social.url))];
  if (!links.length) {
    return result;
  }
  const newline = result.includes('\r\n') ? '\r\n' : '\n';
  const lines = result.split(/\r?\n/);
  const contactIndex = lines.findIndex((line) => line.includes('](mailto:'));
  if (contactIndex >= 0) {
    lines[contactIndex] = links.join(' · ');
    return lines.join(newline);
  }
  return `${result.trimEnd()}${newline}${newline}${links.join(' · ')}${newline}`;
}

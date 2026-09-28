import { badgeItems } from './svg.mjs';

const TECH_STACK = /(<!-- tech-stack:start -->)[\s\S]*?(<!-- tech-stack:end -->)/;
const SOCIALS = /(<!-- socials:start -->)[\s\S]*?(<!-- socials:end -->)/;

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

function socials(items, newline) {
  return ['<p>', ...items.flatMap((item) => [
    `  <a href="${attribute(item.url)}" title="${attribute(item.label)}"><picture>`,
    `    <source media="(prefers-color-scheme: dark)" srcset="assets/badge-${item.id}-dark.svg">`,
    `    <img src="assets/badge-${item.id}-light.svg" alt="${attribute(`${item.label}: ${item.handle}`)}" height="28">`,
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
  const items = badgeItems(config);
  if (items.length) {
    const newline = result.includes('\r\n') ? '\r\n' : '\n';
    result = result.replace(SOCIALS, (original, start, end) => `${start}${newline}${socials(items, newline)}${newline}${end}`);
  }
  return result;
}

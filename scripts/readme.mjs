function link(label, url) {
  const text = label.replace(/[\\[\]]/g, '\\$&');
  const target = url.replace(/[()]/g, (character) => encodeURIComponent(character).replace('(', '%28').replace(')', '%29'));
  return `[${text}](${target})`;
}

export function updateReadme(readme, config, assets) {
  let result = readme.replace(/(<img\b[^>]*\balt=")[^"]*("[^>]*\bsrc="assets\/([^"]+)"[^>]*>)/g, (original, before, after, name) => {
    const description = assets[name]?.match(/<desc id="desc">([\s\S]*?)<\/desc>/)?.[1];
    return description === undefined ? original : `${before}${description}${after}`;
  });
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

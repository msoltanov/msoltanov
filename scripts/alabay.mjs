export function drawProject(surface, name, x, y, phase = 0) {
  const { colors: c, raw } = surface;
  const cycle = Math.sin(Math.PI * phase) ** 2;
  let drawing;
  if (name === 'pdf-shrinker') {
    const scale = 1 - cycle * 0.4;
    drawing = `<g data-animation="pdf-compress" transform="translate(${(cycle * 38).toFixed(2)} ${(cycle * 24).toFixed(2)}) scale(${scale.toFixed(4)})"><path d="M13 9H58L73 24V87H13Z" fill="${c.coat}"/><path d="M58 9V24H73M26 40H58M26 51H52M26 62H46" fill="none"/></g><path d="M94 44H121L132 55V97H94Z" fill="${c.accent}"/><path d="M121 44V55H132M102 69H122M102 78H117" fill="none" stroke="${c.ink}"/><path d="M76 60H88M83 55L88 60L83 65" fill="none" stroke="${c.copper}"/>`;
  } else if (name === 'Unstar') {
    const opacity = 1 - cycle;
    drawing = `<path data-animation="star-dissolve" opacity="${opacity.toFixed(3)}" d="M61 12L73 38L102 42L81 63L86 92L61 78L36 92L41 63L20 42L49 38Z" fill="${c.copper}"/>`;
    const particles = [
      [32, 20],
      [81, 23],
      [93, 61],
      [68, 88],
      [32, 68],
    ];
    particles.forEach(([px, py], index) => {
      const offset = cycle * (10 + index * 3);
      drawing += `<rect x="${(px + offset).toFixed(2)}" y="${(py - offset * 0.6).toFixed(2)}" width="6" height="6" opacity="${cycle.toFixed(3)}" fill="${c.accent}" stroke="none"/>`;
    });
    drawing += `<path d="M25 107H115" stroke="${c.border}"/>`;
  } else {
    const length = 5 + cycle * 38;
    drawing = `<path d="M24 16H101V99H24Z" fill="${c.coat}"/><path d="M35 16V99" fill="none"/><path data-animation="notebook-write" d="M45 34h${length.toFixed(2)}M45 45h${(length * 0.8).toFixed(2)}M45 56h${(length * 0.9).toFixed(2)}" fill="none"/><rect x="65" y="64" width="68" height="35" rx="4" fill="${c.accent}"/><path d="M87 74L80 81L87 88M111 74L118 81L111 88M102 72L97 90" fill="none" stroke="${c.ink}"/>`;
  }
  raw(
    `<g transform="translate(${x} ${y})" stroke="${c.outline}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${drawing}</g>`,
  );
}

const TAU = Math.PI * 2;
const ORNAMENT_SWING_DEGREES = 6.5;
const ORNAMENT_CYCLES = 2;
const LIGHT_CHASE_CYCLES = 3;
const LIGHT_PHASE_SPACING = 0.38;
const LIGHT_CORE_RADIUS = 3;
const LIGHT_GLOW_RADIUS = 7;
const LIGHT_CORE_MIN_OPACITY = 0.22;
const LIGHT_GLOW_MIN_OPACITY = 0.02;
const LIGHT_GLOW_MAX_OPACITY = 0.2;
const STAR_CYCLES = 2;
const STAR_CORE_MIN_OPACITY = 0.55;
const STAR_GLOW_MIN_OPACITY = 0.06;
const STAR_GLOW_MAX_OPACITY = 0.24;
const STAR_GLOW_MIN_RADIUS = 16;
const STAR_GLOW_MAX_RADIUS = 21;
const TWINKLE_CYCLES = 2;
const TWINKLE_PHASE_SPACING = 0.23;
const TWINKLE_MAX_OPACITY = 0.85;
const WARM_WHITE = '#fff0d2';
const ORNAMENT_COLORS = ['#bd896b', '#d5c29a', '#5c7160'];
const ORNAMENTS = [
  [225, 160, 5],
  [246, 202, 5.5],
  [199, 218, 5.5],
  [172, 273, 6],
  [250, 281, 5.5],
  [285, 300, 6],
  [141, 349, 6],
  [221, 361, 6.5],
  [318, 363, 6],
];
const LIGHTS = [
  [215, 180],
  [230, 189],
  [245, 195],
  [259, 197],
  [187, 246],
  [210, 259],
  [235, 267],
  [260, 268],
  [282, 263],
  [151, 321],
  [182, 333],
  [217, 342],
  [253, 347],
  [289, 346],
  [321, 339],
  [118, 383],
  [157, 394],
  [199, 401],
  [243, 403],
  [287, 400],
  [332, 390],
];
const TWINKLES = [
  [208, 227],
  [263, 310],
  [173, 358],
  [288, 378],
];

export function drawWinterDecorations(surface, progress, style) {
  const phase = progress - Math.floor(progress);
  const { raw, colors: c } = surface;
  raw(
    `<g data-feature="winter-ribbon" fill="${c.copper}" opacity="0.58"><path d="M207 188Q234 211 267 205L271 211Q235 218 204 193Z"/><path d="M173 258Q229 296 302 280L307 286Q232 305 168 264Z"/><path d="M123 344Q225 388 342 361L348 368Q227 399 117 351Z"/><path d="M208 188Q235 210 267 205M173 258Q229 295 302 280M123 344Q225 387 342 361" fill="none" stroke="${style.accent}" stroke-width="0.8" opacity="0.8"/></g>`,
  );
  ORNAMENTS.forEach(([x, y, radius], index) => {
    const swing =
      Math.sin((phase * ORNAMENT_CYCLES + index * 0.071) * TAU) *
      ORNAMENT_SWING_DEGREES;
    const color = ORNAMENT_COLORS[index % ORNAMENT_COLORS.length];
    raw(
      `<g data-motion="winter-ornament" transform="rotate(${swing.toFixed(3)} ${x} ${y})"><path d="M${x} ${y}V${y + 6}" fill="none" stroke="${style.accent}" stroke-width="0.8"/><path d="M${x - 1.5} ${y + 5}H${x + 1.5}V${y + 8}H${x - 1.5}Z" fill="${style.accent}"/><circle cx="${x}" cy="${y + 8 + radius}" r="${radius}" fill="${color}" stroke="${c.outline}" stroke-width="0.65"/><path d="M${x - radius * 0.48} ${y + 8 + radius}Q${x - radius * 0.5} ${y + 8 + radius * 0.42} ${x} ${y + 8 + radius * 0.4}" fill="none" stroke="#f0dfba" stroke-width="0.9" opacity="0.48"/></g>`,
    );
  });
  LIGHTS.forEach(([x, y], index) => {
    const wave =
      (1 +
        Math.cos(
          phase * LIGHT_CHASE_CYCLES * TAU - index * LIGHT_PHASE_SPACING,
        )) /
      2;
    const opacity =
      LIGHT_CORE_MIN_OPACITY + wave ** 2 * (1 - LIGHT_CORE_MIN_OPACITY);
    const haloOpacity =
      LIGHT_GLOW_MIN_OPACITY +
      wave ** 3 * (LIGHT_GLOW_MAX_OPACITY - LIGHT_GLOW_MIN_OPACITY);
    raw(
      `<circle data-motion="winter-light-glow" cx="${x}" cy="${y}" r="${LIGHT_GLOW_RADIUS}" fill="${WARM_WHITE}" opacity="${haloOpacity.toFixed(3)}"/><circle data-motion="winter-light-chase" cx="${x}" cy="${y}" r="${LIGHT_CORE_RADIUS}" fill="${WARM_WHITE}" opacity="${opacity.toFixed(3)}"/>`,
    );
  });
  const glow = (1 + Math.sin((phase * STAR_CYCLES + 0.1) * TAU)) / 2;
  const starHaloOpacity =
    STAR_GLOW_MIN_OPACITY +
    glow * (STAR_GLOW_MAX_OPACITY - STAR_GLOW_MIN_OPACITY);
  const starHaloRadius =
    STAR_GLOW_MIN_RADIUS + glow * (STAR_GLOW_MAX_RADIUS - STAR_GLOW_MIN_RADIUS);
  const starCoreOpacity =
    STAR_CORE_MIN_OPACITY + glow * (1 - STAR_CORE_MIN_OPACITY);
  raw(
    `<g data-motion="winter-star-glow" opacity="${starHaloOpacity.toFixed(3)}" fill="${WARM_WHITE}"><circle cx="234" cy="95" r="${starHaloRadius.toFixed(3)}"/><path d="M222 95H246M234 83V107" fill="none" stroke="${WARM_WHITE}" stroke-width="0.75"/></g><path data-motion="winter-star-core" d="M234 86L236 92L243 95L236 98L234 104L232 98L225 95L232 92Z" fill="${WARM_WHITE}" opacity="${starCoreOpacity.toFixed(3)}"/>`,
  );
  TWINKLES.forEach(([x, y], index) => {
    const pulse =
      Math.max(
        0,
        Math.sin(
          (phase * TWINKLE_CYCLES + index * TWINKLE_PHASE_SPACING) * TAU,
        ),
      ) ** 4;
    raw(
      `<path data-motion="winter-twinkle" transform="translate(${x} ${y})" d="M0-4L1-1L4 0L1 1L0 4L-1 1L-4 0L-1-1Z" fill="${WARM_WHITE}" opacity="${(pulse * TWINKLE_MAX_OPACITY).toFixed(3)}"/>`,
    );
  });
}

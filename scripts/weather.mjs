const TAU = Math.PI * 2;
const DESK_EDGE_Y = 309;
const GROUND_Y = 478;
const PUDDLE_X = 635;
const LEAF_LANDING_X = 650;
const LEAF_LANDING_Y = 477;
const LEAF_FALL_START = 0.12;
const LEAF_FALL_END = 0.58;
const SNOW_SETTLE_PHASE = 0.44;
const SNOW_COLOR = '#e7ece7';
const GLINT_COLOR = '#f2dfaf';

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

function visibility(phase, start, enter, leave, end) {
  return Math.min(
    clamp((phase - start) / (enter - start)),
    clamp((end - phase) / (end - leave)),
  );
}

function deskSnow(surface, phase) {
  const { raw } = surface;
  const opacity = visibility(phase, 0.08, 0.2, 0.78, 0.96);
  const accumulation = clamp((phase - 0.32) / 0.16) * 0.9;
  raw(
    `<g data-motion="desk-snow" data-state="${phase < SNOW_SETTLE_PHASE ? 'falling' : 'settled'}" opacity="${opacity.toFixed(3)}" fill="${SNOW_COLOR}"><path d="M681 309Q684 306 688 308Q693 303 697 307Q702 305 706 309Z" opacity="${accumulation.toFixed(3)}"/>`,
  );
  for (let index = 0; index < 2; index += 1) {
    const fall = clamp((phase - 0.12 - index * 0.08) / 0.3);
    const x = 690 + index * 10 + Math.sin(fall * TAU) * 2;
    const y = DESK_EDGE_Y - 13 + fall * 13;
    raw(
      `<circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="1.4" opacity="${(1 - clamp((phase - 0.4) / 0.08)).toFixed(3)}"/>`,
    );
  }
  raw('</g>');
}

function rainRipples(surface, phase) {
  const { raw, colors: c } = surface;
  const opacity = visibility(phase, 0.04, 0.14, 0.86, 0.98);
  raw(
    `<g data-motion="rain-ripple" opacity="${opacity.toFixed(3)}"><ellipse cx="${PUDDLE_X}" cy="${GROUND_Y}" rx="27" ry="3.5" fill="${c.muted}" opacity="0.14"/>`,
  );
  const drop = (phase * 2) % 1;
  const dropProgress = clamp(drop / 0.35);
  raw(
    `<path data-motion="rain-drop" d="M0-4V0" transform="translate(${PUDDLE_X} ${(444 + dropProgress * 31).toFixed(3)})" fill="none" stroke="${c.text}" stroke-width="1.1" opacity="${(Math.sin(dropProgress * Math.PI) * 0.55).toFixed(3)}"/>`,
  );
  for (let index = 0; index < 2; index += 1) {
    const ripple = (phase * 2 + index * 0.47) % 1;
    raw(
      `<ellipse cx="${PUDDLE_X}" cy="${GROUND_Y}" rx="${(3 + ripple * 22).toFixed(3)}" ry="${(0.5 + ripple * 2.5).toFixed(3)}" fill="none" stroke="${c.text}" stroke-width="0.9" opacity="${(Math.sin(ripple * Math.PI) * 0.6).toFixed(3)}"/>`,
    );
  }
  raw('</g>');
}

function landingLeaf(surface, phase, style) {
  const { raw, colors: c } = surface;
  const progress = clamp(
    (phase - LEAF_FALL_START) / (LEAF_FALL_END - LEAF_FALL_START),
  );
  const descent = progress * progress * (3 - 2 * progress);
  const x =
    LEAF_LANDING_X - (1 - descent) * 30 + Math.sin(progress * Math.PI) * 8;
  const y = LEAF_LANDING_Y - (1 - descent) * 77;
  const angle = -12 - (1 - progress) * 130;
  const opacity = visibility(phase, 0.08, 0.2, 0.8, 0.96);
  raw(
    `<g data-motion="landing-leaf" data-state="${phase < LEAF_FALL_END ? 'falling' : 'settled'}" transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${angle.toFixed(3)})" opacity="${opacity.toFixed(3)}"><path d="M-7 0Q-2-6 7 0Q-2 5-7 0Z" fill="${style.accent}"/><path d="M-5 0L5 0" fill="none" stroke="${c.muted}" stroke-width="0.7"/></g>`,
  );
}

function deskGlint(surface, phase) {
  const { raw } = surface;
  const opacity = visibility(phase, 0.1, 0.4, 0.55, 0.88) * 0.55;
  const travel = Math.sin(phase * Math.PI) ** 2 * 12;
  raw(
    `<g data-motion="desk-glint" transform="translate(${travel.toFixed(3)} 0)" opacity="${opacity.toFixed(3)}" stroke="${GLINT_COLOR}" stroke-linecap="round"><path d="M680 311H700" stroke-width="2.2"/><path d="M684 315H705" stroke-width="1" opacity="0.25"/></g>`,
  );
}

export function drawSeasonalInteractions(surface, progress, season, style) {
  const phase = progress - Math.floor(progress);
  if (season === 'winter') {
    deskSnow(surface, phase);
    return;
  }
  if (season === 'spring') {
    rainRipples(surface, phase);
    return;
  }
  if (season === 'autumn') {
    landingLeaf(surface, phase, style);
    return;
  }
  if (season === 'summer') {
    deskGlint(surface, phase);
  }
}

import { drawSeasonalInteractions } from './weather.mjs';
import { drawDeskLamp, drawNotebookSketch } from './desk-details.mjs';
import { drawWinterDecorations } from './winter.mjs';

const SCREEN = '#14201d';
const SCREEN_TEXT = '#b9cbc2';
const TAU = Math.PI * 2;
const TREE_SWAY_DEGREES = 2.2;
const WEATHER_DRIFT = 14;
const WORKFLOW_SWITCH_PHASE = 0.5;
const WORKFLOW_FADE_SHARE = 0.12;
const WORKFLOWS = [
  ['PLAN', 'BUILD', 'SHIP'],
  ['REVIEW', 'BUILD', 'TEST', 'DEPLOY'],
];
const BREATH_CYCLES = 2;
const EAR_TWITCH_START = 0.59;
const EAR_TWITCH_DURATION = 0.08;
const EAR_TWITCH_ANGLE = 5;
const PAW_TWITCH_START = 0.31;
const PAW_TWITCH_DURATION = 0.1;
const PAW_TWITCH_ANGLE = 4;
const PAW_TWITCH_LIFT = 1.8;
const SLEEPY_STRETCH_START = 2 / 24;
const SLEEPY_STRETCH_DURATION = 6 / 24;
const SLEEPY_STRETCH_EXTEND_SHARE = 0.35;
const SLEEPY_STRETCH_SETTLE_START = 0.65;
const SLEEPY_STRETCH_REACH = 32;
const SLEEPY_STRETCH_HEAD_FORWARD = 14;
const SLEEPY_STRETCH_HEAD_DIP = 8;
const WORKFLOW_STEP_SHARE = WORKFLOW_SWITCH_PHASE / WORKFLOWS[1].length;
const CODE_INITIAL_VALUE = 'web';
const CODE_UPDATED_VALUE = 'desktop';
const CODE_FONT_SIZE = 9;
const MONITOR_TAB_NAME_LIMIT = 27;
const CODE_FADE_SHARE = 0.04;
const CHECK_PATH_LENGTH = 18;
const AMBIENT_TRAVEL = 6;
const REFLECTION_TRAVEL = 12;
const SUNLIGHT_OPACITY = {
  winter: 0.035,
  spring: 0.055,
  summer: 0.075,
  autumn: 0.045,
};
const SEASON_STYLE = {
  winter: {
    label: 'WINTER',
    range: 'NOV — FEB',
    dark: '#243b34',
    middle: '#355047',
    light: '#53685a',
    accent: '#d1bd91',
  },
  spring: {
    label: 'SPRING',
    range: 'MAR — MAY',
    dark: '#34493c',
    middle: '#536b50',
    light: '#7f9270',
    accent: '#c0a99e',
  },
  summer: {
    label: 'SUMMER',
    range: 'JUN — AUG',
    dark: '#253e35',
    middle: '#3d5c48',
    light: '#667c59',
    accent: '#96a778',
  },
  autumn: {
    label: 'AUTUMN',
    range: 'SEP — OCT',
    dark: '#56453a',
    middle: '#8f6d46',
    light: '#b49361',
    accent: '#c8a171',
  },
};
const FOLIAGE = [
  [155, 244, 63, 43],
  [144, 202, 54, 48],
  [188, 167, 61, 48],
  [237, 145, 57, 47],
  [285, 176, 62, 51],
  [316, 223, 48, 44],
  [268, 248, 74, 43],
  [208, 235, 71, 53],
  [220, 193, 80, 60],
];

function particles(surface, phase, season, style) {
  const { raw, colors: c } = surface;
  const feature =
    season === 'winter'
      ? 'snow'
      : season === 'spring'
        ? 'petals'
        : 'falling-leaves';
  const count = season === 'winter' ? 12 : 6;
  raw(
    `<defs><clipPath id="workshop-weather"><rect x="65" y="90" width="335" height="370"/></clipPath></defs><g data-feature="${feature}" clip-path="url(#workshop-weather)">`,
  );
  for (let index = 0; index < count; index += 1) {
    const progress =
      (phase * (season === 'autumn' ? 1 : 2) + index * 0.137) % 1;
    const x =
      94 +
      ((index * 47) % 274) +
      Math.sin((progress + index) * TAU) * WEATHER_DRIFT;
    const y = 91 + progress * 360;
    const opacity = Math.sin(progress * Math.PI) * 0.62;
    if (season === 'winter') {
      raw(
        `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${index % 3 === 0 ? 1.8 : 1.1}" fill="${c.text}" opacity="${opacity.toFixed(3)}"/>`,
      );
      continue;
    }
    const angle = progress * 150 + index * 29;
    raw(
      `<path d="M-4 0Q0-5 5 0Q0 4-4 0Z" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle.toFixed(2)})" fill="${style.accent}" opacity="${opacity.toFixed(3)}"/>`,
    );
  }
  raw('</g>');
}

function tree(surface, phase, season, style) {
  const { raw, colors: c } = surface;
  const sway = Math.sin((phase + 0.13) * TAU) * TREE_SWAY_DEGREES;
  raw(
    `<g data-scene="tree" data-season="${season}"><ellipse cx="229" cy="469" rx="153" ry="12" fill="${c.raised}" opacity="0.7"/><path d="M218 469L225 293L236 272L247 469Z" fill="${style.dark}"/><path d="M231 465L233 278M233 335L193 282M235 316L273 261" fill="none" stroke="${c.muted}" stroke-width="1.2" opacity="0.5"/><g data-motion="tree-sway" transform="rotate(${sway.toFixed(3)} 234 344)">`,
  );
  if (season === 'winter') {
    raw(
      `<g data-feature="new-year-tree"><path d="M234 105C224 132 216 153 197 174L212 173C191 200 168 226 147 245L181 237C153 266 126 295 105 323L151 315C127 342 105 366 82 384C129 399 179 405 234 405C289 405 337 398 380 385C354 365 336 341 316 316L360 324C337 293 310 265 286 238L320 246C299 220 279 198 258 173L273 176C253 151 244 131 234 105Z" fill="${style.dark}"/><path d="M234 123C221 157 208 179 195 194L222 187C202 217 177 244 158 262L196 253C172 284 147 311 126 333L179 324C154 353 134 374 116 388C157 395 195 398 234 398C270 398 309 394 347 388C327 369 310 347 292 325L338 333C313 306 292 281 272 255L309 263C286 236 266 210 249 186L271 194C255 168 243 145 234 123Z" fill="${style.middle}"/><path d="M216 164L239 152M188 223L221 208M159 281L203 261M128 344L187 319M252 221L278 237M271 279L302 298M286 343L326 365" fill="none" stroke="${style.light}" stroke-width="1.1" opacity="0.55"/><path d="M213 164Q236 185 263 190M184 229Q238 263 289 253M144 304Q230 340 326 333M113 371Q228 404 351 381" fill="none" stroke="${style.accent}" stroke-width="0.8" opacity="0.46"/><path d="M234 84L237 92L245 95L237 98L234 106L231 98L223 95L231 92Z" fill="${style.accent}"/>`,
    );
    const lights = [
      [217, 169],
      [246, 183],
      [199, 237],
      [237, 254],
      [277, 256],
      [158, 310],
      [211, 328],
      [269, 336],
      [313, 336],
      [137, 379],
      [236, 396],
      [326, 386],
    ];
    lights.forEach(([x, y], index) => {
      const opacity =
        0.42 + 0.38 * (0.5 + Math.sin(phase * TAU + index * 0.9) * 0.5);
      raw(
        `<circle cx="${x}" cy="${y}" r="1.8" fill="#e5d7b5" opacity="${opacity.toFixed(3)}"/>`,
      );
    });
    drawWinterDecorations(surface, phase, style);
    raw('</g>');
  } else {
    raw(
      `<g data-feature="canopy"><path d="M234 356L221 216M229 290L165 238M232 261L281 199M226 237L194 180" fill="none" stroke="${style.dark}" stroke-width="9" stroke-linecap="round"/>`,
    );
    FOLIAGE.forEach(([x, y, rx, ry], index) => {
      const fill =
        index % 3 === 0
          ? style.dark
          : index % 3 === 1
            ? style.middle
            : style.light;
      raw(
        `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`,
      );
    });
    raw(
      `<path d="M126 216Q186 180 222 147M174 253Q233 238 293 190M248 259Q276 237 324 225" fill="none" stroke="${style.light}" stroke-width="1.2" opacity="0.3"/></g>`,
    );
    if (season === 'spring') {
      raw('<g data-feature="buds">');
      [
        [139, 208],
        [168, 161],
        [221, 113],
        [272, 150],
        [312, 207],
        [186, 262],
        [272, 260],
      ].forEach(([x, y]) => {
        raw(
          `<circle cx="${x}" cy="${y}" r="3" fill="${style.accent}" opacity="0.7"/>`,
        );
      });
      raw('</g>');
    }
  }
  raw('</g></g>');
  if (season !== 'summer') {
    particles(surface, phase, season, style);
  }
}

function sleepingAlabay(surface, phase) {
  const { colors: c, raw } = surface;
  const breathe = (1 + Math.sin((phase * BREATH_CYCLES + 0.13) * TAU)) / 2;
  const earProgress = (phase - EAR_TWITCH_START) / EAR_TWITCH_DURATION;
  const earAngle =
    earProgress > 0 && earProgress < 1
      ? Math.sin(earProgress * Math.PI) ** 2 * -EAR_TWITCH_ANGLE
      : 0;
  const pawProgress = (phase - PAW_TWITCH_START) / PAW_TWITCH_DURATION;
  const pawTwitch =
    pawProgress > 0 && pawProgress < 1
      ? Math.sin(pawProgress * Math.PI) ** 2
      : 0;
  const stretchProgress =
    (phase - SLEEPY_STRETCH_START) / SLEEPY_STRETCH_DURATION;
  const stretchRamp = Math.max(
    0,
    Math.min(
      1,
      stretchProgress / SLEEPY_STRETCH_EXTEND_SHARE,
      (1 - stretchProgress) / (1 - SLEEPY_STRETCH_SETTLE_START),
    ),
  );
  const stretch = stretchRamp ** 2 * (3 - 2 * stretchRamp);
  const reach = stretch * SLEEPY_STRETCH_REACH;
  raw(
    `<g data-scene="alabay" data-pose="sleeping" stroke="${c.outline}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="313" cy="473" rx="103" ry="8" fill="${c.raised}"/><g data-motion="breathing" transform="translate(0 ${(-breathe * 7.8).toFixed(3)}) scale(1 ${(1 + breathe * 0.018).toFixed(4)})"><path d="M266 451C275 424 345 421 371 440C385 453 380 470 349 473H274Z" fill="${c.coat}"/><path d="M326 428C350 425 373 438 377 452L351 459L329 445Z" fill="${c.copper}" opacity="0.77" stroke="none"/></g>`,
  );
  raw(
    `<path transform="rotate(${(Math.sin((phase + 0.2) * TAU) * 1.5).toFixed(3)} 366 460)" d="M367 464C396 474 404 454 395 448C390 445 383 448 386 453" fill="${c.copper}"/><g data-motion="sleepy-stretch-paws"><path data-motion="paw-twitch" transform="rotate(${(-pawTwitch * PAW_TWITCH_ANGLE).toFixed(3)} 258 461) translate(0 ${(-pawTwitch * PAW_TWITCH_LIFT).toFixed(3)})" d="M258 461C243 456 ${(225 - reach).toFixed(3)} 461 ${(222 - reach).toFixed(3)} 472H286C292 468 285 463 275 462Z" fill="${c.coat}"/></g><g data-motion="sleepy-stretch-head" transform="translate(${(-stretch * SLEEPY_STRETCH_HEAD_FORWARD).toFixed(3)} ${(stretch * SLEEPY_STRETCH_HEAD_DIP).toFixed(3)})"><g transform="rotate(${(-breathe * 1.3).toFixed(3)} 273 458)"><path d="M242 439C252 425 276 425 288 438L291 455C283 468 260 470 244 462L231 459L228 449Z" fill="${c.coat}"/><path data-motion="ear-twitch" transform="rotate(${earAngle.toFixed(3)} 278 434)" d="M275 430L288 437L292 450L282 459L275 446Z" fill="${c.copper}"/><path d="M231 447L243 449L240 454L229 453Z" fill="${c.outline}"/><path data-motion="closed-eye" data-state="closed" d="M252 444Q257 447 262 444" fill="none"/><path d="M242 459L249 460" fill="none" opacity="0.6"/></g></g></g>`,
  );
}

function ambientLight(surface, phase, season) {
  const { raw, colors: c } = surface;
  const sunlight = Math.sin((phase + 0.31) * TAU);
  const shadows = Math.sin((phase * 2 + 0.09) * TAU);
  const opacity = SUNLIGHT_OPACITY[season] * (0.9 + sunlight * 0.1);
  raw(
    `<g data-motion="sunlight" transform="translate(${(sunlight * AMBIENT_TRAVEL).toFixed(3)} 0)" opacity="${opacity.toFixed(3)}" fill="#e5d7b5"><path d="M214 331H331L620 477H340Z"/><path d="M353 347H384L676 477H608Z"/></g>`,
  );
  raw(
    `<g data-motion="leaf-shadows" transform="translate(${(shadows * AMBIENT_TRAVEL).toFixed(3)} ${(sunlight * 1.5).toFixed(3)})" opacity="${(0.055 + shadows * 0.012).toFixed(3)}" fill="${c.outline}"><ellipse cx="390" cy="431" rx="44" ry="5" transform="rotate(18 390 431)"/><ellipse cx="454" cy="450" rx="55" ry="6" transform="rotate(18 454 450)"/><ellipse cx="523" cy="461" rx="42" ry="5" transform="rotate(18 523 461)"/><path d="M324 406L555 476L552 478L323 409Z"/></g>`,
  );
}

function monitorFeedback(surface, phase) {
  const { raw, text, rect, colors: c } = surface;
  const reviewProgress = (phase - WORKFLOW_SWITCH_PHASE) / WORKFLOW_STEP_SHARE;
  const editing = reviewProgress >= 0 && reviewProgress < 1;
  let value =
    phase < WORKFLOW_SWITCH_PHASE ? CODE_INITIAL_VALUE : CODE_UPDATED_VALUE;
  if (editing) {
    value =
      reviewProgress < 0.5
        ? CODE_INITIAL_VALUE.slice(
            0,
            Math.floor(CODE_INITIAL_VALUE.length * (1 - reviewProgress * 2)),
          )
        : CODE_UPDATED_VALUE.slice(
            0,
            Math.floor(CODE_UPDATED_VALUE.length * (reviewProgress * 2 - 1)),
          );
  }
  const code = `const target = '${value}${editing ? '' : "';"}`;
  const opacity = Math.min(
    1,
    phase / CODE_FADE_SHARE,
    (1 - phase) / CODE_FADE_SHARE,
  );
  raw(
    `<g data-motion="monitor-code" data-state="${editing ? 'editing' : 'settled'}" opacity="${opacity.toFixed(3)}">`,
  );
  text(510, 224, code, SCREEN_TEXT, CODE_FONT_SIZE);
  if (editing) {
    rect(510 + code.length * CODE_FONT_SIZE * 0.6, 217, 3, 8, SCREEN_TEXT, 0);
  }
  raw('</g>');
  const testStart = WORKFLOW_SWITCH_PHASE + WORKFLOW_STEP_SHARE * 2;
  const deployStart = testStart + WORKFLOW_STEP_SHARE;
  const checkProgress = Math.max(
    0,
    Math.min(1, ((phase - testStart) / WORKFLOW_STEP_SHARE) * 2),
  );
  raw(
    `<path data-motion="test-check" d="M692 270L696 274L704 265" fill="none" stroke="${c.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${CHECK_PATH_LENGTH}" stroke-dashoffset="${(CHECK_PATH_LENGTH * (1 - checkProgress)).toFixed(3)}" opacity="${phase >= testStart ? opacity.toFixed(3) : 0}"/>`,
  );
  const deployProgress = Math.max(
    0,
    (phase - deployStart) / WORKFLOW_STEP_SHARE,
  );
  raw(
    `<circle data-motion="deploy-pulse" cx="698" cy="270" r="${(7 + deployProgress * 6).toFixed(3)}" fill="none" stroke="${c.accent}" stroke-width="1.2" opacity="${(Math.sin(deployProgress * Math.PI) * 0.7).toFixed(3)}"/>`,
  );
}

function workspace(surface, phase, projects) {
  const { raw, rect, line, text, colors: c } = surface;
  const command = 'desk --watch';
  const typing =
    phase < 0.35 ? phase / 0.35 : phase < 0.82 ? 1 : (1 - phase) / 0.18;
  const typed = command.slice(0, Math.floor(typing * command.length));
  raw(
    `<g data-scene="desk" stroke="${c.muted}" stroke-width="1.5" stroke-linejoin="round"><path d="M443 317H454L449 478H438ZM789 317H800L807 478H796Z" fill="${c.raised}"/><path d="M427 310H811V321H427Z" fill="${c.copper}"/><path d="M456 321H783V329H456Z" fill="${c.raised}"/><path d="M716 329V348Q716 355 732 355" fill="none" opacity="0.7"/></g>`,
  );
  raw('<g data-scene="monitor">');
  rect(
    490,
    151,
    245,
    148,
    c.raised,
    5,
    `stroke="${c.muted}" stroke-width="1.5"`,
  );
  rect(498, 159, 229, 131, SCREEN, 2);
  const reflection = Math.sin((phase + 0.27) * TAU);
  raw(
    `<defs><clipPath id="workshop-screen"><rect x="498" y="159" width="229" height="131" rx="2"/></clipPath></defs><g clip-path="url(#workshop-screen)"><path data-motion="monitor-reflection" transform="translate(${(reflection * REFLECTION_TRAVEL).toFixed(3)} 0)" d="M628 159H659L576 290H545Z" fill="${SCREEN_TEXT}" opacity="${(0.035 + reflection * 0.01).toFixed(3)}"/></g>`,
  );
  const project =
    projects[
      Math.min(projects.length - 1, Math.floor(phase * projects.length))
    ];
  const projectName = typeof project?.name === 'string' ? project.name : '';
  const tab = projectName
    ? `repo: ${projectName.length > MONITOR_TAB_NAME_LIMIT ? `${projectName.slice(0, MONITOR_TAB_NAME_LIMIT - 3)}...` : projectName}`
    : 'architecture / review';
  text(510, 179, tab, SCREEN_TEXT, 10, 'data-motion="project-tab"');
  line(510, 187, 715, 187, '#385045');
  text(510, 210, `> ${typed}`, SCREEN_TEXT, 12);
  if (Math.floor(phase * 12) % 2 === 0) {
    rect(524 + typed.length * 7.2, 200, 5, 12, SCREEN_TEXT, 0);
  }
  line(540, 244, 689, 244, '#5c7b6a');
  const labels = WORKFLOWS[phase < WORKFLOW_SWITCH_PHASE ? 0 : 1];
  const progress = (phase % WORKFLOW_SWITCH_PHASE) / WORKFLOW_SWITCH_PHASE;
  const active = Math.min(
    labels.length - 1,
    Math.floor(progress * labels.length),
  );
  const fade = Math.min(
    1,
    progress / WORKFLOW_FADE_SHARE,
    (1 - progress) / WORKFLOW_FADE_SHARE,
  );
  const opacity = 0.65 + fade * 0.35;
  const rowWidth = 203;
  const gap = 8;
  const cellWidth = (rowWidth - gap * (labels.length - 1)) / labels.length;
  raw(
    `<g data-workflow="${labels.join('-').toLowerCase()}" opacity="${opacity.toFixed(3)}">`,
  );
  labels.forEach((label, index) => {
    const x = 510 + index * (cellWidth + gap);
    const selected = index === active;
    rect(
      x,
      232,
      cellWidth,
      24,
      selected ? '#355845' : '#243d31',
      2,
      `stroke="${selected ? '#8fae9c' : '#4a6556'}" stroke-width="1" data-step="${label}" data-state="${selected ? 'active' : 'idle'}"`,
    );
    text(x + cellWidth / 2, 248, label, SCREEN_TEXT, 8, 'text-anchor="middle"');
  });
  raw('</g>');
  raw(
    `<circle cx="${(541 + progress * 137).toFixed(2)}" cy="270" r="2" fill="${c.accent}" opacity="${Math.sin(progress * Math.PI).toFixed(3)}"/>`,
  );
  line(541, 270, 678, 270, '#355044');
  monitorFeedback(surface, phase);
  raw(
    `<path d="M602 299V307H581H642H622V299" fill="none" stroke="${c.muted}" stroke-width="1.5"/>`,
  );
  raw('</g>');
  rect(507, 304, 164, 5, c.raised, 1, `stroke="${c.muted}" stroke-width="1"`);
  for (let key = 0; key < 15; key += 1) {
    line(515 + key * 10, 306, 520 + key * 10, 306, c.muted);
  }
  raw(
    `<g data-scene="notebook" stroke="${c.muted}" stroke-width="1.3" stroke-linejoin="round"><path d="M738 289L785 284L798 305L751 310Z" fill="${c.coat}"/><path d="M744 290L755 306" fill="none"/><path d="M787 284L804 302" fill="none" stroke="${c.copper}" stroke-width="2"/></g>`,
  );
  text(770, 280, 'ADR', c.muted, 9, 'text-anchor="middle" letter-spacing="1"');
  drawNotebookSketch(surface, phase);
  raw(
    `<g data-scene="server"><rect x="708" y="359" width="83" height="118" rx="4" fill="${c.raised}" stroke="${c.muted}" stroke-width="1.3"/>`,
  );
  for (let slot = 0; slot < 3; slot += 1) {
    const y = 370 + slot * 31;
    rect(717, y, 65, 22, SCREEN, 2);
    const opacity =
      0.35 + (0.5 + Math.sin(phase * TAU * (4 + slot) + slot * 2) * 0.5) * 0.55;
    raw(
      `<circle data-motion="server-light" cx="724" cy="${y + 11}" r="1.8" fill="${c.accent}" opacity="${opacity.toFixed(3)}"/>`,
    );
    for (let vent = 0; vent < 4; vent += 1) {
      line(742 + vent * 8, y + 7, 742 + vent * 8, y + 15, '#4c6257');
    }
  }
  raw('</g>');
  const steam = (1 + Math.sin((phase * 4 + 0.41) * TAU)) * 1.5;
  raw(
    `<g stroke="${c.muted}" stroke-width="1.2" stroke-linecap="round"><path d="M461 288H480V308H461ZM481 292C495 289 495 305 481 302" fill="${c.coat}"/><path data-motion="steam" transform="translate(${(Math.sin((phase * 2 + 0.16) * TAU) * 0.8).toFixed(3)} ${(-steam).toFixed(3)})" d="M467 282C462 277 472 274 467 269M475 281C470 275 480 272 475 267" fill="none" opacity="0.55"/></g>`,
  );
}

export function drawWorkshop(
  surface,
  progress,
  season = 'winter',
  presentation = 'standalone',
  { projects = [], lamp = 'on' } = {},
) {
  const phase = progress - Math.floor(progress);
  const selected = Object.hasOwn(SEASON_STYLE, season) ? season : 'winter';
  const style = SEASON_STYLE[selected];
  const { colors: c, raw, line, text } = surface;
  if (presentation === 'standalone') {
    text(
      32,
      34,
      'ENGINEERING FIELDNOTES',
      c.accent,
      12,
      'font-weight="700" letter-spacing="1.4"',
    );
    line(32, 54, 828, 54);
    text(
      32,
      78,
      'SYSTEMS. DIRECTION. DELIVERY.',
      c.muted,
      10,
      'letter-spacing="1.1"',
    );
  }
  line(48, 479, 814, 479);
  raw(`<path d="M48 485H814" fill="none" stroke="${c.border}" opacity="0.3"/>`);
  ambientLight(surface, phase, selected);
  tree(surface, phase, selected, style);
  workspace(surface, phase, projects);
  drawDeskLamp(surface, phase, lamp);
  drawSeasonalInteractions(surface, phase, selected, style);
  sleepingAlabay(surface, phase);
  if (presentation !== 'integrated') {
    text(
      32,
      506,
      'ARCHITECTURE / DECISIONS / DELIVERY',
      c.muted,
      9,
      'letter-spacing="1.2"',
    );
  }
  if (presentation === 'standalone') {
    text(
      828,
      506,
      'DESK / WATCH',
      c.muted,
      9,
      'text-anchor="end" letter-spacing="1.2"',
    );
  }
}

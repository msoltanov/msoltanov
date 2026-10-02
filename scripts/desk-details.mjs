const TAU = Math.PI * 2;
const LAMP_COLOR = '#ead2a3';
const LAMP_GLOW_OPACITY = 0.085;
const LAMP_GLOW_VARIATION = 0.007;
const SKETCH_START = 0.12;
const SKETCH_HOLD_END = 0.84;
const SKETCH_END = 0.96;
const SKETCH_CONNECTOR_LENGTH = 25;
const SKETCH_NODE_PERIMETER = 16;
const SKETCH_NODES = [
  [1, 1, 0.12],
  [23, 1, 0.27],
  [23, 12, 0.43],
];

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

function envelope(phase, start, enter, leave, end) {
  return Math.min(
    clamp((phase - start) / (enter - start)),
    clamp((end - phase) / (end - leave)),
  );
}

export function drawDeskLamp(surface, progress, state = 'on') {
  const phase = progress - Math.floor(progress);
  const selected = state === 'off' ? 'off' : 'on';
  const { raw, colors: c } = surface;
  const glow =
    selected === 'on'
      ? LAMP_GLOW_OPACITY + Math.sin((phase + 0.11) * TAU) * LAMP_GLOW_VARIATION
      : 0;
  const rocker =
    selected === 'on'
      ? 'M795.5 305L802.5 306L802.5 309.5L795.5 308.5Z'
      : 'M795.5 306L802.5 305L802.5 308.5L795.5 309.5Z';
  const rockerFacet =
    selected === 'on' ? 'M796 306L802 307' : 'M796 307L802 306';
  raw(
    `<g data-scene="desk-lamp" data-lamp="${selected}"><g data-motion="lamp-glow" opacity="${glow.toFixed(3)}" fill="${LAMP_COLOR}"><path d="M778 227L744 309H810L803 227Z"/><ellipse cx="782" cy="309" rx="29" ry="3" opacity="0.6"/></g><g stroke="${c.muted}" stroke-linecap="round" stroke-linejoin="round"><path data-part="lamp-arm" d="M799 307V291L815 250L791 215" fill="none" stroke="${c.raised}" stroke-width="4.4"/><path d="M799 307V291L815 250L791 215" fill="none" stroke-width="1.2"/><circle cx="799" cy="291" r="2.1" fill="${c.raised}" stroke-width="1.2"/><circle cx="815" cy="250" r="2.2" fill="${c.raised}" stroke-width="1.2"/><ellipse data-part="lamp-base" cx="799" cy="309" rx="11" ry="2.1" fill="${c.raised}" stroke-width="1.2"/><path data-part="lamp-shade" d="M781 208L795 209L808 226Q790 233 773 227Z" fill="${c.raised}" stroke-width="1.2"/></g><ellipse cx="790" cy="227" rx="14.6" ry="2" fill="${selected === 'on' ? LAMP_COLOR : c.muted}" opacity="${selected === 'on' ? '0.82' : '0.32'}"/><g data-part="lamp-switch" data-state="${selected}" stroke-linejoin="round"><path d="M795 305L803 305L803 310L795 310Z" fill="${c.outline}"/><path d="${rocker}" fill="${c.raised}" stroke="${c.muted}" stroke-width="0.6"/><path d="${rockerFacet}" fill="none" stroke="${selected === 'on' ? c.accent : c.muted}" stroke-width="0.9"/></g></g>`,
  );
}

export function drawNotebookSketch(surface, progress) {
  const phase = progress - Math.floor(progress);
  const { raw, colors: c } = surface;
  raw(
    `<path data-part="notebook-tab" d="M776 285L784 284L788 290L780 291Z" fill="${c.accent}"/>`,
  );
  const opacity = envelope(
    phase,
    SKETCH_START,
    0.2,
    SKETCH_HOLD_END,
    SKETCH_END,
  );
  const connectorProgress = clamp((phase - 0.23) / 0.3);
  raw(
    `<defs><clipPath id="notebook-sketch-page"><path d="M750 291L783 287L792 302L757 306Z"/></clipPath></defs><g clip-path="url(#notebook-sketch-page)"><g data-motion="notebook-sketch" transform="matrix(1 -0.11 0.45 0.75 751 291)" opacity="${opacity.toFixed(3)}" stroke="${c.outline}" stroke-width="1.15" fill="none" stroke-linecap="round" stroke-linejoin="round"><path data-part="sketch-connectors" d="M5 3H23M25 5V12" stroke-dasharray="${SKETCH_CONNECTOR_LENGTH}" stroke-dashoffset="${(SKETCH_CONNECTOR_LENGTH * (1 - connectorProgress)).toFixed(3)}"/>`,
  );
  for (const [x, y, start] of SKETCH_NODES) {
    const drawn = clamp((phase - start) / 0.13);
    raw(
      `<rect x="${x}" y="${y}" width="4" height="4" rx="0.5" stroke-dasharray="${SKETCH_NODE_PERIMETER}" stroke-dashoffset="${(SKETCH_NODE_PERIMETER * (1 - drawn)).toFixed(3)}"/>`,
    );
  }
  const penProgress = clamp((phase - 0.18) / 0.34);
  const penX = penProgress < 0.72 ? 5 + (18 * penProgress) / 0.72 : 25;
  const penY = penProgress < 0.72 ? 3 : 5 + (7 * (penProgress - 0.72)) / 0.28;
  const penOpacity = envelope(phase, 0.17, 0.2, 0.5, 0.55);
  raw(
    `<g data-motion="sketch-pen" transform="translate(${penX.toFixed(3)} ${penY.toFixed(3)})" opacity="${penOpacity.toFixed(3)}"><path d="M0 0L4-8L6-7L2 1Z" fill="${c.copper}" stroke-width="0.7"/><path d="M0 0L2 1L0 2Z" fill="${c.outline}" stroke-width="0.5"/></g></g></g>`,
  );
}

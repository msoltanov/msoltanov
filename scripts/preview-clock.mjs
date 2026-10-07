import { SEASONS, SEASON_TIME_ZONE, seasonForDate } from './seasons.mjs';

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MILLISECONDS_PER_DAY =
  HOURS_PER_DAY *
  MINUTES_PER_HOUR *
  SECONDS_PER_MINUTE *
  MILLISECONDS_PER_SECOND;
const TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: SEASON_TIME_ZONE,
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
});

export function millisecondsUntilMidnight(now) {
  const parts = Object.fromEntries(
    TIME_FORMAT.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  const seconds =
    (Number(parts.hour) * MINUTES_PER_HOUR + Number(parts.minute)) *
      SECONDS_PER_MINUTE +
    Number(parts.second);
  return (
    MILLISECONDS_PER_DAY -
    seconds * MILLISECONDS_PER_SECOND -
    now.getUTCMilliseconds()
  );
}

export function startPreviewClock({
  window: browserWindow = globalThis.window,
  document = browserWindow.document,
  now = () => new Date(),
  setTimer = browserWindow.setTimeout.bind(browserWindow),
  clearTimer = browserWindow.clearTimeout.bind(browserWindow),
} = {}) {
  const selected = new URLSearchParams(browserWindow.location.search).get(
    'season',
  );
  if (SEASONS.includes(selected)) {
    return () => {};
  }

  let timer;
  const update = () => {
    clearTimer(timer);
    const current = now();
    const season = seasonForDate(current);
    const images = document.querySelectorAll(
      'img[data-seasonal-workspace], img[src*="/workshop-"], img[src*="/project-"], img[src*="/stats-"], img[src*="/languages-"]',
    );
    for (const image of images) {
      const replaceSeason = (value) =>
        value.replace(
          /(?:\/season-assets\/(?:winter|spring|summer|autumn)|assets)\/((?:workshop(?:-mobile)?(?:-lamp-off)?|project-\d+|stats|languages)-(?:dark|light)\.(?:gif|svg))/g,
          `/season-assets/${season}/$1`,
        );
      const src = image.getAttribute('src');
      const nextSrc = replaceSeason(src);
      for (const source of image
        .closest('picture')
        ?.querySelectorAll('source') ?? []) {
        const srcset = source.getAttribute('srcset');
        const nextSrcset = replaceSeason(srcset);
        if (nextSrcset !== srcset) {
          source.setAttribute('srcset', nextSrcset);
        }
      }
      if (nextSrc !== src) {
        image.setAttribute('src', nextSrc);
      }
      image.alt = image.alt.replace(
        /\b(winter|spring|summer|autumn)(?= engineering workspace)/,
        season,
      );
    }
    timer = setTimer(update, millisecondsUntilMidnight(current));
  };
  const recoverVisibility = () => {
    if (document.visibilityState === 'visible') {
      update();
    }
  };

  update();
  document.addEventListener('visibilitychange', recoverVisibility);
  browserWindow.addEventListener('pageshow', update);
  browserWindow.addEventListener('focus', update);

  return () => {
    clearTimer(timer);
    document.removeEventListener('visibilitychange', recoverVisibility);
    browserWindow.removeEventListener('pageshow', update);
    browserWindow.removeEventListener('focus', update);
  };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  startPreviewClock();
}

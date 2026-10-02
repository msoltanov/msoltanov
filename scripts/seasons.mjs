export const SEASONS = Object.freeze(['winter', 'spring', 'summer', 'autumn']);
export const SEASON_TIME_ZONE = 'Asia/Ashgabat';
export const SEASON_ACCENTS = Object.freeze({
  winter: { dark: '#a4d6cf', light: '#24635f' },
  spring: { dark: '#9acb9c', light: '#38663d' },
  summer: { dark: '#d7c58d', light: '#725b26' },
  autumn: { dark: '#d4ad86', light: '#815735' },
});

const SPRING_START_MONTH = 3;
const SUMMER_START_MONTH = 6;
const AUTUMN_START_MONTH = 9;
const WINTER_START_MONTH = 11;
const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: SEASON_TIME_ZONE,
  month: 'numeric',
});

export function seasonForDate(now) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error('Invalid season date.');
  }
  const month = Number(MONTH_FORMAT.format(now));
  if (month < SPRING_START_MONTH || month >= WINTER_START_MONTH) {
    return 'winter';
  }
  if (month < SUMMER_START_MONTH) {
    return 'spring';
  }
  if (month < AUTUMN_START_MONTH) {
    return 'summer';
  }
  return 'autumn';
}

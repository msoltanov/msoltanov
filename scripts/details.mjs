const MONTHS_PER_YEAR = 12;
const MILLISECONDS_PER_DAY = 86_400_000;

export function formatUptime(value, now = new Date()) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || !Number.isFinite(now.getTime())) {
    return 'Unavailable';
  }
  const date = value.slice(0, 10);
  const start = new Date(`${date}T00:00:00Z`);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== date || start > today) {
    return 'Unavailable';
  }
  const anniversary = (months) => {
    const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1));
    const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(start.getUTCDate(), lastDay)));
  };
  let months = (today.getUTCFullYear() - start.getUTCFullYear()) * MONTHS_PER_YEAR + today.getUTCMonth() - start.getUTCMonth();
  if (anniversary(months) > today) {
    months -= 1;
  }
  const days = Math.round((today - anniversary(months)) / MILLISECONDS_PER_DAY);
  return `${Math.floor(months / MONTHS_PER_YEAR)}y ${months % MONTHS_PER_YEAR}m ${days}d`;
}

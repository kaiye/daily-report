export function toIsoDateString(dateObj) {
  return dateObj.toISOString().slice(0, 10);
}

export function bjNow() {
  return new Date(Date.now() + 8 * 3600 * 1000);
}

export function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function inferUtcDateFromReportDate(reportDate) {
  const day = new Date(`${reportDate}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day;
}

export function getUtcWindow(utcDate) {
  const midnight = new Date(Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate(), 0, 0, 0));
  const end = new Date(midnight.getTime() + (24 * 3600 - 1) * 1000);
  return [Math.floor(midnight.getTime() / 1000), Math.floor(end.getTime() / 1000)];
}

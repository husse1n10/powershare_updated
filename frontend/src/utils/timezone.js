const FIXED_UTC_PLUS_2_OFFSET_MINUTES = 120;
const FIXED_UTC_PLUS_2_OFFSET_MS = FIXED_UTC_PLUS_2_OFFSET_MINUTES * 60 * 1000;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function parseAsSystemDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // MySQL DATETIME without timezone is treated as UTC+2 system time.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
    const iso = raw.replace(' ', 'T');
    const parsed = new Date(`${iso}+02:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // MySQL DATE without timezone is treated as UTC+2 system date.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = new Date(`${raw}T00:00:00+02:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toUtcPlus2Date(date = new Date()) {
  return new Date(date.getTime() + FIXED_UTC_PLUS_2_OFFSET_MS);
}

export function getCurrentMonthYearUtcPlus2() {
  const d = toUtcPlus2Date(new Date());
  return {
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
  };
}

export function getTodayDateInputUtcPlus2() {
  const d = toUtcPlus2Date(new Date());
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function formatDateUtcPlus2(value) {
  const parsed = parseAsSystemDate(value);
  if (!parsed) return '-';
  const d = toUtcPlus2Date(parsed);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
}

export function formatDateTimeUtcPlus2(value) {
  const parsed = parseAsSystemDate(value);
  if (!parsed) return '-';
  const d = toUtcPlus2Date(parsed);
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}


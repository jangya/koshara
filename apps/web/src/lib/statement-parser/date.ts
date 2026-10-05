export function parseStatementDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4}|\d{2})|^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const suffix = value.trim().slice(match[0].length);
  if (suffix && !/^\s*(?:[|,]\s*|at\s+)?([01]?\d|2[0-3]):[0-5]\d(?:\s*(?:AM|PM))?$/i.test(suffix)) return null;
  const year = match[4] ? Number(match[4]) : Number(match[3]!.length === 2 ? `20${match[3]}` : match[3]);
  const month = Number(match[4] ? match[5] : match[2]);
  const day = Number(match[4] ? match[6] : match[1]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
    : null;
}

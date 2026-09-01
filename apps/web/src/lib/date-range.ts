import type { DateRange } from "@astryxdesign/core/DateRangeInput";

export const DATE_RANGE_PRESETS = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "last-3-months", label: "Last 3 months" },
  { value: "last-6-months", label: "Last 6 months" },
  { value: "year-to-date", label: "Year to date" },
  { value: "custom", label: "Custom range" },
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number]["value"];

interface TimelineTransaction {
  date: string;
  kind: "expense" | "income";
  amountMinor: number;
}

export interface TimelinePoint {
  key: string;
  label: string;
  incomeMinor: number;
  spendingMinor: number;
}

export type TimelineGrouping = "daily" | "weekly" | "monthly";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function localDate(year: number, month: number, day: number) {
  return new Date(year, month, day, 12);
}

export function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as DateRange["start"];
}

function fromIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return localDate(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

export function isValidIsoDate(
  value: string | null,
): value is DateRange["start"] {
  if (!value || !isoDatePattern.test(value)) return false;
  return toLocalIsoDate(fromIsoDate(value)) === value;
}

function addDays(value: string, days: number) {
  const date = fromIsoDate(value);
  date.setDate(date.getDate() + days);
  return toLocalIsoDate(date);
}

export function getDateRangeDayCount(range: DateRange) {
  return (
    Math.round(
      (fromIsoDate(range.end).getTime() - fromIsoDate(range.start).getTime()) /
        86_400_000,
    ) + 1
  );
}

export function getDateRangePreset(
  preset: Exclude<DateRangePreset, "custom">,
  now = new Date(),
): DateRange {
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = toLocalIsoDate(now);

  if (preset === "last-month") {
    return {
      start: toLocalIsoDate(localDate(year, month - 1, 1)),
      end: toLocalIsoDate(localDate(year, month, 0)),
    };
  }

  const startMonth =
    preset === "last-3-months"
      ? month - 2
      : preset === "last-6-months"
        ? month - 5
        : month;

  return {
    start:
      preset === "year-to-date"
        ? toLocalIsoDate(localDate(year, 0, 1))
        : toLocalIsoDate(localDate(year, startMonth, 1)),
    end: today,
  };
}

export function getPreviousPeriod(range: DateRange): DateRange {
  const end = addDays(range.start, -1);
  return { start: addDays(end, -(getDateRangeDayCount(range) - 1)), end };
}

export function parseDateRangeParams(
  params: URLSearchParams,
  now = new Date(),
): { preset: DateRangePreset; range: DateRange } {
  const from = params.get("from");
  const to = params.get("to");
  const requestedPreset = params.get("range");
  const knownPreset = DATE_RANGE_PRESETS.some(
    ({ value }) => value === requestedPreset,
  )
    ? (requestedPreset as DateRangePreset)
    : null;

  if (isValidIsoDate(from) && isValidIsoDate(to) && from <= to) {
    return { preset: knownPreset ?? "custom", range: { start: from, end: to } };
  }

  return { preset: "last-month", range: getDateRangePreset("last-month", now) };
}

const dayFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric" });
const dayMonthFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
});
const fullFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const monthFormatter = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
});

export function formatDateRange(range: DateRange) {
  const start = fromIsoDate(range.start);
  const end = fromIsoDate(range.end);
  const isSameMonth =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth();
  const isFullMonth =
    isSameMonth &&
    start.getDate() === 1 &&
    end.getDate() ===
      localDate(end.getFullYear(), end.getMonth() + 1, 0).getDate();

  if (isFullMonth) return monthFormatter.format(start);
  if (isSameMonth)
    return `${dayFormatter.format(start)}–${fullFormatter.format(end)}`;
  if (start.getFullYear() === end.getFullYear()) {
    return `${dayMonthFormatter.format(start)}–${fullFormatter.format(end)}`;
  }
  return `${fullFormatter.format(start)}–${fullFormatter.format(end)}`;
}

export function isInDateRange(date: string, range: DateRange) {
  return date >= range.start && date <= range.end;
}

export function getTimelineGrouping(
  range: DateRange,
  requested: TimelineGrouping | "auto" = "auto",
): TimelineGrouping {
  if (requested !== "auto") return requested;
  return getDateRangeDayCount(range) > 93 ? "monthly" : "daily";
}

export function getTimelineKey(
  date: string,
  range: DateRange,
  grouping: TimelineGrouping,
) {
  if (grouping === "daily") return date;
  if (grouping === "monthly") return date.slice(0, 7);
  const offset = Math.floor(
    (fromIsoDate(date).getTime() - fromIsoDate(range.start).getTime()) /
      86_400_000,
  );
  return addDays(range.start, Math.max(0, Math.floor(offset / 7) * 7));
}

const shortDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
});
const shortDateYearFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const shortMonthYearFormatter = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  year: "numeric",
});

function timelineLabel(start: string, end: string, grouping: TimelineGrouping) {
  const startDate = fromIsoDate(start);
  if (grouping === "daily") return shortDateFormatter.format(startDate);
  if (grouping === "monthly") return shortMonthYearFormatter.format(startDate);
  const endDate = fromIsoDate(end);
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth();
  if (sameMonth)
    return `${startDate.getDate()}–${shortDateYearFormatter.format(endDate)}`;
  if (sameYear)
    return `${shortDateFormatter.format(startDate)}–${shortDateYearFormatter.format(endDate)}`;
  return `${shortDateYearFormatter.format(startDate)}–${shortDateYearFormatter.format(endDate)}`;
}

export function aggregateTimeline(
  transactions: TimelineTransaction[],
  range: DateRange,
  requestedGrouping: TimelineGrouping | "auto" = "auto",
): TimelinePoint[] {
  const grouping = getTimelineGrouping(range, requestedGrouping);
  const points = new Map<string, TimelinePoint>();
  let cursor = fromIsoDate(range.start);
  const end = fromIsoDate(range.end);

  while (cursor <= end) {
    const start = toLocalIsoDate(cursor);
    const key = grouping === "monthly" ? start.slice(0, 7) : start;
    if (!points.has(key)) {
      const bucketEnd =
        grouping === "weekly"
          ? [addDays(start, 6), range.end].sort()[0]!
          : start;
      points.set(key, {
        key,
        label: timelineLabel(start, bucketEnd, grouping),
        incomeMinor: 0,
        spendingMinor: 0,
      });
    }
    if (grouping === "monthly")
      cursor = localDate(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    else cursor.setDate(cursor.getDate() + (grouping === "weekly" ? 7 : 1));
  }

  transactions
    .filter((transaction) => isInDateRange(transaction.date, range))
    .forEach((transaction) => {
      const point = points.get(
        getTimelineKey(transaction.date, range, grouping),
      );
      if (!point) return;
      if (transaction.kind === "income")
        point.incomeMinor += transaction.amountMinor;
      else point.spendingMinor += transaction.amountMinor;
    });

  return [...points.values()];
}

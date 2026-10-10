// src/utils/date.ts
// All date math for Lumo Expense. We treat dates as local-timezone
// YYYY-MM-DD strings — never UTC — so that a transaction logged at
// 11:50 PM stays on that day even if the device is near midnight.

// ─────────────────────────────────────────────────────────────
// Basic conversions
// ─────────────────────────────────────────────────────────────

/** Convert a Date to a local-timezone YYYY-MM-DD string. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a local YYYY-MM-DD string into a Date at local midnight. */
export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

/** Today, at local midnight, as a Date. */
export function today(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** Today as YYYY-MM-DD. */
export function todayISO(): string {
  return toISODate(today());
}

// ─────────────────────────────────────────────────────────────
// Arithmetic
// ─────────────────────────────────────────────────────────────

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export function addMonths(d: Date, n: number): Date {
  const copy = new Date(d);
  const day = copy.getDate();
  copy.setDate(1);
  copy.setMonth(copy.getMonth() + n);
  // Clamp to end of month if the original day doesn't exist
  const lastDay = new Date(copy.getFullYear(), copy.getMonth() + 1, 0).getDate();
  copy.setDate(Math.min(day, lastDay));
  return copy;
}

// ─────────────────────────────────────────────────────────────
// Ranges (used by the home screen's Day / Week / Month toggle)
// ─────────────────────────────────────────────────────────────

export type DateRange = { start: Date; end: Date };

/** Start of week = Monday (ISO standard). */
export function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = day === 0 ? -6 : 1 - day; // move back to Monday
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function rangeForDay(d: Date): DateRange {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start, end };
}

export function rangeForWeek(d: Date): DateRange {
  const start = startOfWeek(d);
  const end = addDays(start, 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function rangeForMonth(d: Date): DateRange {
  return { start: startOfMonth(d), end: endOfMonth(d) };
}

/** Inclusive check — compares by local calendar day. */
export function isWithin(isoDate: string, range: DateRange): boolean {
  const t = fromISODate(isoDate).getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

// ─────────────────────────────────────────────────────────────
// Recurring rules
// ─────────────────────────────────────────────────────────────

export type Frequency = 'daily' | 'weekly' | 'monthly';

/**
 * Given the current `nextRunDate` of a recurring rule, return the
 * next one. Used after materializing a due transaction.
 */
export function advanceFrequency(iso: string, freq: Frequency): string {
  const d = fromISODate(iso);
  if (freq === 'daily') return toISODate(addDays(d, 1));
  if (freq === 'weekly') return toISODate(addDays(d, 7));
  return toISODate(addMonths(d, 1));
}

// ─────────────────────────────────────────────────────────────
// Display formatting
// ─────────────────────────────────────────────────────────────

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Oct 9" */
export function formatShort(iso: string): string {
  const d = fromISODate(iso);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** "Thu, Oct 9" */
export function formatMedium(iso: string): string {
  const d = fromISODate(iso);
  return `${DAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** "Thursday, October 9, 2026" */
export function formatLong(iso: string): string {
  const d = fromISODate(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Friendly relative label used on transaction rows. */
export function formatRelativeDay(iso: string): string {
  const t = today();
  const target = fromISODate(iso);
  const diffDays = Math.round(
    (target.getTime() - t.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 1) return 'Tomorrow';
  return formatMedium(iso);
}

/** Heading label for the current range filter. */
export function rangeLabel(range: DateRange, kind: 'day' | 'week' | 'month'): string {
  if (kind === 'day') return formatLong(toISODate(range.start));
  if (kind === 'week') {
    const a = range.start;
    const b = range.end;
    if (a.getMonth() === b.getMonth()) {
      return `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()} – ${b.getDate()}`;
    }
    return `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()} – ${MONTHS_SHORT[b.getMonth()]} ${b.getDate()}`;
  }
  return `${MONTHS_SHORT[range.start.getMonth()]} ${range.start.getFullYear()}`;
}
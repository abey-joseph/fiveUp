/**
 * Date helpers for the tracker timezone.
 *
 * Two kinds of values live here:
 * - **Instants** (`Date`): real moments in time. Converting an instant to a calendar day always
 *   needs a timezone (`tz`), which is the tracker's `settings.timezone` — never the device's.
 * - **Date keys** (`yyyy-MM-dd`): calendar days. Arithmetic on keys is pure calendar arithmetic
 *   (done in UTC internally) and never adds 24h to an instant, so DST days can't break it.
 */
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import type { DateKey } from './types.ts'

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

/** Parses a key into its parts. Throws on a malformed or impossible date. */
export function parseKey(key: DateKey): { year: number; month: number; day: number } {
  const m = KEY_RE.exec(key)
  if (!m) throw new Error(`Invalid date key: ${key}`)
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    throw new Error(`Invalid date key: ${key}`)
  }
  return { year, month, day }
}

export function isValidDateKey(key: unknown): key is DateKey {
  if (typeof key !== 'string') return false
  try {
    parseKey(key)
    return true
  } catch {
    return false
  }
}

/** Key → a UTC-midnight Date used only for calendar arithmetic (not a real instant). */
function keyToUtc(key: DateKey): Date {
  const { year, month, day } = parseKey(key)
  return new Date(Date.UTC(year, month - 1, day))
}

function utcToKey(d: Date): DateKey {
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

// ---------------------------------------------------------------------------
// Instants → keys (timezone-aware)
// ---------------------------------------------------------------------------

/** The calendar day of `date` in timezone `tz`. */
export function toDateKey(date: Date, tz: string): DateKey {
  return formatInTimeZone(date, tz, 'yyyy-MM-dd')
}

/** Today's key in the tracker timezone. */
export function todayKey(tz: string, now: Date = new Date()): DateKey {
  return toDateKey(now, tz)
}

/** True if `key` is after today in the tracker timezone. */
export function isFutureKey(key: DateKey, tz: string, now: Date = new Date()): boolean {
  return key > todayKey(tz, now)
}

/** The instant the calendar day `key` starts in `tz` (handles DST correctly). */
export function startOfDayInstant(key: DateKey, tz: string): Date {
  parseKey(key)
  return fromZonedTime(`${key}T00:00:00`, tz)
}

// ---------------------------------------------------------------------------
// Key arithmetic (pure calendar, timezone-free)
// ---------------------------------------------------------------------------

export function addDaysKey(key: DateKey, n: number): DateKey {
  const d = keyToUtc(key)
  d.setUTCDate(d.getUTCDate() + n)
  return utcToKey(d)
}

/** Whole calendar days from `a` to `b` (positive if `b` is later). */
export function diffDaysKey(a: DateKey, b: DateKey): number {
  return Math.round((keyToUtc(b).getTime() - keyToUtc(a).getTime()) / 86_400_000)
}

/** Day of week with Monday = 0 … Sunday = 6. */
export function weekdayIndex(key: DateKey): number {
  return (keyToUtc(key).getUTCDay() + 6) % 7
}

/** Monday of the week containing `key`. */
export function startOfWeekKey(key: DateKey): DateKey {
  return addDaysKey(key, -weekdayIndex(key))
}

/** Sunday of the week containing `key`. */
export function endOfWeekKey(key: DateKey): DateKey {
  return addDaysKey(startOfWeekKey(key), 6)
}

export function startOfMonthKey(key: DateKey): DateKey {
  const { year, month } = parseKey(key)
  return `${pad(year, 4)}-${pad(month)}-01`
}

export function endOfMonthKey(key: DateKey): DateKey {
  const { year, month } = parseKey(key)
  return utcToKey(new Date(Date.UTC(year, month, 0)))
}

/** First day of the month `n` months from the month containing `key`. */
export function addMonthsKey(key: DateKey, n: number): DateKey {
  const { year, month } = parseKey(key)
  return utcToKey(new Date(Date.UTC(year, month - 1 + n, 1)))
}

/** Inclusive list of keys from `from` to `to`. Empty if `from > to`. */
export function keysInRange(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = []
  for (let k = from; k <= to; k = addDaysKey(k, 1)) out.push(k)
  return out
}

// ---------------------------------------------------------------------------
// Formatting (device-timezone independent)
// ---------------------------------------------------------------------------

/** Formats a calendar day, e.g. `formatKey('2026-10-01', 'EEE, d MMM')` → "Thu, 1 Oct". */
export function formatKey(key: DateKey, pattern: string): string {
  // Noon UTC formatted in UTC: the calendar parts are exactly the key's, on any device.
  const d = keyToUtc(key)
  d.setUTCHours(12)
  return formatInTimeZone(d, 'UTC', pattern)
}

/** Time of an instant in the tracker timezone, e.g. "8:42 am". */
export function formatTimeInTz(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, 'h:mm aaa')
}

/** Current date + time in the tracker timezone, e.g. "Thu 1 Oct, 1:42 am". */
export function formatDateTimeInTz(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, 'EEE d MMM, h:mm aaa')
}

const TZ_SHORT_LABELS: Record<string, string> = {
  'Pacific/Auckland': 'NZ',
  'Asia/Singapore': 'SG',
  'Australia/Sydney': 'Sydney',
  'Europe/London': 'UK',
}

/** Short human label for a timezone, e.g. "NZ". Falls back to the IANA city name. */
export function tzShortLabel(tz: string): string {
  return TZ_SHORT_LABELS[tz] ?? (tz.split('/').pop() ?? tz).replace(/_/g, ' ')
}

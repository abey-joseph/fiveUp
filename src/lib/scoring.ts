/**
 * Pure scoring logic. No Firebase imports — also used by the backfill importer script.
 *
 * Rules (spec §3): points per meal, points per snack up to a cap, a full-day bonus when every
 * meal is done, and a streak bonus on full days whose streak reaches `streakBonusMinDays`.
 */
import { addDaysKey, keysInRange } from './dates.ts'
import { MEALS, MEAL_KEYS } from './meals.ts'
import type { DateKey, DayDoc, DayMap, Settings } from './types.ts'

export interface DayScore {
  /** Meals + snacks + full-day bonus. */
  base: number
  streakBonus: number
  total: number
  /** Consecutive full days ending on this day (0 if this day isn't full). */
  streak: number
  mealPoints: number
  snackPoints: number
  fullDayBonus: number
  mealsDone: number
}

export function mealsDone(day: DayDoc | undefined): number {
  if (!day) return 0
  return MEAL_KEYS.reduce((n, key) => n + (day.meals[key]?.done ? 1 : 0), 0)
}

export function isFullDay(day: DayDoc | undefined): boolean {
  return mealsDone(day) === MEAL_KEYS.length
}

function scoringSnacks(day: DayDoc, settings: Settings): number {
  const snacks = Number.isFinite(day.snacks) ? Math.max(0, Math.floor(day.snacks)) : 0
  return Math.min(snacks, settings.snackCap)
}

function baseParts(day: DayDoc | undefined, settings: Settings) {
  if (!day) return { mealPoints: 0, snackPoints: 0, fullDayBonus: 0, mealsDone: 0 }
  const done = mealsDone(day)
  return {
    mealPoints: done * settings.mealPoints,
    snackPoints: scoringSnacks(day, settings) * settings.snackPoints,
    fullDayBonus: done === MEAL_KEYS.length ? settings.fullDayBonus : 0,
    mealsDone: done,
  }
}

/** Meals + snacks + full-day bonus (no streak bonus). */
export function computeDayBaseScore(day: DayDoc | undefined, settings: Settings): number {
  const p = baseParts(day, settings)
  return p.mealPoints + p.snackPoints + p.fullDayBonus
}

/** Streak on a single day: walks back while days are full. */
export function streakAt(days: DayMap, key: DateKey): number {
  let n = 0
  for (let k = key; isFullDay(days[k]); k = addDaysKey(k, -1)) n++
  return n
}

/**
 * Streak for every day from the earliest loaded key up to `upTo` (inclusive).
 * Days before the earliest loaded key are treated as missing (non-full); use
 * {@link isStreakTruncated} to know whether more history must be loaded.
 */
export function computeStreaks(days: DayMap, upTo: DateKey): Record<DateKey, number> {
  const loaded = Object.keys(days).filter((k) => k <= upTo)
  if (loaded.length === 0) return {}
  loaded.sort()
  const out: Record<DateKey, number> = {}
  let prev = 0
  for (const key of keysInRange(loaded[0]!, upTo)) {
    prev = isFullDay(days[key]) ? prev + 1 : 0
    out[key] = prev
  }
  return out
}

/**
 * True when streaks may be undercounted because the loaded range starts on a full day
 * (the streak could continue before `rangeStart`). Load more history and recompute.
 */
export function isStreakTruncated(days: DayMap, rangeStart: DateKey): boolean {
  return isFullDay(days[rangeStart])
}

export function computeDayScore(dateKey: DateKey, days: DayMap, settings: Settings): DayScore {
  const parts = baseParts(days[dateKey], settings)
  const base = parts.mealPoints + parts.snackPoints + parts.fullDayBonus
  const streak = streakAt(days, dateKey)
  const streakBonus = streak > 0 && streak >= settings.streakBonusMinDays ? settings.streakBonus : 0
  return { ...parts, base, streakBonus, total: base + streakBonus, streak }
}

export function maxDailyScore(settings: Settings): number {
  return (
    MEALS.length * settings.mealPoints +
    settings.snackCap * settings.snackPoints +
    settings.fullDayBonus +
    settings.streakBonus
  )
}

/** Longest streak value in a streaks map. */
export function bestStreak(streaks: Record<DateKey, number>): number {
  return Object.values(streaks).reduce((a, b) => Math.max(a, b), 0)
}

/**
 * The streak to show on a day's screen. On today, a streak that's still alive (yesterday was full,
 * today isn't finished yet) is shown as `pending` so it doesn't drop to 0 mid-day.
 */
export function displayStreak(
  days: DayMap,
  selected: DateKey,
  today: DateKey,
): { days: number; pending: boolean } {
  const own = streakAt(days, selected)
  if (own > 0 || selected !== today) return { days: own, pending: false }
  const alive = streakAt(days, addDaysKey(today, -1))
  return { days: alive, pending: alive > 0 }
}

/**
 * Pure helpers for the History screen: month navigation and the per-day calendar cells.
 * Months are calendar months of tracker-timezone date keys (no instants involved).
 */
import {
  addMonthsKey,
  endOfMonthKey,
  isValidDateKey,
  keysInRange,
  parseKey,
  startOfMonthKey,
  weekdayIndex,
} from './dates.ts'
import { MEAL_KEYS } from './meals.ts'
import { computeDayScore } from './scoring.ts'
import type { DateKey, DayMap, Settings } from './types.ts'

/** Colour bucket of a calendar cell (spec §6.3). */
export type DayLevel = 'full' | 'most' | 'some' | 'none' | 'future'

export interface CalendarCell {
  key: DateKey
  /** Day of the month, 1–31. */
  dayOfMonth: number
  level: DayLevel
  mealsDone: number
  /** Total score incl. streak bonus; 0 for future days. */
  score: number
  isToday: boolean
}

export interface MonthSummary {
  /** First day of the month (`yyyy-MM-01`). */
  month: DateKey
  /** Empty cells before day 1 so weeks start on Monday. */
  leadingBlanks: number
  cells: CalendarCell[]
  /** Sum of daily totals for the month's past and current days. */
  totalScore: number
  fullDays: number
}

/** Full day → all meals; 3–4 → most; 1–2 → some; 0 or no data → none. */
export function dayLevel(mealsDone: number): Exclude<DayLevel, 'future'> {
  if (mealsDone >= MEAL_KEYS.length) return 'full'
  if (mealsDone >= 3) return 'most'
  if (mealsDone >= 1) return 'some'
  return 'none'
}

/**
 * Builds the calendar for the month containing `month`. `days` must include enough history
 * before the month for streak bonuses to be correct (see `useStreakDays`).
 */
export function summarizeMonth(
  month: DateKey,
  days: DayMap,
  settings: Settings,
  today: DateKey,
): MonthSummary {
  const start = startOfMonthKey(month)
  let totalScore = 0
  let fullDays = 0
  const cells = keysInRange(start, endOfMonthKey(start)).map((key): CalendarCell => {
    const base = { key, dayOfMonth: parseKey(key).day, isToday: key === today }
    if (key > today) return { ...base, level: 'future', mealsDone: 0, score: 0 }
    const s = computeDayScore(key, days, settings)
    const level = dayLevel(s.mealsDone)
    totalScore += s.total
    if (level === 'full') fullDays++
    return { ...base, level, mealsDone: s.mealsDone, score: s.total }
  })
  return { month: start, leadingBlanks: weekdayIndex(start), cells, totalScore, fullDays }
}

const MONTH_PARAM_RE = /^\d{4}-\d{2}$/

/** `yyyy-MM` for the URL (`/history?month=2026-09`). */
export function monthParam(month: DateKey): string {
  return startOfMonthKey(month).slice(0, 7)
}

/**
 * `?month=` from the URL → the first day of that month. Missing, invalid or future months fall
 * back to the current month (tracker timezone).
 */
export function resolveMonthParam(param: string | null, today: DateKey): DateKey {
  const current = startOfMonthKey(today)
  if (!param || !MONTH_PARAM_RE.test(param)) return current
  const key = `${param}-01`
  if (!isValidDateKey(key) || key > current) return current
  return key
}

/** The month `n` months from `month`, never after the current month. */
export function shiftMonth(month: DateKey, n: number, today: DateKey): DateKey {
  const next = addMonthsKey(month, n)
  const current = startOfMonthKey(today)
  return next > current ? current : next
}

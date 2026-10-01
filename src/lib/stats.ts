/**
 * Pure helpers for the Stats screen. All keys are tracker-timezone date keys; `today` comes from
 * `todayKey(settings.timezone)`.
 */
import { addDaysKey, diffDaysKey, keysInRange, startOfWeekKey } from './dates.ts'
import { MEALS, type MealDef } from './meals.ts'
import { bestStreak, computeDayScore, computeStreaks, displayStreak, isFullDay } from './scoring.ts'
import type { DateKey, DayMap, Settings } from './types.ts'

export const CHART_DAYS = 14

export interface ChartDay {
  key: DateKey
  score: number
  mealsDone: number
  full: boolean
}

export interface WeekStats {
  /** Monday of this week. */
  from: DateKey
  /** Days from Monday up to and including today (1–7). Future days aren't counted. */
  daysSoFar: number
  avgScore: number
  avgMeals: number
  /** Snacks logged (all of them, not just the ones that score). */
  snacks: number
}

export interface MostMissed {
  /** The meal(s) missed most often; several when tied. */
  meals: MealDef[]
  missed: number
  outOf: number
}

export interface StatsSummary {
  currentStreak: { days: number; pending: boolean }
  /** Best streak within the loaded days (`rangeStart` … today). */
  bestStreak: number
  /** Number of days the best streak was searched over. */
  bestStreakWindow: number
  week: WeekStats
  last14: ChartDay[]
  /** `null` when no meal was missed in the window. */
  mostMissed: MostMissed | null
}

export function weekStats(days: DayMap, settings: Settings, today: DateKey): WeekStats {
  const from = startOfWeekKey(today)
  const keys = keysInRange(from, today)
  let score = 0
  let meals = 0
  let snacks = 0
  for (const key of keys) {
    const s = computeDayScore(key, days, settings)
    score += s.total
    meals += s.mealsDone
    snacks += days[key]?.snacks ?? 0
  }
  return {
    from,
    daysSoFar: keys.length,
    avgScore: score / keys.length,
    avgMeals: meals / keys.length,
    snacks,
  }
}

/** Daily scores for the `CHART_DAYS` days ending today. */
export function lastDays(
  days: DayMap,
  settings: Settings,
  today: DateKey,
  n = CHART_DAYS,
): ChartDay[] {
  return keysInRange(addDaysKey(today, -(n - 1)), today).map((key) => {
    const s = computeDayScore(key, days, settings)
    return { key, score: s.total, mealsDone: s.mealsDone, full: isFullDay(days[key]) }
  })
}

/**
 * The meal missed on the most days among the `n` days ending **yesterday** — today isn't over,
 * so its untouched meals don't count as missed yet. Days with no document count as missed.
 */
export function mostMissedMeal(days: DayMap, today: DateKey, n = CHART_DAYS): MostMissed | null {
  const keys = keysInRange(addDaysKey(today, -n), addDaysKey(today, -1))
  const counts = MEALS.map((meal) => ({
    meal,
    missed: keys.filter((k) => !days[k]?.meals[meal.key]?.done).length,
  }))
  const max = Math.max(...counts.map((c) => c.missed))
  if (max === 0) return null
  return {
    meals: counts.filter((c) => c.missed === max).map((c) => c.meal),
    missed: max,
    outOf: keys.length,
  }
}

export function computeStats(
  days: DayMap,
  settings: Settings,
  today: DateKey,
  rangeStart: DateKey,
): StatsSummary {
  return {
    currentStreak: displayStreak(days, today, today),
    bestStreak: bestStreak(computeStreaks(days, today)),
    bestStreakWindow: diffDaysKey(rangeStart, today) + 1,
    week: weekStats(days, settings, today),
    last14: lastDays(days, settings, today),
    mostMissed: mostMissedMeal(days, today),
  }
}

import { MEAL_KEYS } from './meals.ts'
import type { DayDoc, Settings } from './types.ts'

export const DEFAULT_TIMEZONE = 'Pacific/Auckland'

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  mealPoints: 10,
  snackPoints: 3,
  snackCap: 3,
  snackCapBonus: 1,
  fullDayBonus: 10,
  streakBonus: 5,
  streakBonusMinDays: 3,
  timezone: DEFAULT_TIMEZONE,
})

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz === '') return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const NUMERIC_KEYS = [
  'mealPoints',
  'snackPoints',
  'snackCap',
  'snackCapBonus',
  'fullDayBonus',
  'streakBonus',
  'streakBonusMinDays',
] as const satisfies readonly (keyof Settings)[]

/**
 * Merges a (possibly partial or malformed) settings object from Firestore over the defaults.
 * Invalid values fall back to the default for that field.
 */
export function resolveSettings(raw?: unknown): Settings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: Settings = { ...DEFAULT_SETTINGS }
  for (const key of NUMERIC_KEYS) {
    const v = src[key]
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[key] = v
  }
  if (isValidTimeZone(src.timezone)) out.timezone = src.timezone
  return out
}

export function emptyDay(): DayDoc {
  const meals = {} as DayDoc['meals']
  for (const key of MEAL_KEYS) meals[key] = { done: false, at: null }
  return { meals, snacks: 0, note: '' }
}

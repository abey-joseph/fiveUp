import type { MealKey } from './meals.ts'

export type { MealKey } from './meals.ts'

/** A calendar date in the tracker timezone, formatted `yyyy-MM-dd`. */
export type DateKey = string

export interface MealEntry {
  done: boolean
  /** When the meal was ticked. `null` when not done, or for done meals with no time (imports). */
  at: Date | null
}

/**
 * One day of raw data (domain shape). The Firestore layer converts `Timestamp` ↔ `Date`, so this
 * module and everything that depends on it (scoring, dates) stays free of Firebase imports.
 */
export interface DayDoc {
  meals: Record<MealKey, MealEntry>
  snacks: number
  note: string
  updatedAt?: Date | null
}

export interface Settings {
  mealPoints: number
  snackPoints: number
  snackCap: number
  fullDayBonus: number
  streakBonus: number
  streakBonusMinDays: number
  /** IANA timezone name that defines the tracker's calendar day, e.g. `Pacific/Auckland`. */
  timezone: string
}

export type Role = 'writer' | 'viewer'

export interface TrackerDoc {
  name: string
  writerEmail: string
  viewerEmails: string[]
  settings: Settings
}

/** Days keyed by DateKey. Missing keys mean "no document" (counts as an empty day). */
export type DayMap = Record<DateKey, DayDoc | undefined>

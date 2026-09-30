/**
 * Conversions and pure updates for day documents. No Firebase imports: Firestore Timestamps are
 * detected structurally (anything with `toDate()`), and Dates are written as-is (Firestore stores
 * them as Timestamps).
 */
import { formatTimeInTz } from './dates.ts'
import { emptyDay } from './defaultSettings.ts'
import { MEAL_KEYS, type MealKey } from './meals.ts'
import type { DayDoc, MealEntry } from './types.ts'

export const MAX_SNACKS = 10
export const NOTE_MAX = 300

function toDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  if (v && typeof v === 'object' && typeof (v as { toDate?: unknown }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate()
  }
  return null
}

/** Parses raw Firestore data into a DayDoc, tolerating missing or malformed fields. */
export function dayFromData(data: unknown): DayDoc {
  const src = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const rawMeals = (src.meals && typeof src.meals === 'object' ? src.meals : {}) as Record<
    string,
    unknown
  >
  const day = emptyDay()
  for (const key of MEAL_KEYS) {
    const m = rawMeals[key] as { done?: unknown; at?: unknown } | undefined
    const done = m?.done === true
    day.meals[key] = { done, at: done ? toDate(m?.at) : null }
  }
  day.snacks =
    typeof src.snacks === 'number' && Number.isFinite(src.snacks)
      ? Math.min(MAX_SNACKS, Math.max(0, Math.floor(src.snacks)))
      : 0
  day.note = typeof src.note === 'string' ? src.note : ''
  day.updatedAt = toDate(src.updatedAt)
  return day
}

/** The fields a client writes (plus `updatedAt: serverTimestamp()`, added by the caller). */
export function dayToData(day: DayDoc) {
  const meals = {} as Record<MealKey, { done: boolean; at: Date | null }>
  for (const key of MEAL_KEYS) {
    const m = day.meals[key]
    meals[key] = { done: m.done, at: m.done ? m.at : null }
  }
  return {
    meals,
    snacks: Math.min(MAX_SNACKS, Math.max(0, Math.floor(day.snacks))),
    note: day.note.slice(0, NOTE_MAX),
  }
}

export function withMeal(day: DayDoc, key: MealKey, entry: MealEntry): DayDoc {
  return { ...day, meals: { ...day.meals, [key]: entry } }
}

/** Ticks (with the current time) or unticks a meal. */
export function toggleMeal(day: DayDoc, key: MealKey, now: Date): DayDoc {
  const done = !day.meals[key].done
  return withMeal(day, key, { done, at: done ? now : null })
}

export function withSnacks(day: DayDoc, snacks: number): DayDoc {
  return { ...day, snacks: Math.min(MAX_SNACKS, Math.max(0, Math.floor(snacks))) }
}

export function withNote(day: DayDoc, note: string): DayDoc {
  return { ...day, note: note.slice(0, NOTE_MAX) }
}

/** Done meals show "✓ 8:42 am" in the tracker timezone, or just "✓" when there's no time. */
export function mealStatus(entry: MealEntry, timezone: string): string {
  if (!entry.done) return ''
  return entry.at ? `✓ ${formatTimeInTz(entry.at, timezone)}` : '✓'
}

import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, emptyDay, resolveSettings } from './defaultSettings.ts'
import { addDaysKey } from './dates.ts'
import { MEAL_KEYS, type MealKey } from './meals.ts'
import {
  bestStreak,
  computeDayBaseScore,
  computeDayScore,
  computeStreaks,
  isFullDay,
  isStreakTruncated,
  maxDailyScore,
  mealsDone,
  streakAt,
} from './scoring.ts'
import type { DayDoc, DayMap, Settings } from './types.ts'

const S: Settings = { ...DEFAULT_SETTINGS }

function day(meals: MealKey[] | 'all' = [], snacks = 0): DayDoc {
  const d = emptyDay()
  const keys = meals === 'all' ? MEAL_KEYS : meals
  for (const k of keys) d.meals[k] = { done: true, at: null }
  d.snacks = snacks
  return d
}

const full = () => day('all')
const partial = () => day(['breakfast', 'lunch'])

/** Builds a DayMap from consecutive days starting at `start`; `null` = no document. */
function run(start: string, days: (DayDoc | null)[]): DayMap {
  const map: DayMap = {}
  days.forEach((d, i) => {
    if (d) map[addDaysKey(start, i)] = d
  })
  return map
}

describe('base score', () => {
  it('empty day = 0', () => {
    expect(computeDayBaseScore(emptyDay(), S)).toBe(0)
    expect(computeDayBaseScore(undefined, S)).toBe(0)
  })

  it('each meal is worth mealPoints', () => {
    expect(computeDayBaseScore(day(['breakfast']), S)).toBe(10)
    expect(computeDayBaseScore(day(['breakfast', 'dinner', 'lunch']), S)).toBe(30)
  })

  it('all meals = 50 + 10 full-day bonus', () => {
    expect(computeDayBaseScore(full(), S)).toBe(60)
    expect(isFullDay(full())).toBe(true)
    expect(isFullDay(day(['breakfast', 'brunch', 'lunch', 'evening']))).toBe(false)
  })

  it.each([
    [0, 0],
    [1, 3],
    [2, 6],
    [3, 9],
    [5, 9],
    [10, 9],
  ])('snack cap: %i snacks → %i pts', (snacks, pts) => {
    expect(computeDayBaseScore(day([], snacks), S)).toBe(pts)
  })

  it('done meals with at: null (imported) still score', () => {
    const d = emptyDay()
    d.meals.brunch = { done: true, at: null }
    expect(mealsDone(d)).toBe(1)
    expect(computeDayBaseScore(d, S)).toBe(10)
  })

  it('point values come from settings, not constants', () => {
    const custom: Settings = { ...S, mealPoints: 5, snackPoints: 1, snackCap: 5, fullDayBonus: 20 }
    expect(computeDayBaseScore(day('all', 7), custom)).toBe(25 + 5 + 20)
  })
})

describe('streaks', () => {
  it('streak of 1/2/3/4 on consecutive full days', () => {
    const days = run('2026-09-18', [full(), full(), full(), full()])
    expect(streakAt(days, '2026-09-18')).toBe(1)
    expect(streakAt(days, '2026-09-19')).toBe(2)
    expect(streakAt(days, '2026-09-20')).toBe(3)
    expect(streakAt(days, '2026-09-21')).toBe(4)
    expect(computeStreaks(days, '2026-09-21')).toEqual({
      '2026-09-18': 1,
      '2026-09-19': 2,
      '2026-09-20': 3,
      '2026-09-21': 4,
    })
  })

  it('a non-full day has streak 0 and breaks the streak', () => {
    const days = run('2026-09-18', [full(), full(), partial(), full(), full()])
    expect(computeStreaks(days, '2026-09-22')).toEqual({
      '2026-09-18': 1,
      '2026-09-19': 2,
      '2026-09-20': 0,
      '2026-09-21': 1,
      '2026-09-22': 2,
    })
  })

  it('missing days (no document) count as non-full', () => {
    const days = run('2026-09-18', [full(), full(), null, full()])
    expect(streakAt(days, '2026-09-21')).toBe(1)
    expect(computeStreaks(days, '2026-09-21')['2026-09-20']).toBe(0)
    // Days after the last document up to `upTo` are included with streak 0.
    expect(computeStreaks(days, '2026-09-23')['2026-09-23']).toBe(0)
  })

  it('streaks run across the NZ DST start (2026-09-27)', () => {
    const days = run('2026-09-25', [full(), full(), full(), full()])
    expect(streakAt(days, '2026-09-28')).toBe(4)
  })

  it('computeStreaks ignores days after upTo and returns {} with no data', () => {
    const days = run('2026-09-18', [full(), full(), full()])
    expect(Object.keys(computeStreaks(days, '2026-09-19'))).toEqual(['2026-09-18', '2026-09-19'])
    expect(computeStreaks({}, '2026-09-19')).toEqual({})
  })

  it('bestStreak', () => {
    const days = run('2026-09-18', [full(), full(), full(), partial(), full()])
    expect(bestStreak(computeStreaks(days, '2026-09-22'))).toBe(3)
  })

  it('isStreakTruncated when the loaded range starts on a full day', () => {
    const days = run('2026-09-18', [full(), full(), partial()])
    expect(isStreakTruncated(days, '2026-09-18')).toBe(true)
    expect(isStreakTruncated(days, '2026-09-17')).toBe(false)
    expect(isStreakTruncated(days, '2026-09-20')).toBe(false)
  })
})

describe('computeDayScore', () => {
  it('no streak bonus below 3 days', () => {
    const days = run('2026-09-18', [full(), full()])
    expect(computeDayScore('2026-09-18', days, S)).toMatchObject({
      base: 60,
      streakBonus: 0,
      total: 60,
      streak: 1,
    })
    expect(computeDayScore('2026-09-19', days, S)).toMatchObject({ total: 60, streak: 2 })
  })

  it('streak bonus +5 on a full day with streak ≥ 3', () => {
    const days = run('2026-09-18', [full(), full(), full(), day('all', 2)])
    expect(computeDayScore('2026-09-20', days, S)).toMatchObject({
      base: 60,
      streakBonus: 5,
      total: 65,
      streak: 3,
    })
    expect(computeDayScore('2026-09-21', days, S)).toMatchObject({
      base: 66,
      streakBonus: 5,
      total: 71,
      streak: 4,
    })
  })

  it('no streak bonus on a non-full day after a streak', () => {
    const days = run('2026-09-18', [full(), full(), full(), day(['lunch'], 1)])
    expect(computeDayScore('2026-09-21', days, S)).toMatchObject({
      base: 13,
      streakBonus: 0,
      total: 13,
      streak: 0,
    })
  })

  it('breakdown parts add up', () => {
    const days = run('2026-09-18', [full(), full(), day('all', 5)])
    const s = computeDayScore('2026-09-20', days, S)
    expect(s).toMatchObject({ mealPoints: 50, snackPoints: 9, fullDayBonus: 10, mealsDone: 5 })
    expect(s.mealPoints + s.snackPoints + s.fullDayBonus + s.streakBonus).toBe(s.total)
  })

  it('missing day scores 0', () => {
    expect(computeDayScore('2026-09-18', {}, S)).toMatchObject({ total: 0, streak: 0 })
  })

  it('max score = 74 and is reachable', () => {
    // Spec §3: 50 (meals) + 9 (snacks) + 10 (full-day) + 5 (streak)
    expect(maxDailyScore(S)).toBe(74)
    const days = run('2026-09-18', [full(), full(), day('all', 10)])
    expect(computeDayScore('2026-09-20', days, S).total).toBe(maxDailyScore(S))
  })

  it('streakBonusMinDays comes from settings', () => {
    const days = run('2026-09-18', [full(), full()])
    const s = { ...S, streakBonusMinDays: 2, streakBonus: 7 }
    expect(computeDayScore('2026-09-19', days, s).streakBonus).toBe(7)
  })
})

describe('resolveSettings', () => {
  it('falls back to defaults when missing', () => {
    expect(resolveSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(resolveSettings({})).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS.timezone).toBe('Pacific/Auckland')
  })

  it('merges valid values and rejects invalid ones', () => {
    const s = resolveSettings({
      mealPoints: 20,
      snackCap: -1,
      snackPoints: 'x',
      timezone: 'Asia/Singapore',
    })
    expect(s.mealPoints).toBe(20)
    expect(s.snackCap).toBe(3)
    expect(s.snackPoints).toBe(3)
    expect(s.timezone).toBe('Asia/Singapore')
    expect(resolveSettings({ timezone: 'Mars/Olympus' }).timezone).toBe('Pacific/Auckland')
  })
})

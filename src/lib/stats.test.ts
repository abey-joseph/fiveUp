import { describe, expect, it } from 'vitest'
import { addDaysKey } from './dates.ts'
import { DEFAULT_SETTINGS, emptyDay } from './defaultSettings.ts'
import { MEAL_KEYS, type MealKey } from './meals.ts'
import { computeStats, lastDays, mostMissedMeal, weekStats } from './stats.ts'
import type { DayDoc, DayMap, Settings } from './types.ts'

const S: Settings = { ...DEFAULT_SETTINGS }
// Thursday 1 Oct 2026 (tracker timezone); its week starts Monday 28 Sep.
const TODAY = '2026-10-01'

function day(meals: MealKey[] | 'all', snacks = 0): DayDoc {
  const d = emptyDay()
  for (const k of meals === 'all' ? MEAL_KEYS : meals) d.meals[k] = { done: true, at: null }
  d.snacks = snacks
  return d
}

describe('weekStats', () => {
  it('averages Monday…today only and counts every snack', () => {
    const days: DayMap = {
      '2026-09-27': day('all', 3), // Sunday: previous week
      '2026-09-28': day('all', 1), // streak 2 → 63
      '2026-09-29': day(['breakfast', 'lunch'], 5), // 20 + 9 (cap) + 1 (snack bonus) = 30
      // 30 Sep: no document → 0
      '2026-10-01': day(['dinner']), // 10
      '2026-10-02': day('all', 4), // future: ignored
    }
    const w = weekStats(days, S, TODAY)
    expect(w.from).toBe('2026-09-28')
    expect(w.daysSoFar).toBe(4)
    expect(w.avgScore).toBeCloseTo((63 + 30 + 0 + 10) / 4)
    expect(w.avgMeals).toBeCloseTo((5 + 2 + 0 + 1) / 4)
    expect(w.snacks).toBe(6)
  })

  it('on a Monday covers just that day', () => {
    const w = weekStats({ '2026-10-05': day('all') }, S, '2026-10-05')
    expect(w).toMatchObject({ from: '2026-10-05', daysSoFar: 1, avgScore: 60, avgMeals: 5 })
  })
})

describe('lastDays', () => {
  it('returns 14 days ending today with scores incl. streak bonus', () => {
    const days: DayMap = {}
    for (let i = 1; i <= 3; i++) days[addDaysKey(TODAY, -i)] = day('all')
    const out = lastDays(days, S, TODAY)
    expect(out).toHaveLength(14)
    expect(out[0]!.key).toBe('2026-09-18')
    expect(out[13]).toEqual({ key: TODAY, score: 0, mealsDone: 0, full: false })
    expect(out.slice(10, 13).map((d) => d.score)).toEqual([60, 60, 65])
    expect(out[12]!.full).toBe(true)
  })
})

describe('mostMissedMeal', () => {
  it('counts the 14 days before today; missing days count as missed', () => {
    const days: DayMap = {}
    for (let i = 1; i <= 10; i++) {
      days[addDaysKey(TODAY, -i)] =
        i <= 5 ? day(['breakfast', 'lunch', 'evening', 'dinner']) : day('all')
    }
    days[TODAY] = day([]) // today's gaps are not "missed" yet
    // Brunch: 5 skipped + 4 days without a document = 9; others: 4.
    expect(mostMissedMeal(days, TODAY)).toEqual({
      meals: [expect.objectContaining({ key: 'brunch' })],
      missed: 9,
      outOf: 14,
    })
  })

  it('reports ties and returns null when nothing was missed', () => {
    const tied: DayMap = {}
    const all: DayMap = {}
    for (let i = 1; i <= 14; i++) {
      tied[addDaysKey(TODAY, -i)] = i === 1 ? day(['breakfast', 'lunch', 'dinner']) : day('all')
      all[addDaysKey(TODAY, -i)] = day('all')
    }
    expect(mostMissedMeal(tied, TODAY)?.meals.map((m) => m.key)).toEqual(['brunch', 'evening'])
    expect(mostMissedMeal(tied, TODAY)?.missed).toBe(1)
    expect(mostMissedMeal(all, TODAY)).toBeNull()
  })
})

describe('computeStats', () => {
  it('current streak stays alive (pending) until today is finished; best streak is the longest', () => {
    const days: DayMap = {}
    // 4 full days ending 20 Sep, a gap, then 2 full days ending yesterday.
    for (let k = '2026-09-17'; k <= '2026-09-20'; k = addDaysKey(k, 1)) days[k] = day('all')
    days['2026-09-29'] = day('all')
    days['2026-09-30'] = day('all')
    const s = computeStats(days, S, TODAY, '2026-08-03')
    expect(s.currentStreak).toEqual({ days: 2, pending: true })
    expect(s.bestStreak).toBe(4)
    expect(s.bestStreakWindow).toBe(60)

    days[TODAY] = day('all')
    expect(computeStats(days, S, TODAY, '2026-08-03').currentStreak).toEqual({
      days: 3,
      pending: false,
    })
  })

  it('handles no data at all', () => {
    const s = computeStats({}, S, TODAY, '2026-08-03')
    expect(s.currentStreak).toEqual({ days: 0, pending: false })
    expect(s.bestStreak).toBe(0)
    expect(s.week.avgScore).toBe(0)
    expect(s.mostMissed?.missed).toBe(14)
    expect(s.mostMissed?.meals).toHaveLength(5)
  })
})

import { describe, expect, it } from 'vitest'
import { addDaysKey } from './dates.ts'
import { DEFAULT_SETTINGS, emptyDay } from './defaultSettings.ts'
import { dayLevel, monthParam, resolveMonthParam, shiftMonth, summarizeMonth } from './history.ts'
import { MEAL_KEYS } from './meals.ts'
import type { DayDoc, DayMap, Settings } from './types.ts'

const S: Settings = { ...DEFAULT_SETTINGS }

function day(n: number, snacks = 0): DayDoc {
  const d = emptyDay()
  for (const k of MEAL_KEYS.slice(0, n)) d.meals[k] = { done: true, at: null }
  d.snacks = snacks
  return d
}

describe('dayLevel', () => {
  it.each([
    [0, 'none'],
    [1, 'some'],
    [2, 'some'],
    [3, 'most'],
    [4, 'most'],
    [5, 'full'],
  ] as const)('%i meals → %s', (n, level) => {
    expect(dayLevel(n)).toBe(level)
  })
})

describe('summarizeMonth', () => {
  it('starts weeks on Monday', () => {
    // 1 Sep 2026 is a Tuesday, 1 Oct 2026 a Thursday, 1 Feb 2027 a Monday.
    expect(summarizeMonth('2026-09-01', {}, S, '2026-10-01').leadingBlanks).toBe(1)
    expect(summarizeMonth('2026-10-15', {}, S, '2026-10-20').leadingBlanks).toBe(3)
    expect(summarizeMonth('2027-02-01', {}, S, '2027-02-10').leadingBlanks).toBe(0)
  })

  it('has one cell per calendar day', () => {
    const sep = summarizeMonth('2026-09-01', {}, S, '2026-10-01')
    expect(sep.month).toBe('2026-09-01')
    expect(sep.cells).toHaveLength(30)
    expect(sep.cells[0]).toMatchObject({ key: '2026-09-01', dayOfMonth: 1 })
    expect(sep.cells[29]).toMatchObject({ key: '2026-09-30', dayOfMonth: 30 })
    expect(summarizeMonth('2028-02-01', {}, S, '2028-03-01').cells).toHaveLength(29)
  })

  it('colours days by meals done; missing days are none', () => {
    const days: DayMap = {
      '2026-09-01': day(5),
      '2026-09-02': day(4),
      '2026-09-03': day(3),
      '2026-09-04': day(2),
      '2026-09-05': day(1),
      '2026-09-06': day(0),
    }
    const levels = summarizeMonth('2026-09-01', days, S, '2026-10-01')
      .cells.slice(0, 7)
      .map((c) => c.level)
    expect(levels).toEqual(['full', 'most', 'most', 'some', 'some', 'none', 'none'])
  })

  it('future days are blank and excluded from totals', () => {
    const days: DayMap = { '2026-10-01': day(5), '2026-10-02': day(5) }
    const oct = summarizeMonth('2026-10-01', days, S, '2026-10-01')
    expect(oct.cells[0]).toMatchObject({ level: 'full', isToday: true, score: 60 })
    expect(oct.cells[1]).toMatchObject({ level: 'future', score: 0, mealsDone: 0 })
    expect(oct.cells.slice(1).every((c) => c.level === 'future')).toBe(true)
    expect(oct.fullDays).toBe(1)
    expect(oct.totalScore).toBe(60)
  })

  it('totals include snacks and streak bonuses, counting streaks from the previous month', () => {
    // Full days 28 Sep → 2 Oct: streaks 1,2,3 in Sep, then 4,5 in Oct (both get +5).
    const days: DayMap = {}
    for (let k = '2026-09-28'; k <= '2026-10-02'; k = addDaysKey(k, 1)) days[k] = day(5)
    days['2026-10-03'] = day(2, 5) // 20 meals + 9 snacks (capped)
    const oct = summarizeMonth('2026-10-01', days, S, '2026-10-10')
    expect(oct.cells[0]!.score).toBe(65)
    expect(oct.cells[1]!.score).toBe(65)
    expect(oct.cells[2]).toMatchObject({ level: 'some', score: 29 })
    expect(oct.totalScore).toBe(65 + 65 + 29)
    expect(oct.fullDays).toBe(2)

    const sep = summarizeMonth('2026-09-01', days, S, '2026-10-10')
    expect(sep.totalScore).toBe(60 + 60 + 65)
    expect(sep.fullDays).toBe(3)
  })
})

describe('month param', () => {
  const today = '2026-10-01'

  it('formats as yyyy-MM', () => {
    expect(monthParam('2026-09-17')).toBe('2026-09')
  })

  it('defaults to the current month', () => {
    expect(resolveMonthParam(null, today)).toBe('2026-10-01')
    expect(resolveMonthParam('', today)).toBe('2026-10-01')
  })

  it('accepts past months', () => {
    expect(resolveMonthParam('2026-09', today)).toBe('2026-09-01')
    expect(resolveMonthParam('2025-12', today)).toBe('2025-12-01')
  })

  it('rejects invalid and future months', () => {
    expect(resolveMonthParam('2026-13', today)).toBe('2026-10-01')
    expect(resolveMonthParam('2026-9', today)).toBe('2026-10-01')
    expect(resolveMonthParam('2026-09-01', today)).toBe('2026-10-01')
    expect(resolveMonthParam('2026-11', today)).toBe('2026-10-01')
  })

  it('shiftMonth moves by months and never past the current month', () => {
    expect(shiftMonth('2026-10-01', -1, today)).toBe('2026-09-01')
    expect(shiftMonth('2026-01-01', -1, today)).toBe('2025-12-01')
    expect(shiftMonth('2026-09-01', 1, today)).toBe('2026-10-01')
    expect(shiftMonth('2026-10-01', 1, today)).toBe('2026-10-01')
  })
})

import { describe, expect, it } from 'vitest'
import { emptyDay } from './defaultSettings.ts'
import {
  dayFromData,
  dayToData,
  mealStatus,
  toggleMeal,
  withMeal,
  withNote,
  withSnacks,
} from './dayDoc.ts'
import { displayStreak } from './scoring.ts'
import type { DayDoc, DayMap } from './types.ts'

const fakeTimestamp = (iso: string) => ({ toDate: () => new Date(iso) })

describe('dayFromData', () => {
  it('converts Timestamps and keeps done meals without a time', () => {
    const day = dayFromData({
      meals: {
        breakfast: { done: true, at: fakeTimestamp('2026-09-30T19:42:00Z') },
        brunch: { done: true, at: null },
        lunch: { done: false, at: null },
      },
      snacks: 2,
      note: 'hi',
    })
    expect(day.meals.breakfast).toEqual({ done: true, at: new Date('2026-09-30T19:42:00Z') })
    expect(day.meals.brunch).toEqual({ done: true, at: null })
    expect(day.meals.lunch).toEqual({ done: false, at: null })
    expect(day.meals.dinner).toEqual({ done: false, at: null }) // missing → not done
    expect(day.snacks).toBe(2)
    expect(day.note).toBe('hi')
  })

  it('tolerates junk', () => {
    const day = dayFromData({ meals: { lunch: { done: 'yes' } }, snacks: 99, note: 3 })
    expect(day.meals.lunch.done).toBe(false)
    expect(day.snacks).toBe(10)
    expect(day.note).toBe('')
    expect(dayFromData(undefined)).toMatchObject(emptyDay())
  })
})

describe('updates', () => {
  const now = new Date('2026-10-01T00:00:00Z')

  it('toggleMeal sets the time when ticking and clears it when unticking', () => {
    const ticked = toggleMeal(emptyDay(), 'lunch', now)
    expect(ticked.meals.lunch).toEqual({ done: true, at: now })
    expect(toggleMeal(ticked, 'lunch', now).meals.lunch).toEqual({ done: false, at: null })
  })

  it('does not mutate the input', () => {
    const d = emptyDay()
    toggleMeal(d, 'lunch', now)
    withSnacks(d, 3)
    expect(d).toEqual(emptyDay())
  })

  it('clamps snacks and note', () => {
    expect(withSnacks(emptyDay(), 11).snacks).toBe(10)
    expect(withSnacks(emptyDay(), -1).snacks).toBe(0)
    expect(withNote(emptyDay(), 'x'.repeat(400)).note).toHaveLength(300)
  })

  it('dayToData writes exactly meals/snacks/note with at: null for undone meals', () => {
    const d = withMeal(emptyDay(), 'dinner', { done: false, at: now })
    const data = dayToData(d)
    expect(Object.keys(data).sort()).toEqual(['meals', 'note', 'snacks'])
    expect(data.meals.dinner).toEqual({ done: false, at: null })
    expect(Object.keys(data.meals)).toEqual(['breakfast', 'brunch', 'lunch', 'evening', 'dinner'])
  })
})

describe('displayStreak', () => {
  const full = (): DayDoc => {
    let d = emptyDay()
    for (const k of ['breakfast', 'brunch', 'lunch', 'evening', 'dinner'] as const) {
      d = withMeal(d, k, { done: true, at: null })
    }
    return d
  }
  const days: DayMap = { '2026-09-28': full(), '2026-09-29': full(), '2026-09-30': full() }

  it('keeps a live streak visible while today is in progress', () => {
    expect(displayStreak(days, '2026-10-01', '2026-10-01')).toEqual({ days: 3, pending: true })
  })

  it('shows the own streak once today is full', () => {
    const d = { ...days, '2026-10-01': full() }
    expect(displayStreak(d, '2026-10-01', '2026-10-01')).toEqual({ days: 4, pending: false })
  })

  it('past days show their own streak only', () => {
    expect(displayStreak(days, '2026-09-29', '2026-10-01')).toEqual({ days: 2, pending: false })
    expect(displayStreak(days, '2026-09-27', '2026-10-01')).toEqual({ days: 0, pending: false })
  })
})

describe('mealStatus', () => {
  it('shows the time in the tracker timezone, or just ✓ when at is null', () => {
    const at = new Date('2026-09-30T19:42:00Z')
    expect(mealStatus({ done: true, at }, 'Pacific/Auckland')).toBe('✓ 8:42 am')
    expect(mealStatus({ done: true, at }, 'Asia/Singapore')).toBe('✓ 3:42 am')
    expect(mealStatus({ done: true, at: null }, 'Pacific/Auckland')).toBe('✓')
    expect(mealStatus({ done: false, at: null }, 'Pacific/Auckland')).toBe('')
  })
})

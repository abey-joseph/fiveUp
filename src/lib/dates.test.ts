import { afterEach, describe, expect, it } from 'vitest'
import {
  addDaysKey,
  addMonthsKey,
  diffDaysKey,
  endOfMonthKey,
  endOfWeekKey,
  formatDateTimeInTz,
  formatKey,
  formatTimeInTz,
  isFutureKey,
  isValidDateKey,
  keysInRange,
  parseKey,
  startOfDayInstant,
  startOfMonthKey,
  startOfWeekKey,
  toDateKey,
  todayKey,
  tzShortLabel,
  weekdayIndex,
} from './dates.ts'

const NZ = 'Pacific/Auckland'
const SG = 'Asia/Singapore'
const HOUR = 3_600_000

describe('toDateKey / todayKey (tracker timezone)', () => {
  it('device in Singapore at 2026-10-01 23:30 +08:00 → NZ key is 2026-10-02', () => {
    const now = new Date('2026-10-01T23:30:00+08:00')
    expect(todayKey(NZ, now)).toBe('2026-10-02')
    expect(toDateKey(now, NZ)).toBe('2026-10-02')
    expect(todayKey(SG, now)).toBe('2026-10-01')
  })

  it('changing the timezone parameter changes the result', () => {
    const instant = new Date('2026-10-01T13:00:00Z') // 02:00 NZDT Oct 2, 21:00 SGT Oct 1
    expect(toDateKey(instant, NZ)).toBe('2026-10-02')
    expect(toDateKey(instant, SG)).toBe('2026-10-01')
    expect(toDateKey(instant, 'America/Los_Angeles')).toBe('2026-10-01')
  })

  it('handles NZ standard time (UTC+12) outside DST', () => {
    // 2026-07-01 11:59 UTC = 23:59 NZST, 12:00 UTC = 00:00 NZST next day
    expect(toDateKey(new Date('2026-07-01T11:59:00Z'), NZ)).toBe('2026-07-01')
    expect(toDateKey(new Date('2026-07-01T12:00:00Z'), NZ)).toBe('2026-07-02')
  })

  it('handles NZ daylight time (UTC+13) during DST', () => {
    // 2026-12-01 10:59 UTC = 23:59 NZDT, 11:00 UTC = 00:00 NZDT next day
    expect(toDateKey(new Date('2026-12-01T10:59:00Z'), NZ)).toBe('2026-12-01')
    expect(toDateKey(new Date('2026-12-01T11:00:00Z'), NZ)).toBe('2026-12-02')
  })
})

describe('results do not depend on the device timezone', () => {
  const original = process.env.TZ
  afterEach(() => {
    process.env.TZ = original
  })

  it.each(['Asia/Singapore', 'Pacific/Auckland', 'UTC', 'America/New_York', 'Pacific/Honolulu'])(
    'device TZ %s',
    (deviceTz) => {
      process.env.TZ = deviceTz
      const now = new Date('2026-10-01T23:30:00+08:00')
      expect(todayKey(NZ, now)).toBe('2026-10-02')
      expect(formatKey('2026-10-01', 'EEE, d MMM')).toBe('Thu, 1 Oct')
      expect(formatTimeInTz(new Date('2026-09-30T19:42:00Z'), NZ)).toBe('8:42 am')
      expect(startOfWeekKey('2026-10-04')).toBe('2026-09-28')
      expect(addDaysKey('2026-09-27', 1)).toBe('2026-09-28')
    },
  )
})

describe.each([
  { name: 'DST start', day: '2026-09-27', before: '2026-09-26', after: '2026-09-28', hours: 23 },
  { name: 'DST end', day: '2027-04-04', before: '2027-04-03', after: '2027-04-05', hours: 25 },
])('NZ $name ($day)', ({ day, before, after, hours }) => {
  it('addDaysKey steps exactly one calendar day across the transition', () => {
    expect(addDaysKey(before, 1)).toBe(day)
    expect(addDaysKey(day, 1)).toBe(after)
    expect(addDaysKey(after, -1)).toBe(day)
    expect(addDaysKey(day, -1)).toBe(before)
    expect(diffDaysKey(before, after)).toBe(2)
  })

  it(`the day is ${hours}h long and every instant in it maps to a single key`, () => {
    const start = startOfDayInstant(day, NZ)
    const end = startOfDayInstant(after, NZ)
    expect(end.getTime() - start.getTime()).toBe(hours * HOUR)

    const keys = new Set<string>()
    for (let t = start.getTime(); t < end.getTime(); t += 15 * 60_000) {
      keys.add(toDateKey(new Date(t), NZ))
    }
    expect([...keys]).toEqual([day])
    expect(toDateKey(new Date(start.getTime() - 1), NZ)).toBe(before)
    expect(toDateKey(end, NZ)).toBe(after)
  })
})

describe('week boundaries (Monday start) in NZ time', () => {
  it('startOfWeekKey / endOfWeekKey', () => {
    expect(startOfWeekKey('2026-10-01')).toBe('2026-09-28') // Thu → Mon
    expect(startOfWeekKey('2026-09-28')).toBe('2026-09-28') // Mon → itself
    expect(startOfWeekKey('2026-10-04')).toBe('2026-09-28') // Sun → previous Mon
    expect(endOfWeekKey('2026-09-28')).toBe('2026-10-04')
    expect(startOfWeekKey('2027-01-01')).toBe('2026-12-28') // across a year boundary
    expect(weekdayIndex('2026-09-28')).toBe(0)
    expect(weekdayIndex('2026-10-04')).toBe(6)
  })

  it("uses the NZ calendar: Sunday night in Singapore is already Monday's week in NZ", () => {
    // Sun 2026-10-04 21:30 SGT = Mon 2026-10-05 02:30 NZDT
    const now = new Date('2026-10-04T21:30:00+08:00')
    expect(startOfWeekKey(todayKey(NZ, now))).toBe('2026-10-05')
    expect(startOfWeekKey(todayKey(SG, now))).toBe('2026-09-28')
  })
})

describe('month boundaries in NZ time', () => {
  it('start/end of month, including leap years', () => {
    expect(startOfMonthKey('2026-09-18')).toBe('2026-09-01')
    expect(endOfMonthKey('2026-09-18')).toBe('2026-09-30')
    expect(endOfMonthKey('2027-02-10')).toBe('2027-02-28')
    expect(endOfMonthKey('2028-02-10')).toBe('2028-02-29')
    expect(endOfMonthKey('2026-12-05')).toBe('2026-12-31')
  })

  it('addMonthsKey returns the first of the target month', () => {
    expect(addMonthsKey('2026-10-31', 1)).toBe('2026-11-01')
    expect(addMonthsKey('2026-01-31', -1)).toBe('2025-12-01')
    expect(addMonthsKey('2026-12-15', 1)).toBe('2027-01-01')
  })

  it('late on 30 Sep in Singapore is already October in NZ', () => {
    const now = new Date('2026-09-30T22:00:00+08:00') // 03:00 NZDT 1 Oct
    expect(startOfMonthKey(todayKey(NZ, now))).toBe('2026-10-01')
    expect(startOfMonthKey(todayKey(SG, now))).toBe('2026-09-01')
  })
})

describe('isFutureKey', () => {
  const now = new Date('2026-10-01T23:30:00+08:00') // SG: Thu 1 Oct 23:30, NZ: Fri 2 Oct 04:30

  it('a day that is today in NZ but tomorrow in Singapore is not future', () => {
    expect(isFutureKey('2026-10-02', NZ, now)).toBe(false)
  })

  it('the day after NZ today is future, even though it is only "tomorrow+1" in Singapore', () => {
    expect(isFutureKey('2026-10-03', NZ, now)).toBe(true)
  })

  it('a day that is today in Singapore is a past day in NZ (editable)', () => {
    expect(isFutureKey('2026-10-01', NZ, now)).toBe(false)
  })

  it('reverse case: with a Singapore tracker timezone, NZ today is in the future', () => {
    expect(isFutureKey('2026-10-02', SG, now)).toBe(true)
    expect(isFutureKey('2026-10-01', SG, now)).toBe(false)
  })
})

describe('key validation and helpers', () => {
  it('isValidDateKey', () => {
    expect(isValidDateKey('2026-09-18')).toBe(true)
    expect(isValidDateKey('2026-02-29')).toBe(false)
    expect(isValidDateKey('2028-02-29')).toBe(true)
    expect(isValidDateKey('2026-13-01')).toBe(false)
    expect(isValidDateKey('2026-9-18')).toBe(false)
    expect(isValidDateKey('18/09/2026')).toBe(false)
    expect(isValidDateKey(20260918)).toBe(false)
  })

  it('parseKey throws on invalid keys', () => {
    expect(parseKey('2026-09-18')).toEqual({ year: 2026, month: 9, day: 18 })
    expect(() => parseKey('2026-04-31')).toThrow()
  })

  it('keysInRange is inclusive and crosses DST safely', () => {
    expect(keysInRange('2026-09-26', '2026-09-28')).toEqual([
      '2026-09-26',
      '2026-09-27',
      '2026-09-28',
    ])
    expect(keysInRange('2026-09-28', '2026-09-26')).toEqual([])
  })

  it('diffDaysKey', () => {
    expect(diffDaysKey('2026-09-18', '2026-09-30')).toBe(12)
    expect(diffDaysKey('2026-09-30', '2026-09-18')).toBe(-12)
    expect(diffDaysKey('2027-04-01', '2027-04-10')).toBe(9)
  })
})

describe('formatting in the tracker timezone', () => {
  it('formatKey', () => {
    expect(formatKey('2026-10-01', 'EEE, d MMM')).toBe('Thu, 1 Oct')
    expect(formatKey('2026-09-27', 'MMMM yyyy')).toBe('September 2026')
  })

  it('meal times show in tracker time for both users', () => {
    const at = new Date('2026-09-30T19:42:00Z') // 08:42 NZDT, 03:42 SGT
    expect(formatTimeInTz(at, NZ)).toBe('8:42 am')
    expect(formatTimeInTz(at, SG)).toBe('3:42 am')
  })

  it('"Her time" line', () => {
    const now = new Date('2026-09-30T12:42:00Z') // 01:42 NZDT 1 Oct
    expect(`Her time: ${formatDateTimeInTz(now, NZ)} (${tzShortLabel(NZ)})`).toBe(
      'Her time: Thu 1 Oct, 1:42 am (NZ)',
    )
  })

  it('tzShortLabel falls back to the city name', () => {
    expect(tzShortLabel('America/Los_Angeles')).toBe('Los Angeles')
  })
})

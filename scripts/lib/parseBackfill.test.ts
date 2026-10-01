import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { DEFAULT_SETTINGS } from '../../src/lib/defaultSettings.ts'
import { MEAL_KEYS } from '../../src/lib/meals.ts'
import { computeDayScore } from '../../src/lib/scoring.ts'
import type { DayMap } from '../../src/lib/types.ts'
import { parseBackfill, parseCsv, rowToData, rowToDay } from './parseBackfill.ts'

const TODAY = '2026-10-01'
const HEADER = 'date,breakfast,brunch,lunch,evening,dinner,snacks,note'
const csv = (...lines: string[]) => [HEADER, ...lines].join('\n')

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, commas, CRLF, a BOM and blank lines', () => {
    const text = '﻿a,b,c\r\n1,"x, y","say ""hi"""\r\n\r\n2,,"multi\nline"\n'
    expect(parseCsv(text)).toEqual([
      { line: 1, fields: ['a', 'b', 'c'] },
      { line: 2, fields: ['1', 'x, y', 'say "hi"'] },
      { line: 4, fields: ['2', '', 'multi\nline'] },
    ])
  })

  it('rejects an unclosed quote', () => {
    expect(() => parseCsv('a,b\n1,"oops\n')).toThrow(/Unclosed quote.*line 2/)
  })
})

describe('parseBackfill', () => {
  it('parses the committed template', () => {
    const text = readFileSync(new URL('../../data/backfill-template.csv', import.meta.url), 'utf8')
    const { rows, errors } = parseBackfill(text, TODAY)
    expect(errors).toEqual([])
    expect(rows.length).toBeGreaterThan(0)
  })

  it('accepts every documented meal spelling, blank snacks and quoted notes', () => {
    const { rows, errors } = parseBackfill(
      csv('2026-09-18,1,0,y,n,yes,2,', '2026-09-19,no,true,FALSE,Y,,,"skipped lunch, busy day"'),
      TODAY,
    )
    expect(errors).toEqual([])
    expect(rows[0]).toEqual({
      line: 2,
      date: '2026-09-18',
      meals: { breakfast: true, brunch: false, lunch: true, evening: false, dinner: true },
      snacks: 2,
      note: '',
    })
    expect(rows[1]).toMatchObject({
      meals: { breakfast: false, brunch: true, lunch: false, evening: true, dinner: false },
      snacks: 0,
      note: 'skipped lunch, busy day',
    })
  })

  it('works without the optional snacks and note columns, in any column order', () => {
    const { rows, errors } = parseBackfill(
      'dinner,date,lunch,evening,brunch,breakfast\n1,2026-09-18,1,1,1,1\n',
      TODAY,
    )
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({ date: '2026-09-18', snacks: 0, note: '' })
    expect(Object.values(rows[0]!.meals).every(Boolean)).toBe(true)
  })

  it('sorts rows by date', () => {
    const { rows } = parseBackfill(csv('2026-09-20,1,1,1,1,1,0,', '2026-09-18,1,1,1,1,1,0,'), TODAY)
    expect(rows.map((r) => r.date)).toEqual(['2026-09-18', '2026-09-20'])
  })

  it('collects every row error with line numbers (and keeps no rows from bad lines)', () => {
    const { rows, errors } = parseBackfill(
      csv(
        '2026-9-18,1,1,1,1,1,0,', // bad format
        '2026-02-30,1,1,1,1,1,0,', // impossible date
        '2026-09-20,1,1,1,1,1,0,',
        '2026-09-20,1,1,1,1,1,0,', // duplicate
        '2026-10-02,1,1,1,1,1,0,', // future
        '2026-09-21,2,1,1,1,1,0,', // bad meal value
        '2026-09-22,1,1,1,1,1,11,', // snacks out of range
        '2026-09-23,1,1,1,1,1,-1,', // negative snacks
        '2026-09-24,1,1,1,1,1,1.5,', // not an integer
        `2026-09-25,1,1,1,1,1,0,${'x'.repeat(301)}`, // note too long
        '2026-09-26,1,1,1,1,1,0', // too few values
      ),
      TODAY,
    )
    expect(errors).toEqual([
      'Line 2: date "2026-9-18" is not a valid yyyy-MM-dd date',
      'Line 3: date "2026-02-30" is not a valid yyyy-MM-dd date',
      'Line 5: date 2026-09-20 is a duplicate of line 4',
      'Line 6: date 2026-10-02 is in the future (today is 2026-10-01 in the tracker timezone)',
      'Line 7: breakfast "2" must be 1/0, y/n, yes/no, true/false or blank',
      'Line 8: snacks "11" must be a whole number from 0 to 10',
      'Line 9: snacks "-1" must be a whole number from 0 to 10',
      'Line 10: snacks "1.5" must be a whole number from 0 to 10',
      'Line 11: note is 301 characters (max 300)',
      'Line 12: expected 8 values, found 7',
    ])
    expect(rows.map((r) => r.date)).toEqual(['2026-09-20'])
  })

  it('accepts today in the tracker timezone and a 300-character note', () => {
    const { errors } = parseBackfill(csv(`${TODAY},1,1,1,1,1,0,${'x'.repeat(300)}`), TODAY)
    expect(errors).toEqual([])
  })

  it('rejects unknown, missing and duplicate columns', () => {
    expect(parseBackfill('date,breakfast,brunch,lunch,dinner,snaks\n', TODAY).errors).toEqual([
      'Unknown column(s): snaks',
      'Missing column(s): evening',
    ])
    expect(parseBackfill(`${HEADER},note\n`, TODAY).errors).toEqual(['Duplicate column(s): note'])
  })

  it('rejects an empty file or a header with no rows', () => {
    expect(parseBackfill('', TODAY).errors).toEqual(['The file is empty.'])
    expect(parseBackfill(`${HEADER}\n`, TODAY).errors).toEqual(['No data rows after the header.'])
  })
})

describe('written documents', () => {
  const { rows } = parseBackfill(csv('2026-09-18,1,0,1,1,1,2,'), TODAY)
  const row = rows[0]!

  it('have exactly meals, snacks and note (updatedAt is added by the importer)', () => {
    const data = rowToData(row)
    expect(Object.keys(data).sort()).toEqual(['meals', 'note', 'snacks'])
    expect(Object.keys(data.meals)).toEqual([...MEAL_KEYS])
    for (const key of MEAL_KEYS) {
      expect(Object.keys(data.meals[key]).sort()).toEqual(['at', 'done'])
      expect(data.meals[key].at).toBeNull()
    }
    expect(data).toMatchObject({ snacks: 2, note: '' })
  })

  it('score with the real scoring module', () => {
    const days: DayMap = { [row.date]: rowToDay(row) }
    expect(computeDayScore(row.date, days, DEFAULT_SETTINGS).total).toBe(40 + 6)
  })
})

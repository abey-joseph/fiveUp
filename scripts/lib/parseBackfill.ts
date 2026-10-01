/**
 * Pure CSV parsing + validation for the one-time backfill (spec §13). No Firebase imports.
 *
 *   date,breakfast,brunch,lunch,evening,dinner,snacks,note
 *   2026-09-18,1,1,1,0,1,2,
 *   2026-09-19,1,0,1,1,1,0,"skipped brunch, busy day"
 */
import { isValidDateKey } from '../../src/lib/dates.ts'
import { MAX_SNACKS, NOTE_MAX } from '../../src/lib/dayDoc.ts'
import { emptyDay } from '../../src/lib/defaultSettings.ts'
import { MEAL_KEYS, type MealKey } from '../../src/lib/meals.ts'
import type { DateKey, DayDoc } from '../../src/lib/types.ts'

export interface BackfillRow {
  /** 1-based line number in the file (for messages). */
  line: number
  date: DateKey
  meals: Record<MealKey, boolean>
  snacks: number
  note: string
}

export interface ParseResult {
  rows: BackfillRow[]
  /** Every problem found; the import must not run if this is non-empty. */
  errors: string[]
}

const REQUIRED = ['date', ...MEAL_KEYS] as const
const OPTIONAL = ['snacks', 'note'] as const
const KNOWN = new Set<string>([...REQUIRED, ...OPTIONAL])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TRUE = new Set(['1', 'y', 'yes', 'true'])
const FALSE = new Set(['', '0', 'n', 'no', 'false'])

/**
 * RFC 4180-style CSV: commas, double-quoted fields with `""` escapes, quoted newlines, CRLF or LF.
 * Returns rows with the 1-based line each row starts on.
 */
export function parseCsv(text: string): { line: number; fields: string[] }[] {
  const src = text.replace(/^\uFEFF/, '')
  const out: { line: number; fields: string[] }[] = []
  let fields: string[] = []
  let field = ''
  let quoted = false
  let line = 1
  let rowLine = 1
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        quoted = false
      } else {
        if (c === '\n') line++
        field += c
      }
    } else if (c === '"' && field === '') {
      quoted = true
    } else if (c === ',') {
      fields.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      fields.push(field)
      out.push({ line: rowLine, fields })
      fields = []
      field = ''
      line++
      rowLine = line
    } else {
      field += c
    }
  }
  if (quoted) throw new Error(`Unclosed quote in the row starting on line ${rowLine}`)
  if (field !== '' || fields.length > 0) {
    fields.push(field)
    out.push({ line: rowLine, fields })
  }
  // Drop blank lines.
  return out.filter((r) => !(r.fields.length === 1 && r.fields[0]!.trim() === ''))
}

/**
 * Parses and validates the backfill CSV. `today` is today's key in the tracker timezone; dates
 * after it are rejected. All errors are collected so the owner can fix the file in one go.
 */
export function parseBackfill(text: string, today: DateKey): ParseResult {
  const errors: string[] = []
  let table: { line: number; fields: string[] }[]
  try {
    table = parseCsv(text)
  } catch (err) {
    return { rows: [], errors: [(err as Error).message] }
  }
  if (table.length === 0) return { rows: [], errors: ['The file is empty.'] }

  const header = table[0]!.fields.map((h) => h.trim().toLowerCase())
  const unknown = header.filter((h) => !KNOWN.has(h))
  if (unknown.length) errors.push(`Unknown column(s): ${unknown.join(', ')}`)
  const missing = REQUIRED.filter((h) => !header.includes(h))
  if (missing.length) errors.push(`Missing column(s): ${missing.join(', ')}`)
  const dupes = header.filter((h, i) => header.indexOf(h) !== i)
  if (dupes.length) errors.push(`Duplicate column(s): ${[...new Set(dupes)].join(', ')}`)
  if (errors.length) return { rows: [], errors }
  if (table.length === 1) return { rows: [], errors: ['No data rows after the header.'] }

  const col = (name: string) => header.indexOf(name)
  const rows: BackfillRow[] = []
  const seen = new Map<string, number>()

  for (const { line, fields } of table.slice(1)) {
    const at = `Line ${line}`
    if (fields.length !== header.length) {
      errors.push(`${at}: expected ${header.length} values, found ${fields.length}`)
      continue
    }
    const get = (name: string) => (col(name) >= 0 ? fields[col(name)]!.trim() : '')
    const rowErrors: string[] = []

    const date = get('date')
    if (!DATE_RE.test(date) || !isValidDateKey(date)) {
      rowErrors.push(`date "${date}" is not a valid yyyy-MM-dd date`)
    } else if (date > today) {
      rowErrors.push(`date ${date} is in the future (today is ${today} in the tracker timezone)`)
    } else if (seen.has(date)) {
      rowErrors.push(`date ${date} is a duplicate of line ${seen.get(date)}`)
    } else {
      seen.set(date, line)
    }

    const meals = {} as Record<MealKey, boolean>
    for (const key of MEAL_KEYS) {
      const v = get(key).toLowerCase()
      if (TRUE.has(v)) meals[key] = true
      else if (FALSE.has(v)) meals[key] = false
      else rowErrors.push(`${key} "${get(key)}" must be 1/0, y/n, yes/no, true/false or blank`)
    }

    const snacksRaw = get('snacks')
    const snacks = snacksRaw === '' ? 0 : Number(snacksRaw)
    if (
      !/^\d*$/.test(snacksRaw) ||
      !Number.isInteger(snacks) ||
      snacks < 0 ||
      snacks > MAX_SNACKS
    ) {
      rowErrors.push(`snacks "${snacksRaw}" must be a whole number from 0 to ${MAX_SNACKS}`)
    }

    const note = get('note')
    if (note.length > NOTE_MAX) {
      rowErrors.push(`note is ${note.length} characters (max ${NOTE_MAX})`)
    }

    if (rowErrors.length) errors.push(...rowErrors.map((e) => `${at}: ${e}`))
    else rows.push({ line, date, meals, snacks, note })
  }

  rows.sort((a, b) => (a.date < b.date ? -1 : 1))
  return { rows, errors }
}

/** The row as a domain DayDoc (imported meals have no time: `at: null`). */
export function rowToDay(row: BackfillRow): DayDoc {
  const day = emptyDay()
  for (const key of MEAL_KEYS) day.meals[key] = { done: row.meals[key], at: null }
  day.snacks = row.snacks
  day.note = row.note
  return day
}

/**
 * Exactly the fields a day document has (spec §4.2), minus `updatedAt`, which the importer sets
 * with `serverTimestamp()`. No extra fields — the security rules would reject later edits.
 */
export function rowToData(row: BackfillRow) {
  const meals = {} as Record<MealKey, { done: boolean; at: null }>
  for (const key of MEAL_KEYS) meals[key] = { done: row.meals[key], at: null }
  return { meals, snacks: row.snacks, note: row.note }
}

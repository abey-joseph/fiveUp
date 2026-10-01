/**
 * One-time backfill of past days from a CSV (spec §13). Dry run unless --commit is passed.
 *
 *   npx tsx scripts/import-days.ts --file data/backfill-sep-2026.csv            # dry run
 *   npx tsx scripts/import-days.ts --file data/backfill-sep-2026.csv --commit   # write
 *
 * Options: --tracker <id> (default main), --overwrite (replace days that already exist).
 * Credentials: see scripts/lib/adminApp.ts. The CSV format is in data/backfill-template.csv.
 */
import { readFileSync } from 'node:fs'
import { FieldPath, FieldValue } from 'firebase-admin/firestore'
import { addDaysKey, todayKey } from '../src/lib/dates.ts'
import { dayFromData } from '../src/lib/dayDoc.ts'
import { resolveSettings } from '../src/lib/defaultSettings.ts'
import { MEALS } from '../src/lib/meals.ts'
import { computeDayScore, isFullDay } from '../src/lib/scoring.ts'
import type { DayMap } from '../src/lib/types.ts'
import { initAdmin, parseArgs } from './lib/adminApp.ts'
import { parseBackfill, rowToData, rowToDay, type BackfillRow } from './lib/parseBackfill.ts'

/** Existing history loaded before the first imported day, so streaks continue correctly. */
const LOOKBACK_DAYS = 60
/** Firestore's limit on writes per batch. */
const BATCH_LIMIT = 500

type Action = 'new' | 'skip' | 'overwrite'

function pad(s: string | number, n: number, right = false): string {
  const t = String(s)
  return right ? t.padStart(n) : t.padEnd(n)
}

function explain(err: unknown): string {
  const e = err as { code?: number | string; reason?: string; details?: string; message?: string }
  const msg = e.details || e.message || String(err)
  if (e.reason === 'SERVICE_DISABLED')
    return `${msg}\n  → Create the Firestore database (Firebase console → Build → Firestore Database).`
  if (e.code === 7 || e.code === 'permission-denied')
    return `${msg}\n  → The service account needs the "Cloud Datastore User" role (roles/datastore.user).`
  if (e.code === 6)
    return `${msg}\n  → A day was logged in the app since the check. Re-run the dry run to see it.`
  return msg
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2))
  const file = typeof args.file === 'string' ? args.file : ''
  const trackerId = typeof args.tracker === 'string' ? args.tracker : 'main'
  const commit = args.commit === true
  const overwrite = args.overwrite === true
  if (!file) {
    console.error('✗ --file <path> is required (see data/backfill-template.csv)')
    return 1
  }

  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch (err) {
    console.error(`✗ Can't read ${file}: ${(err as Error).message}`)
    return 1
  }

  const { db, projectId } = initAdmin()
  const trackerRef = db.doc(`trackers/${trackerId}`)
  const tracker = await trackerRef.get()
  if (!tracker.exists) {
    console.error(
      `✗ trackers/${trackerId} doesn't exist — create it first (scripts/create-tracker.ts).`,
    )
    return 1
  }
  const settings = resolveSettings(tracker.get('settings'))
  const today = todayKey(settings.timezone)

  console.log(`Project:  ${projectId}`)
  console.log(`Tracker:  trackers/${trackerId}`)
  console.log(`File:     ${file}`)
  console.log(`Today:    ${today} (${settings.timezone})`)
  console.log(`Mode:     ${commit ? 'COMMIT' : 'dry run'}${overwrite ? ' + overwrite' : ''}\n`)

  const { rows, errors } = parseBackfill(text, today)
  if (errors.length) {
    console.error(`✗ ${errors.length} problem(s) in ${file} — nothing imported:`)
    for (const e of errors) console.error(`  • ${e}`)
    return 1
  }

  // Existing days from LOOKBACK_DAYS before the first row to the last row.
  const first = rows[0]!.date
  const last = rows[rows.length - 1]!.date
  const existing = await trackerRef
    .collection('days')
    .where(FieldPath.documentId(), '>=', addDaysKey(first, -LOOKBACK_DAYS))
    .where(FieldPath.documentId(), '<=', last)
    .get()
  const days: DayMap = {}
  for (const d of existing.docs) days[d.id] = dayFromData(d.data())

  const plan: { row: BackfillRow; action: Action }[] = rows.map((row) => {
    const exists = days[row.date] !== undefined
    const action: Action = !exists ? 'new' : overwrite ? 'overwrite' : 'skip'
    if (action !== 'skip') days[row.date] = rowToDay(row)
    return { row, action }
  })

  // Table: what each day will look like after the import (skipped rows show the stored day).
  const mealHead = MEALS.map((m) => m.label.slice(0, 3)).join(' ')
  console.log(`${pad('Date', 11)} ${mealHead}  Snacks  Score  Streak  Action     Note`)
  console.log('-'.repeat(78))
  let fullDays = 0
  for (const { row, action } of plan) {
    const day = days[row.date]
    const s = computeDayScore(row.date, days, settings)
    if (isFullDay(day)) fullDays++
    const marks = MEALS.map((m) => pad(day?.meals[m.key].done ? '✓' : '·', 3)).join(' ')
    const label = action === 'skip' ? 'skip*' : action
    console.log(
      `${pad(row.date, 11)} ${marks}  ${pad(day?.snacks ?? 0, 6, true)}  ${pad(s.total, 5, true)}  ${pad(s.streak, 6, true)}  ${pad(label, 9)}  ${day?.note ?? ''}`,
    )
  }
  const toWrite = plan.filter((p) => p.action !== 'skip')
  const skipped = plan.filter((p) => p.action === 'skip')
  const finalStreak = computeDayScore(last, days, settings).streak

  console.log('-'.repeat(78))
  console.log(`Days in file: ${rows.length} (${first} → ${last})`)
  console.log(`Full days:    ${fullDays}`)
  console.log(`Final streak: ${finalStreak} on ${last}`)
  console.log(
    `To write:     ${toWrite.length} (${toWrite.filter((p) => p.action === 'new').length} new, ${toWrite.filter((p) => p.action === 'overwrite').length} overwrite)`,
  )
  if (skipped.length) {
    console.log(
      `Skipped:      ${skipped.length} already in Firestore — ${skipped.map((p) => p.row.date).join(', ')}`,
    )
    console.log(
      '              (* scores above use the stored data; pass --overwrite to replace them)',
    )
  }

  if (!commit) {
    console.log('\nDry run — nothing written. Re-run with --commit to write.')
    return 0
  }
  if (toWrite.length === 0) {
    console.log('\nNothing to write.')
    return 0
  }

  // `create` fails if a doc appeared since the check above, so app data is never overwritten
  // without --overwrite. Each batch is atomic.
  let written = 0
  for (let i = 0; i < toWrite.length; i += BATCH_LIMIT) {
    const batch = db.batch()
    for (const { row, action } of toWrite.slice(i, i + BATCH_LIMIT)) {
      const ref = trackerRef.collection('days').doc(row.date)
      const data = { ...rowToData(row), updatedAt: FieldValue.serverTimestamp() }
      if (action === 'overwrite') batch.set(ref, data)
      else batch.create(ref, data)
    }
    await batch.commit()
    written += Math.min(BATCH_LIMIT, toWrite.length - i)
  }
  console.log(`\n✓ Wrote ${written} day document(s) to trackers/${trackerId}/days`)
  return 0
}

try {
  process.exitCode = await main()
} catch (err) {
  console.error(`✗ ${explain(err)}`)
  process.exitCode = 1
}

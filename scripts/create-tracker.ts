/**
 * Creates the tracker document (trackers/{id}) with the Admin SDK — an alternative to creating it
 * by hand in the console (scripts/seed-tracker.md). Dry run unless --commit is passed.
 *
 *   npx tsx scripts/create-tracker.ts \
 *     --writer-email her@gmail.com --writer-name Amala --viewer-email me@gmail.com [--commit]
 *
 * Options: --tracker <id> (default main), --overwrite (replace an existing doc).
 */
import { DEFAULT_SETTINGS } from '../src/lib/defaultSettings.ts'
import { initAdmin, parseArgs } from './lib/adminApp.ts'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const args = parseArgs(process.argv.slice(2))
const str = (k: string) => (typeof args[k] === 'string' ? (args[k] as string).trim() : '')
const writerEmail = str('writer-email').toLowerCase()
const viewerEmail = str('viewer-email').toLowerCase()
const writerName = str('writer-name')
const trackerId = str('tracker') || 'main'

const errors: string[] = []
if (!EMAIL_RE.test(writerEmail)) errors.push('--writer-email must be an email address')
if (!EMAIL_RE.test(viewerEmail)) errors.push('--viewer-email must be an email address')
if (writerEmail && writerEmail === viewerEmail) errors.push('writer and viewer must differ')
if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'))
  process.exit(1)
}

const docData = {
  name: 'FiveUp',
  ...(writerName ? { writerName } : {}),
  writerEmail,
  viewerEmails: [viewerEmail],
  settings: { ...DEFAULT_SETTINGS },
}

async function main(): Promise<number> {
  const { db, projectId } = initAdmin()
  const ref = db.doc(`trackers/${trackerId}`)
  const existing = await ref.get()

  console.log(`Project: ${projectId}\nDocument: trackers/${trackerId}\n`)
  console.log(JSON.stringify(docData, null, 2))

  if (existing.exists && !args.overwrite) {
    console.log(`\n⚠ trackers/${trackerId} already exists — not changing it (pass --overwrite).`)
    return args.commit ? 1 : 0
  }
  if (!args.commit) {
    console.log('\nDry run — nothing written. Re-run with --commit to create it.')
    return 0
  }
  await ref.set(docData)
  console.log(`\n✓ ${existing.exists ? 'Replaced' : 'Created'} trackers/${trackerId}`)
  return 0
}

process.exitCode = await main()

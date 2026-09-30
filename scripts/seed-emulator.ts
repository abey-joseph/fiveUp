/**
 * Seeds the local Firestore emulator with a tracker doc for development.
 * Never touches a real project: it refuses to run unless FIRESTORE_EMULATOR_HOST is set.
 *
 *   npm run emulators          # in one terminal
 *   npm run seed:emulator      # in another
 *   npm run dev:emulator       # app against the emulators
 *
 * Also adds fake sample days (not real data) ending yesterday in the tracker timezone, shaped
 * like imported history (done meals with `at: null`), so streaks and history have something
 * to show.
 */
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { addDaysKey, todayKey } from '../src/lib/dates.ts'
import { DEFAULT_SETTINGS } from '../src/lib/defaultSettings.ts'
import { MEAL_KEYS } from '../src/lib/meals.ts'

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('FIRESTORE_EMULATOR_HOST is not set — refusing to seed a real project.')
  process.exit(1)
}

const trackerId = process.env.VITE_TRACKER_ID || 'main'
initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-fiveup' })
const db = getFirestore()

await db.doc(`trackers/${trackerId}`).set({
  name: 'FiveUp',
  writerName: 'Mia',
  writerEmail: 'writer@example.com',
  viewerEmails: ['viewer@example.com'],
  settings: { ...DEFAULT_SETTINGS },
})

// 14 fake days ending yesterday; `missed[i]` lists meals skipped i days before yesterday.
const missed: Record<number, string[]> = { 4: ['brunch'], 8: ['brunch', 'evening'], 10: ['brunch'] }
const yesterday = addDaysKey(todayKey(DEFAULT_SETTINGS.timezone), -1)
const batch = db.batch()
for (let i = 0; i < 14; i++) {
  const key = addDaysKey(yesterday, -i)
  const meals = Object.fromEntries(
    MEAL_KEYS.map((k) => [k, { done: !(missed[i] ?? []).includes(k), at: null }]),
  )
  batch.set(db.doc(`trackers/${trackerId}/days/${key}`), {
    meals,
    snacks: i % 3,
    note: '',
    updatedAt: FieldValue.serverTimestamp(),
  })
}
await batch.commit()

console.log(`Seeded trackers/${trackerId} (writer@example.com / viewer@example.com)`)
console.log(`Seeded 14 sample days ending ${yesterday}`)

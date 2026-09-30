/**
 * Seeds the local Firestore emulator with a tracker doc for development.
 * Never touches a real project: it refuses to run unless FIRESTORE_EMULATOR_HOST is set.
 *
 *   npm run emulators          # in one terminal
 *   npm run seed:emulator      # in another
 *   npm run dev:emulator       # app against the emulators
 */
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { DEFAULT_SETTINGS } from '../src/lib/defaultSettings.ts'

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

console.log(`Seeded trackers/${trackerId} (writer@example.com / viewer@example.com)`)

import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore'
import { MEAL_KEYS } from '../../src/lib/meals.ts'

const WRITER = 'writer@example.com'
const VIEWER = 'viewer@example.com'
const STRANGER = 'stranger@example.com'
const DAY = '2026-10-01'

let env: RulesTestEnvironment

function db(email: string | null, verified = true): Firestore {
  if (!email) return env.unauthenticatedContext().firestore() as unknown as Firestore
  return env
    .authenticatedContext(email.split('@')[0]!, { email, email_verified: verified })
    .firestore() as unknown as Firestore
}

function meals(done: Partial<Record<string, boolean>> = {}) {
  return Object.fromEntries(
    MEAL_KEYS.map((k) => [
      k,
      done[k] ? { done: true, at: Timestamp.fromDate(new Date()) } : { done: false, at: null },
    ]),
  )
}

function validDay(overrides: Record<string, unknown> = {}) {
  return {
    meals: meals({ breakfast: true }),
    snacks: 1,
    note: '',
    updatedAt: serverTimestamp(),
    ...overrides,
  }
}

const dayRef = (d: Firestore, key = DAY) => doc(d, 'trackers', 'main', 'days', key)

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-fiveup',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore() as unknown as Firestore
    await setDoc(doc(admin, 'trackers', 'main'), {
      name: 'FiveUp',
      writerEmail: WRITER,
      viewerEmails: [VIEWER],
      settings: { mealPoints: 10, timezone: 'Pacific/Auckland' },
    })
    await setDoc(dayRef(admin, '2026-09-30'), {
      meals: meals({ lunch: true }),
      snacks: 0,
      note: 'existing',
      updatedAt: Timestamp.now(),
    })
    await setDoc(doc(admin, 'other', 'x'), { a: 1 })
  })
})

describe('reads', () => {
  it('writer and viewer can read the tracker doc and days', async () => {
    for (const email of [WRITER, VIEWER]) {
      await assertSucceeds(getDoc(doc(db(email), 'trackers', 'main')))
      await assertSucceeds(getDoc(dayRef(db(email), '2026-09-30')))
      await assertSucceeds(getDoc(dayRef(db(email), '2026-01-01'))) // missing doc is fine
    }
  })

  it('writer and viewer can run a date-range query', async () => {
    for (const email of [WRITER, VIEWER]) {
      const q = query(
        collection(db(email), 'trackers', 'main', 'days'),
        where(documentId(), '>=', '2026-09-01'),
        where(documentId(), '<=', '2026-09-30'),
      )
      await assertSucceeds(getDocs(q))
    }
  })

  it('other accounts, unverified emails and signed-out users cannot read', async () => {
    for (const d of [db(STRANGER), db(WRITER, false), db(VIEWER, false), db(null)]) {
      await assertFails(getDoc(doc(d, 'trackers', 'main')))
      await assertFails(getDoc(dayRef(d, '2026-09-30')))
      await assertFails(getDocs(collection(d, 'trackers', 'main', 'days')))
    }
  })

  it('email matching is exact (no access for look-alike emails)', async () => {
    await assertFails(getDoc(doc(db('writer@example.co'), 'trackers', 'main')))
  })

  it('nobody can read a tracker that does not exist', async () => {
    await assertFails(getDoc(doc(db(WRITER), 'trackers', 'other')))
    await assertFails(getDoc(doc(db(WRITER), 'trackers', 'other', 'days', DAY)))
  })

  it('other collections are denied', async () => {
    await assertFails(getDoc(doc(db(WRITER), 'other', 'x')))
  })
})

describe('writer writes', () => {
  it('can create a valid day', async () => {
    await assertSucceeds(setDoc(dayRef(db(WRITER)), validDay()))
  })

  it('can create an empty day and a full day', async () => {
    await assertSucceeds(setDoc(dayRef(db(WRITER)), validDay({ meals: meals(), snacks: 0 })))
    const all = Object.fromEntries(MEAL_KEYS.map((k) => [k, true]))
    await assertSucceeds(
      setDoc(dayRef(db(WRITER), '2026-10-02'), validDay({ meals: meals(all), snacks: 10 })),
    )
  })

  it('accepts done: true with at: null (imported history)', async () => {
    const m = meals()
    m.brunch = { done: true, at: null }
    await assertSucceeds(setDoc(dayRef(db(WRITER)), validDay({ meals: m })))
  })

  it('can update fields of an existing day (partial update)', async () => {
    await assertSucceeds(
      updateDoc(dayRef(db(WRITER), '2026-09-30'), {
        'meals.dinner': { done: true, at: Timestamp.now() },
        snacks: 3,
        updatedAt: serverTimestamp(),
      }),
    )
    await assertSucceeds(
      updateDoc(dayRef(db(WRITER), '2026-09-30'), {
        note: 'x'.repeat(300),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('can delete a day', async () => {
    await assertSucceeds(deleteDoc(dayRef(db(WRITER), '2026-09-30')))
  })

  it('cannot write the tracker doc (settings) or other collections', async () => {
    await assertFails(
      setDoc(doc(db(WRITER), 'trackers', 'main'), { writerEmail: WRITER }, { merge: true }),
    )
    await assertFails(setDoc(doc(db(WRITER), 'other', 'y'), { a: 1 }))
  })

  it('cannot write with an unverified email', async () => {
    await assertFails(setDoc(dayRef(db(WRITER, false)), validDay()))
  })
})

describe('day validation', () => {
  const invalid: [string, string, Record<string, unknown>][] = [
    ['doc id not yyyy-MM-dd', '2026-9-1', {}],
    ['doc id is a word', 'today', {}],
    ['extra field', DAY, { imported: true }],
    ['snacks > 10', DAY, { snacks: 11 }],
    ['snacks < 0', DAY, { snacks: -1 }],
    ['snacks not an int', DAY, { snacks: 1.5 }],
    ['snacks a string', DAY, { snacks: '2' }],
    ['note > 300 chars', DAY, { note: 'x'.repeat(301) }],
    ['note not a string', DAY, { note: 5 }],
    ['client-side updatedAt', DAY, { updatedAt: Timestamp.fromDate(new Date('2026-01-01')) }],
    ['meals not a map', DAY, { meals: 'all' }],
  ]

  it.each(invalid)('rejects: %s', async (_name, key, overrides) => {
    await assertFails(setDoc(dayRef(db(WRITER), key), validDay(overrides)))
  })

  it.each(['meals', 'snacks', 'note', 'updatedAt'])('rejects a missing %s field', async (f) => {
    const d = validDay() as Record<string, unknown>
    delete d[f]
    await assertFails(setDoc(dayRef(db(WRITER)), d))
  })

  it('rejects a missing meal key', async () => {
    const m = meals() as Record<string, unknown>
    delete m.brunch
    await assertFails(setDoc(dayRef(db(WRITER)), validDay({ meals: m })))
  })

  it('rejects an extra meal key', async () => {
    await assertFails(
      setDoc(
        dayRef(db(WRITER)),
        validDay({ meals: { ...meals(), supper: { done: true, at: null } } }),
      ),
    )
  })

  it('rejects malformed meal entries', async () => {
    const bad = [
      { done: 'yes', at: null },
      { done: true },
      { done: true, at: null, photo: 'x' },
      { done: true, at: '8:42' },
      { done: false, at: Timestamp.now() },
    ]
    for (const entry of bad) {
      await assertFails(
        setDoc(dayRef(db(WRITER)), validDay({ meals: { ...meals(), lunch: entry } })),
      )
    }
  })

  it('rejects an update that breaks validation', async () => {
    await assertFails(
      updateDoc(dayRef(db(WRITER), '2026-09-30'), { snacks: 12, updatedAt: serverTimestamp() }),
    )
    // Omitting updatedAt keeps the old (non-request.time) value, so it's rejected too.
    await assertFails(updateDoc(dayRef(db(WRITER), '2026-09-30'), { snacks: 2 }))
  })
})

describe('viewer and others cannot write', () => {
  it.each([VIEWER, STRANGER])('%s cannot create, update or delete days', async (email) => {
    await assertFails(setDoc(dayRef(db(email)), validDay()))
    await assertFails(
      updateDoc(dayRef(db(email), '2026-09-30'), { snacks: 2, updatedAt: serverTimestamp() }),
    )
    await assertFails(deleteDoc(dayRef(db(email), '2026-09-30')))
    await assertFails(setDoc(doc(db(email), 'trackers', 'main'), { viewerEmails: [email] }))
  })

  it('signed-out users cannot write', async () => {
    await assertFails(setDoc(dayRef(db(null)), validDay()))
  })
})

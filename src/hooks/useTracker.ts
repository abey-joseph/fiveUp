import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { TRACKER_ID, getDb } from '../lib/firebase.ts'
import { parseTracker, resolveRole } from '../lib/tracker.ts'
import type { Role, TrackerDoc } from '../lib/types.ts'

export type TrackerState =
  | { status: 'loading' }
  | { status: 'ready'; tracker: TrackerDoc; role: Role }
  | { status: 'no-access' }
  | { status: 'error'; message: string }

interface Keyed {
  uid: string
  state: TrackerState
}

/**
 * Subscribes to the tracker doc and derives the user's role. Security rules only let the writer
 * and viewers read the doc, so "permission denied" (or a missing doc) means no access.
 */
export function useTracker(user: User | null): TrackerState {
  const [keyed, setKeyed] = useState<Keyed | null>(null)
  const uid = user?.uid ?? null
  const email = user?.email ?? null

  useEffect(() => {
    if (!uid) return
    const set = (state: TrackerState) => setKeyed({ uid, state })
    return onSnapshot(
      doc(getDb(), 'trackers', TRACKER_ID),
      (snap) => {
        if (!snap.exists()) {
          // With persistence, a cache miss while offline also looks like "doesn't exist".
          if (snap.metadata.fromCache) return
          set({ status: 'no-access' })
          return
        }
        const tracker = parseTracker(snap.data())
        const role = resolveRole(email, tracker)
        set(role ? { status: 'ready', tracker, role } : { status: 'no-access' })
      },
      (err) => {
        if (err.code === 'permission-denied') set({ status: 'no-access' })
        else set({ status: 'error', message: err.message })
      },
    )
  }, [uid, email])

  // State from a previous user (or none yet) counts as loading.
  if (!uid || keyed?.uid !== uid) return { status: 'loading' }
  return keyed.state
}

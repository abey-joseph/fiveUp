import { useCallback, useEffect, useRef, useState } from 'react'
import { onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { dayFromData, dayToData } from '../lib/dayDoc.ts'
import { dayRef } from '../lib/dayRefs.ts'
import { emptyDay } from '../lib/defaultSettings.ts'
import type { DateKey, DayDoc } from '../lib/types.ts'

export interface DayState {
  /** The day's data (undefined = no document yet). Includes optimistic local changes. */
  day: DayDoc | undefined
  loaded: boolean
  /** Applies an update instantly and writes the whole day doc to Firestore. */
  update: (fn: (day: DayDoc) => DayDoc) => void
}

interface Snap {
  key: DateKey
  day: DayDoc | undefined
}

/**
 * One day, live. Firestore's latency compensation already reflects local writes in the next
 * snapshot (even offline); the `optimistic` state bridges the few ms before that snapshot fires.
 */
export function useDay(
  trackerId: string,
  key: DateKey,
  onError: (message: string) => void,
): DayState {
  const [snap, setSnap] = useState<Snap | null>(null)
  const [optimistic, setOptimistic] = useState<Snap | null>(null)
  // Latest known value for this key, so rapid taps build on each other.
  const latest = useRef<{ key: DateKey; day: DayDoc | undefined } | null>(null)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    latest.current = null
    return onSnapshot(
      dayRef(trackerId, key),
      { includeMetadataChanges: true },
      (s) => {
        // A cache-only "doesn't exist" while online may just mean this device hasn't seen the
        // day yet; wait for the server so a tap can't overwrite data stored there.
        if (s.metadata.fromCache && !s.exists() && navigator.onLine) return
        const day = s.exists() ? dayFromData(s.data({ serverTimestamps: 'estimate' })) : undefined
        latest.current = { key, day }
        setSnap({ key, day })
        setOptimistic(null)
      },
      (err) => onErrorRef.current(`Couldn't load this day: ${err.message}`),
    )
  }, [trackerId, key])

  const update = useCallback(
    (fn: (day: DayDoc) => DayDoc) => {
      // Until this day's first snapshot arrives we don't know what's stored; building on an
      // empty day here would overwrite it (setDoc replaces the whole doc). Ignore the tap.
      if (latest.current?.key !== key) return
      const next = fn(latest.current.day ?? emptyDay())
      latest.current = { key, day: next }
      setOptimistic({ key, day: next })
      setDoc(dayRef(trackerId, key), { ...dayToData(next), updatedAt: serverTimestamp() }).catch(
        (err: { code?: string; message?: string }) => {
          setOptimistic(null)
          onErrorRef.current(
            err.code === 'permission-denied'
              ? "Couldn't save — you don't have permission to edit."
              : `Couldn't save: ${err.message ?? 'unknown error'}`,
          )
        },
      )
    },
    [trackerId, key],
  )

  const loaded = snap?.key === key
  const day = optimistic?.key === key ? optimistic.day : snap?.key === key ? snap.day : undefined
  return { day, loaded, update }
}

import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { addDaysKey } from '../lib/dates.ts'
import { dayFromData } from '../lib/dayDoc.ts'
import { dayRangeQuery } from '../lib/dayRefs.ts'
import { isStreakTruncated } from '../lib/scoring.ts'
import type { DateKey, DayMap } from '../lib/types.ts'

export interface DayRangeState {
  days: DayMap
  loaded: boolean
  error: string | null
}

/** How long to wait for the server before accepting a cache-only result. */
export const CACHE_FALLBACK_MS = 5000

const EMPTY: DayMap = Object.freeze({}) as DayMap

interface Keyed {
  rangeKey: string
  days: DayMap
  /** False while showing a cache-only result that the server hasn't confirmed yet. */
  complete: boolean
  error: string | null
}

/**
 * Live day documents with IDs in [from, to]. Only that range is read.
 *
 * The offline cache may answer first with just the days this device has seen; that result is
 * shown but not `loaded` (so streaks/totals aren't treated as final) until the server confirms
 * it — unless the device is offline (or the server doesn't answer within 5 s), when the cache is
 * all there is.
 */
export function useDayRange(trackerId: string, from: DateKey, to: DateKey): DayRangeState {
  const rangeKey = `${trackerId}/${from}/${to}`
  const [state, setState] = useState<Keyed | null>(null)

  useEffect(() => {
    const key = `${trackerId}/${from}/${to}`
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = onSnapshot(
      dayRangeQuery(trackerId, from, to),
      { includeMetadataChanges: true },
      (s) => {
        const days: DayMap = {}
        s.forEach((d) => {
          days[d.id] = dayFromData(d.data({ serverTimestamps: 'estimate' }))
        })
        const complete = !s.metadata.fromCache || !navigator.onLine
        clearTimeout(timer)
        // On a connection that looks online but can't reach the server, settle for the cache.
        if (!complete) {
          timer = setTimeout(
            () => setState((prev) => (prev?.rangeKey === key ? { ...prev, complete: true } : prev)),
            CACHE_FALLBACK_MS,
          )
        }
        setState({ rangeKey: key, days, complete, error: null })
      },
      (err) => setState({ rangeKey: key, days: EMPTY, complete: true, error: err.message }),
    )
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [trackerId, from, to])

  if (state?.rangeKey !== rangeKey) return { days: EMPTY, loaded: false, error: null }
  return { days: state.days, loaded: state.complete, error: state.error }
}

const INITIAL_LOOKBACK = 60
/** ~10 years; a safety stop for the lookback doubling. */
const MAX_LOOKBACK = 3840

/**
 * Days ending at `endKey`, looking back far enough that streaks are complete: starts with 60 days
 * and doubles the window while the oldest loaded day is full (so the streak may continue further
 * back), e.g. a streak that began during the September backfill.
 */
export function useStreakDays(
  trackerId: string,
  endKey: DateKey,
  minFrom?: DateKey,
): DayRangeState & { from: DateKey } {
  const [lookback, setLookback] = useState(INITIAL_LOOKBACK)
  let from = addDaysKey(endKey, -(lookback - 1))
  if (minFrom && minFrom < from) from = minFrom
  const range = useDayRange(trackerId, from, endKey)
  // Last loaded days, shown while a new or wider window loads (avoids flicker to empty).
  const [shown, setShown] = useState<DayMap>(EMPTY)

  // Adjusting state during render (React-recommended over an effect for derived updates).
  if (range.loaded && shown !== range.days) setShown(range.days)
  if (range.loaded && lookback < MAX_LOOKBACK && isStreakTruncated(range.days, from)) {
    setLookback(lookback * 2)
  }
  return { ...range, days: range.loaded ? range.days : shown, from }
}

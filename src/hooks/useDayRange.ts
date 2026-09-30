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

const EMPTY: DayMap = Object.freeze({}) as DayMap

interface Keyed {
  rangeKey: string
  days: DayMap
  error: string | null
}

/** Live day documents with IDs in [from, to]. Only that range is read. */
export function useDayRange(trackerId: string, from: DateKey, to: DateKey): DayRangeState {
  const rangeKey = `${trackerId}/${from}/${to}`
  const [state, setState] = useState<Keyed | null>(null)

  useEffect(() => {
    return onSnapshot(
      dayRangeQuery(trackerId, from, to),
      (s) => {
        const days: DayMap = {}
        s.forEach((d) => {
          days[d.id] = dayFromData(d.data({ serverTimestamps: 'estimate' }))
        })
        setState({ rangeKey: `${trackerId}/${from}/${to}`, days, error: null })
      },
      (err) =>
        setState({ rangeKey: `${trackerId}/${from}/${to}`, days: EMPTY, error: err.message }),
    )
  }, [trackerId, from, to])

  if (state?.rangeKey !== rangeKey) return { days: EMPTY, loaded: false, error: null }
  return { days: state.days, loaded: true, error: state.error }
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

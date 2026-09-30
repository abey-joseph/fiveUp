import { collection, doc, documentId, query, where } from 'firebase/firestore'
import { getDb } from './firebase.ts'
import type { DateKey } from './types.ts'

export function dayRef(trackerId: string, key: DateKey) {
  return doc(getDb(), 'trackers', trackerId, 'days', key)
}

/** Days with IDs in [from, to] (inclusive). Doc IDs are yyyy-MM-dd so they sort by date. */
export function dayRangeQuery(trackerId: string, from: DateKey, to: DateKey) {
  return query(
    collection(getDb(), 'trackers', trackerId, 'days'),
    where(documentId(), '>=', from),
    where(documentId(), '<=', to),
  )
}

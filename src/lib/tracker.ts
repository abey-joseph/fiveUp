/** Pure helpers for the tracker document: parsing and role detection. No Firebase imports. */
import { resolveSettings } from './defaultSettings.ts'
import type { Role, TrackerDoc } from './types.ts'

function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

export function parseTracker(data: unknown): TrackerDoc {
  const src = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const writerEmail = typeof src.writerEmail === 'string' ? src.writerEmail : ''
  const viewerEmails = Array.isArray(src.viewerEmails)
    ? src.viewerEmails.filter((e): e is string => typeof e === 'string')
    : []
  const fallbackName = writerEmail.split('@')[0] || 'the tracker'
  return {
    name: typeof src.name === 'string' && src.name ? src.name : 'FiveUp',
    writerName:
      typeof src.writerName === 'string' && src.writerName.trim()
        ? src.writerName.trim()
        : fallbackName,
    writerEmail,
    viewerEmails,
    settings: resolveSettings(src.settings),
  }
}

/** Writer if the email matches `writerEmail`, viewer if it's in `viewerEmails`, else null. */
export function resolveRole(email: string | null | undefined, tracker: TrackerDoc): Role | null {
  const e = normalizeEmail(email)
  if (!e) return null
  if (e === normalizeEmail(tracker.writerEmail)) return 'writer'
  if (tracker.viewerEmails.some((v) => normalizeEmail(v) === e)) return 'viewer'
  return null
}

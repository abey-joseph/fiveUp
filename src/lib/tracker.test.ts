import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './defaultSettings.ts'
import { parseTracker, resolveRole } from './tracker.ts'

const tracker = parseTracker({
  name: 'FiveUp',
  writerName: 'Mia',
  writerEmail: 'mia@example.com',
  viewerEmails: ['viewer@example.com'],
  settings: { timezone: 'Pacific/Auckland' },
})

describe('resolveRole', () => {
  it('writer / viewer / none', () => {
    expect(resolveRole('mia@example.com', tracker)).toBe('writer')
    expect(resolveRole('viewer@example.com', tracker)).toBe('viewer')
    expect(resolveRole('stranger@example.com', tracker)).toBeNull()
    expect(resolveRole(null, tracker)).toBeNull()
    expect(resolveRole('', tracker)).toBeNull()
  })

  it('is case-insensitive and trims', () => {
    expect(resolveRole(' Mia@Example.com ', tracker)).toBe('writer')
  })

  it('an empty writerEmail never matches', () => {
    expect(resolveRole('', parseTracker({}))).toBeNull()
  })
})

describe('parseTracker', () => {
  it('fills defaults for missing fields', () => {
    const t = parseTracker({ writerEmail: 'sam@example.com', viewerEmails: ['a@b.c', 42] })
    expect(t.name).toBe('FiveUp')
    expect(t.writerName).toBe('sam')
    expect(t.viewerEmails).toEqual(['a@b.c'])
    expect(t.settings).toEqual(DEFAULT_SETTINGS)
  })

  it('reads the settings timezone', () => {
    expect(parseTracker({ settings: { timezone: 'Asia/Singapore' } }).settings.timezone).toBe(
      'Asia/Singapore',
    )
  })
})

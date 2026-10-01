import { useEffect, useRef, useState } from 'react'
import { NOTE_MAX } from '../lib/dayDoc.ts'

interface Props {
  value: string
  canEdit: boolean
  onSave: (note: string) => void
}

const DEBOUNCE_MS = 800

/** One-line note. Saves on blur, and debounced while typing. Mount with `key={date}`. */
export default function NoteField({ value, canEdit, onSave }: Props) {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  const [lastValue, setLastValue] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Pick up remote changes (e.g. from another device) while not editing.
  if (value !== lastValue) {
    setLastValue(value)
    if (!focused) setDraft(value)
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  function commit(next: string) {
    clearTimeout(timer.current)
    if (next !== value) onSave(next)
  }

  if (!canEdit) {
    if (!value) return null
    return (
      <p className="rounded-2xl bg-white px-4 py-3 text-stone-700 ring-1 ring-brand-100">
        <span aria-hidden="true">📝 </span>
        {value}
      </p>
    )
  }

  return (
    <label className="block">
      <span className="sr-only">Note for this day</span>
      <input
        type="text"
        value={draft}
        maxLength={NOTE_MAX}
        placeholder="Add a note (optional)"
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          const next = e.target.value
          setDraft(next)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => commit(next), DEBOUNCE_MS)
        }}
        onBlur={() => {
          setFocused(false)
          commit(draft)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="min-h-12 w-full rounded-2xl bg-white px-4 text-stone-800 ring-1 ring-brand-100 placeholder:text-stone-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
      />
    </label>
  )
}

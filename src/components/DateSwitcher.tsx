import { useRef } from 'react'
import { addDaysKey, formatKey } from '../lib/dates.ts'
import type { DateKey } from '../lib/types.ts'

interface Props {
  selected: DateKey
  today: DateKey
  onChange: (key: DateKey) => void
}

function relativeLabel(selected: DateKey, today: DateKey): string {
  if (selected === today) return 'Today'
  if (selected === addDaysKey(today, -1)) return 'Yesterday'
  return formatKey(selected, 'EEEE')
}

export default function DateSwitcher({ selected, today, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const isToday = selected === today
  const arrow =
    'flex size-11 items-center justify-center rounded-full text-xl text-stone-700 hover:bg-brand-100 disabled:opacity-30 disabled:hover:bg-transparent'

  function openPicker() {
    const el = input.current
    if (!el) return
    try {
      el.showPicker()
    } catch {
      el.focus()
      el.click()
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          className={arrow}
          aria-label="Previous day"
          onClick={() => onChange(addDaysKey(selected, -1))}
        >
          ‹
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={openPicker}
            className="flex min-h-11 flex-col items-center rounded-xl px-3 hover:bg-brand-100"
            aria-label={`${formatKey(selected, 'EEEE d MMMM yyyy')}. Choose a date`}
          >
            <span className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
              {relativeLabel(selected, today)}
            </span>
            <span className="text-xl font-bold text-stone-900">
              {formatKey(selected, 'EEE, d MMM')}{' '}
              <span aria-hidden="true" className="text-sm text-stone-400">
                ▾
              </span>
            </span>
          </button>
          <input
            ref={input}
            type="date"
            tabIndex={-1}
            aria-hidden="true"
            max={today}
            value={selected}
            onChange={(e) => {
              const v = e.target.value
              if (v) onChange(v > today ? today : v)
            }}
            className="pointer-events-none absolute inset-0 opacity-0"
          />
        </div>
        <button
          type="button"
          className={arrow}
          aria-label="Next day"
          disabled={isToday}
          onClick={() => onChange(addDaysKey(selected, 1))}
        >
          ›
        </button>
      </div>
      {!isToday && (
        <div className="mt-1 flex justify-center">
          <button
            type="button"
            onClick={() => onChange(today)}
            className="min-h-11 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800"
          >
            Back to today
          </button>
        </div>
      )}
    </div>
  )
}

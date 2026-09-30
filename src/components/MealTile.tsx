import { mealStatus } from '../lib/dayDoc.ts'
import type { MealDef } from '../lib/meals.ts'
import type { MealEntry } from '../lib/types.ts'

interface Props {
  meal: MealDef
  entry: MealEntry
  timezone: string
  canEdit: boolean
  onToggle: () => void
}

export default function MealTile({ meal, entry, timezone, canEdit, onToggle }: Props) {
  const status = mealStatus(entry, timezone)
  const base =
    'flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition'
  const tone = entry.done
    ? 'bg-leaf-50 ring-leaf-200'
    : 'bg-white ring-brand-100' + (canEdit ? ' hover:ring-brand-200 active:scale-[0.99]' : '')

  const content = (
    <>
      <span
        aria-hidden="true"
        className={`flex size-11 shrink-0 items-center justify-center rounded-full text-2xl ${
          entry.done ? 'bg-white' : 'bg-brand-50'
        }`}
      >
        {meal.icon}
      </span>
      <span className="flex-1">
        <span className="block font-semibold text-stone-900">{meal.label}</span>
        <span className={`block text-sm ${entry.done ? 'text-leaf-700' : 'text-stone-500'}`}>
          {entry.done ? status : canEdit ? 'Tap to log' : 'Not yet'}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-white transition ${
          entry.done ? 'border-leaf-600 bg-leaf-600' : 'border-stone-300 bg-white'
        }`}
      >
        {entry.done && (
          <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor">
            <path
              d="M5 10.5l3.2 3.2L15 7"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </>
  )

  if (!canEdit) {
    return (
      <div
        className={`${base} ${tone}`}
        aria-label={`${meal.label}: ${entry.done ? 'done' : 'not yet'}`}
      >
        {content}
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={entry.done}
      aria-label={`${meal.label}${entry.done ? `, done ${status.replace('✓', '').trim()}` : ''}`}
      className={`${base} ${tone}`}
    >
      {content}
    </button>
  )
}

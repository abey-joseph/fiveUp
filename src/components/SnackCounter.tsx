import { MAX_SNACKS } from '../lib/dayDoc.ts'

interface Props {
  count: number
  cap: number
  pointsEach: number
  capBonus: number
  canEdit: boolean
  onChange: (count: number) => void
}

export default function SnackCounter({
  count,
  cap,
  pointsEach,
  capBonus,
  canEdit,
  onChange,
}: Props) {
  const maxed = count >= cap
  const btn =
    'flex size-11 items-center justify-center rounded-full bg-brand-50 text-2xl font-semibold text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-100 disabled:opacity-40'

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-brand-100">
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-full bg-brand-50 text-2xl"
      >
        🍪
      </span>
      <div className="flex-1">
        <p className="font-semibold text-stone-900" id="snacks-label">
          Snacks
        </p>
        <p className={`text-sm ${maxed ? 'text-leaf-700' : 'text-stone-500'}`} aria-live="polite">
          {maxed
            ? 'Snack points maxed'
            : `+${pointsEach} pts each, up to ${cap}${capBonus > 0 ? ` (+${capBonus} bonus)` : ''}`}
        </p>
      </div>
      {canEdit ? (
        <div className="flex items-center gap-2" role="group" aria-labelledby="snacks-label">
          <button
            type="button"
            className={btn}
            aria-label="Remove a snack"
            disabled={count <= 0}
            onClick={() => onChange(count - 1)}
          >
            −
          </button>
          <span className="w-7 text-center text-xl font-bold tabular-nums" aria-live="polite">
            {count}
          </span>
          <button
            type="button"
            className={btn}
            aria-label="Add a snack"
            disabled={count >= MAX_SNACKS}
            onClick={() => onChange(count + 1)}
          >
            +
          </button>
        </div>
      ) : (
        <span className="text-xl font-bold tabular-nums">{count}</span>
      )}
    </div>
  )
}

import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { formatKey } from '../lib/dates.ts'
import type { CalendarCell, DayLevel, MonthSummary } from '../lib/history.ts'
import { MEAL_KEYS } from '../lib/meals.ts'

interface Props {
  summary: MonthSummary
  loading: boolean
  /** Swipe left → +1 (next month), swipe right → -1 (previous month). */
  onSwipe: (direction: 1 | -1) => void
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const LEVEL_STYLES: Record<DayLevel, string> = {
  full: 'bg-leaf-500 text-stone-900',
  most: 'bg-amber-300 text-stone-900',
  some: 'bg-red-200 text-stone-900',
  none: 'bg-stone-200 text-stone-600',
  future: 'text-stone-300',
}

const SWIPE_MIN_PX = 50

function cellLabel(cell: CalendarCell): string {
  const date = formatKey(cell.key, 'EEEE d MMMM')
  const today = cell.isToday ? ' (today)' : ''
  if (cell.level === 'none') return `${date}${today}: no meals logged`
  return `${date}${today}: ${cell.mealsDone} of ${MEAL_KEYS.length} meals, ${cell.score} points`
}

export default function Calendar({ summary, loading, onSwipe }: Props) {
  const touch = useRef<{ x: number; y: number } | null>(null)

  return (
    <div
      onTouchStart={(e) => {
        const t = e.touches[0]
        touch.current = t ? { x: t.clientX, y: t.clientY } : null
      }}
      onTouchEnd={(e) => {
        const start = touch.current
        const t = e.changedTouches[0]
        touch.current = null
        if (!start || !t) return
        const dx = t.clientX - start.x
        const dy = t.clientY - start.y
        if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > 1.5 * Math.abs(dy)) {
          onSwipe(dx < 0 ? 1 : -1)
        }
      }}
    >
      <div className="grid grid-cols-7 gap-1 text-center" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <span
            key={d}
            className="py-1 text-[11px] font-medium tracking-wide text-stone-500 uppercase"
          >
            {d.slice(0, 1)}
          </span>
        ))}
      </div>
      <ol
        className={`grid grid-cols-7 gap-1 transition-opacity ${loading ? 'opacity-60' : ''}`}
        aria-busy={loading}
        aria-label={formatKey(summary.month, 'MMMM yyyy')}
      >
        {summary.leadingBlanks > 0 && (
          <li aria-hidden="true" style={{ gridColumn: `span ${summary.leadingBlanks}` }} />
        )}
        {summary.cells.map((cell) => (
          <li key={cell.key}>
            {cell.level === 'future' ? (
              <span
                className={`flex aspect-square min-h-11 items-center justify-center text-sm ${LEVEL_STYLES.future}`}
                aria-label={`${formatKey(cell.key, 'EEEE d MMMM')}: future`}
              >
                {cell.dayOfMonth}
              </span>
            ) : (
              <Link
                to={cell.isToday ? '/' : `/?date=${cell.key}`}
                aria-label={cellLabel(cell)}
                className={`flex aspect-square min-h-11 flex-col items-center justify-center rounded-xl leading-tight hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                  LEVEL_STYLES[cell.level]
                } ${cell.isToday ? 'ring-2 ring-brand-600 ring-offset-2 ring-offset-brand-50' : ''}`}
              >
                <span className="text-sm font-semibold tabular-nums">{cell.dayOfMonth}</span>
                {cell.score > 0 && (
                  <span className="text-[10px] font-medium tabular-nums opacity-75">
                    {cell.score}
                  </span>
                )}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

const LEGEND: { level: DayLevel; label: string }[] = [
  { level: 'full', label: `All ${MEAL_KEYS.length} meals` },
  { level: 'most', label: '3–4 meals' },
  { level: 'some', label: '1–2 meals' },
  { level: 'none', label: 'No meals' },
]

export function CalendarLegend() {
  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-stone-600">
      {LEGEND.map((item) => (
        <li key={item.level} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-3 rounded ${LEVEL_STYLES[item.level]}`} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

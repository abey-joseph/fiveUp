import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import Calendar, { CalendarLegend } from '../components/Calendar.tsx'
import { useStreakDays } from '../hooks/useDayRange.ts'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { useNow } from '../hooks/useNow.ts'
import { endOfMonthKey, formatKey, startOfMonthKey, todayKey } from '../lib/dates.ts'
import { monthParam, resolveMonthParam, shiftMonth, summarizeMonth } from '../lib/history.ts'
import { useSession } from '../lib/session.ts'
import type { DateKey } from '../lib/types.ts'

export default function History() {
  useDocumentTitle('History')
  const { settings, trackerId } = useSession()
  const now = useNow()
  const today = todayKey(settings.timezone, now)
  const currentMonth = startOfMonthKey(today)
  const [params, setParams] = useSearchParams()
  const month = resolveMonthParam(params.get('month'), today)
  const isCurrent = month === currentMonth

  // Only this month is shown, but streak bonuses need the full-day run leading into it.
  const monthEnd = endOfMonthKey(month)
  const { days, loaded, error } = useStreakDays(
    trackerId,
    monthEnd < today ? monthEnd : today,
    month,
  )
  const summary = useMemo(
    () => summarizeMonth(month, days, settings, today),
    [month, days, settings, today],
  )

  function goTo(m: DateKey) {
    setParams(m === currentMonth ? {} : { month: monthParam(m) }, { replace: true })
  }

  const arrow =
    'flex size-11 items-center justify-center rounded-full text-xl text-stone-700 hover:bg-brand-100 disabled:opacity-30 disabled:hover:bg-transparent'

  return (
    <section className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between">
          <button
            type="button"
            className={arrow}
            aria-label="Previous month"
            onClick={() => goTo(shiftMonth(month, -1, today))}
          >
            ‹
          </button>
          <h1 className="text-xl font-bold text-stone-900" aria-live="polite">
            {formatKey(month, 'MMMM yyyy')}
          </h1>
          <button
            type="button"
            className={arrow}
            aria-label="Next month"
            disabled={isCurrent}
            onClick={() => goTo(shiftMonth(month, 1, today))}
          >
            ›
          </button>
        </div>
        {!isCurrent && (
          <div className="mt-1 flex justify-center">
            <button
              type="button"
              onClick={() => goTo(currentMonth)}
              className="min-h-11 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800"
            >
              Back to this month
            </button>
          </div>
        )}
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
          Couldn't load this month: {error}
        </p>
      ) : (
        <>
          <Calendar
            summary={summary}
            loading={!loaded}
            onSwipe={(dir) => {
              if (dir === -1 || !isCurrent) goTo(shiftMonth(month, dir, today))
            }}
          />
          <CalendarLegend />
          <dl className="grid grid-cols-2 gap-2 text-center" aria-busy={!loaded}>
            <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-brand-100">
              <dt className="text-xs font-medium tracking-wide text-stone-500 uppercase">
                Month total
              </dt>
              <dd className="text-2xl font-bold tabular-nums text-stone-900">
                {summary.totalScore}
                <span className="ml-1 text-sm font-medium text-stone-500">pts</span>
              </dd>
            </div>
            <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-brand-100">
              <dt className="text-xs font-medium tracking-wide text-stone-500 uppercase">
                Full days
              </dt>
              <dd className="text-2xl font-bold tabular-nums text-leaf-700">{summary.fullDays}</dd>
            </div>
          </dl>
          <p className="text-center text-sm text-stone-600">
            {loaded && !summary.cells.some((c) => c.mealsDone > 0)
              ? `No meals logged in ${formatKey(month, 'MMMM')}${isCurrent ? ' yet' : ''}.`
              : 'Tap a day to open it.'}
          </p>
        </>
      )}
    </section>
  )
}

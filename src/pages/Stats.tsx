import { useMemo, type ReactNode } from 'react'
import BarChart from '../components/BarChart.tsx'
import { useStreakDays } from '../hooks/useDayRange.ts'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { useNow } from '../hooks/useNow.ts'
import { formatKey, todayKey } from '../lib/dates.ts'
import { maxDailyScore, mealsDone } from '../lib/scoring.ts'
import { useSession } from '../lib/session.ts'
import { CHART_DAYS, computeStats } from '../lib/stats.ts'

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-brand-100">
      <h2 className="text-xs font-medium tracking-wide text-stone-500 uppercase">{title}</h2>
      {children}
    </section>
  )
}

const oneDecimal = (n: number) => String(Math.round(n * 10) / 10)
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

export default function Stats() {
  useDocumentTitle('Stats')
  const { settings, tracker, trackerId, canEdit } = useSession()
  const now = useNow()
  const today = todayKey(settings.timezone, now)
  const range = useStreakDays(trackerId, today)
  const stats = useMemo(
    () => computeStats(range.days, settings, today, range.from),
    [range.days, settings, today, range.from],
  )
  const { currentStreak: streak, week, mostMissed } = stats
  const loggedDays = Object.values(range.days).filter(
    (d) => mealsDone(d) > 0 || (d?.snacks ?? 0) > 0,
  )
  const firstLoad = !range.loaded && Object.keys(range.days).length === 0
  const title = <h1 className="text-xl font-bold text-stone-900">Stats</h1>

  if (range.error) {
    return (
      <div className="flex flex-col gap-3">
        {title}
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
          Couldn't load stats: {range.error}
        </p>
      </div>
    )
  }

  if (firstLoad) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {title}
        <p className="sr-only" role="status">
          Loading stats…
        </p>
        {[24, 28, 56, 16].map((h, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="animate-pulse rounded-2xl bg-white ring-1 ring-brand-100"
            style={{ height: `${h * 4}px` }}
          />
        ))}
      </div>
    )
  }

  if (range.loaded && loggedDays.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {title}
        <Card title="No stats yet">
          <p className="mt-1 text-stone-700">
            {canEdit
              ? 'No meals logged yet — log your first meal on Today and your stats start here.'
              : `No meals logged yet — stats appear once ${tracker.writerName} logs her first meal.`}
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3" aria-busy={!range.loaded}>
      {title}

      <div className="grid grid-cols-2 gap-3">
        <Card title="Current streak">
          <p className="mt-1 text-3xl font-bold tabular-nums text-stone-900">
            {streak.days > 0 && <span aria-hidden="true">🔥 </span>}
            {streak.days}
            <span className="ml-1 text-sm font-medium text-stone-500">
              {streak.days === 1 ? 'day' : 'days'}
            </span>
          </p>
          {streak.pending && (
            <p className="mt-1 text-xs text-stone-600">
              {canEdit ? 'Finish today to keep it going' : 'Still going today'}
            </p>
          )}
        </Card>
        <Card title="Best streak">
          <p className="mt-1 text-3xl font-bold tabular-nums text-stone-900">
            {stats.bestStreak}
            <span className="ml-1 text-sm font-medium text-stone-500">
              {stats.bestStreak === 1 ? 'day' : 'days'}
            </span>
          </p>
          <p className="mt-1 text-xs text-stone-500">In the last {stats.bestStreakWindow} days</p>
        </Card>
      </div>

      <Card title="This week">
        <p className="mt-0.5 text-xs text-stone-500">
          {week.daysSoFar === 1
            ? 'Monday (today)'
            : `${formatKey(week.from, 'EEE d MMM')} – today · ${days(week.daysSoFar)}`}
        </p>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <dt className="text-xs text-stone-500">Avg score</dt>
            <dd className="text-2xl font-bold tabular-nums text-stone-900">
              {oneDecimal(week.avgScore)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Avg meals</dt>
            <dd className="text-2xl font-bold tabular-nums text-stone-900">
              {oneDecimal(week.avgMeals)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Snacks</dt>
            <dd className="text-2xl font-bold tabular-nums text-stone-900">{week.snacks}</dd>
          </div>
        </dl>
      </Card>

      <Card title={`Daily score · last ${CHART_DAYS} days`}>
        <div className="mt-10">
          <BarChart data={stats.last14} max={maxDailyScore(settings)} today={today} />
        </div>
        <p className="mt-1 text-xs text-stone-500">
          <span className="font-bold text-leaf-700" aria-hidden="true">
            ✓
          </span>{' '}
          full day · tap a bar for details
        </p>
      </Card>

      <Card title={`Most missed · last ${CHART_DAYS} days`}>
        {mostMissed ? (
          <p className="mt-1 text-stone-800">
            <span className="font-semibold">
              {mostMissed.meals.length === 1 && (
                <span aria-hidden="true">{mostMissed.meals[0]!.icon} </span>
              )}
              {mostMissed.meals.map((m) => m.label).join(' & ')}
            </span>{' '}
            — {mostMissed.meals.length > 1 ? 'each ' : ''}missed {mostMissed.missed} of{' '}
            {mostMissed.outOf} days
          </p>
        ) : (
          <p className="mt-1 text-stone-800">No missed meals — every meal, every day 🎉</p>
        )}
      </Card>
    </div>
  )
}

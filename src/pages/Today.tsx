import { useCallback, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Celebration from '../components/Celebration.tsx'
import DateSwitcher from '../components/DateSwitcher.tsx'
import MealTile from '../components/MealTile.tsx'
import NoteField from '../components/NoteField.tsx'
import ScoreRing from '../components/ScoreRing.tsx'
import SnackCounter from '../components/SnackCounter.tsx'
import Toast, { type ToastData } from '../components/Toast.tsx'
import { useDay } from '../hooks/useDay.ts'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { useStreakDays } from '../hooks/useDayRange.ts'
import { useNow } from '../hooks/useNow.ts'
import {
  formatDateTimeInTz,
  formatKey,
  isValidDateKey,
  todayKey,
  tzShortLabel,
} from '../lib/dates.ts'
import { toggleMeal, withMeal, withNote, withSnacks } from '../lib/dayDoc.ts'
import { emptyDay } from '../lib/defaultSettings.ts'
import { MEALS } from '../lib/meals.ts'
import {
  computeDayScore,
  displayStreak,
  isFullDay,
  maxDailyScore,
  mealsDone,
} from '../lib/scoring.ts'
import { useSession } from '../lib/session.ts'
import type { DateKey, DayMap } from '../lib/types.ts'

/** `?date=` from the URL, clamped to a valid, non-future tracker-timezone date. */
function resolveSelected(param: string | null, today: DateKey): DateKey {
  if (!param || !isValidDateKey(param) || param > today) return today
  return param
}

export default function Today() {
  const { settings, tracker, trackerId, canEdit } = useSession()
  const tz = settings.timezone
  const now = useNow()
  const today = todayKey(tz, now)
  const [params, setParams] = useSearchParams()
  const selected = resolveSelected(params.get('date'), today)
  useDocumentTitle(selected === today ? 'Today' : formatKey(selected, 'EEE d MMM'))

  const [toast, setToast] = useState<ToastData | null>(null)
  const toastSeq = useRef(0)
  const dismissToast = useCallback(() => setToast(null), [])
  const showError = useCallback(
    (message: string) => setToast({ id: ++toastSeq.current, message, tone: 'error' }),
    [],
  )

  const { day: stored, loaded, update } = useDay(trackerId, selected, showError)
  const { days: rangeDays } = useStreakDays(trackerId, selected)
  const day = stored ?? emptyDay()

  // The selected day from useDay (includes optimistic changes) overrides the range copy.
  const days = useMemo<DayMap>(
    () => ({ ...rangeDays, [selected]: stored }),
    [rangeDays, selected, stored],
  )
  const score = computeDayScore(selected, days, settings)
  const streak = displayStreak(days, selected, today)
  const full = isFullDay(day)
  const max = maxDailyScore(settings)

  // Celebrate when the selected day turns full (from her tap or a live update for the viewer).
  const [seen, setSeen] = useState<{ key: DateKey; full: boolean } | null>(null)
  const [celebration, setCelebration] = useState(0)
  if (loaded && (seen?.key !== selected || seen.full !== full)) {
    if (seen?.key === selected && !seen.full && full) setCelebration((c) => c + 1)
    setSeen({ key: selected, full })
  }

  function goTo(key: DateKey) {
    setParams(key === today ? {} : { date: key }, { replace: true })
  }

  function onToggleMeal(meal: (typeof MEALS)[number]) {
    const previous = day.meals[meal.key]
    update((d) => toggleMeal(d, meal.key, new Date()))
    setToast({
      id: ++toastSeq.current,
      message: previous.done ? `${meal.label} unticked` : `${meal.label} logged`,
      action: { label: 'Undo', onClick: () => update((d) => withMeal(d, meal.key, previous)) },
    })
  }

  const noMeals = loaded && mealsDone(day) === 0

  return (
    <section className="flex flex-col gap-4">
      <h1 className="sr-only">
        {selected === today ? 'Today' : formatKey(selected, 'EEEE d MMMM yyyy')}
      </h1>
      {!canEdit && (
        <div className="rounded-2xl bg-brand-100/70 px-4 py-2 text-center text-sm text-brand-700">
          <p className="font-semibold">Viewing {tracker.writerName}'s tracker</p>
          <p>
            Her time: {formatDateTimeInTz(now, tz)} ({tzShortLabel(tz)})
          </p>
        </div>
      )}

      <DateSwitcher selected={selected} today={today} onChange={goTo} />

      <div className="relative">
        <ScoreRing score={score} max={max} full={full} />
        {celebration > 0 && <Celebration key={celebration} onDone={() => setCelebration(0)} />}
      </div>

      {streak.days > 0 && (
        <p className="text-center text-sm font-semibold text-brand-700">
          🔥 {streak.days}-day streak
          {streak.pending && (
            <span className="font-normal text-stone-600">
              {' '}
              · {canEdit ? 'finish today to keep it going' : 'still going today'}
            </span>
          )}
        </p>
      )}

      {noMeals && (
        <p className="text-center text-sm text-stone-600">
          {canEdit
            ? 'No meals logged yet — tap a meal to start'
            : selected === today
              ? 'No meals logged yet today.'
              : 'No meals logged this day.'}
        </p>
      )}

      {/* Controls wait for the day to load: edits build on the stored day (see useDay). */}
      <div
        className={`flex flex-col gap-4 transition-opacity ${loaded ? '' : 'pointer-events-none animate-pulse opacity-60'}`}
        aria-busy={!loaded}
      >
        <ul className="flex flex-col gap-2">
          {MEALS.map((meal) => (
            <li key={meal.key}>
              <MealTile
                meal={meal}
                entry={day.meals[meal.key]}
                timezone={tz}
                canEdit={canEdit}
                onToggle={() => onToggleMeal(meal)}
              />
            </li>
          ))}
        </ul>

        <SnackCounter
          count={day.snacks}
          cap={settings.snackCap}
          pointsEach={settings.snackPoints}
          capBonus={settings.snackCapBonus}
          canEdit={canEdit}
          onChange={(n) => update((d) => withSnacks(d, n))}
        />

        <NoteField
          key={selected}
          value={day.note}
          canEdit={canEdit}
          onSave={(note) => update((d) => withNote(d, note))}
        />
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />
    </section>
  )
}

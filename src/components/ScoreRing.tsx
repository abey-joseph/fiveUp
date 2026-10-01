import type { DayScore } from '../lib/scoring.ts'

interface Props {
  score: DayScore
  max: number
  full: boolean
}

const SIZE = 168
const STROKE = 14
const R = (SIZE - STROKE) / 2
const CIRC = 2 * Math.PI * R

export default function ScoreRing({ score, max, full }: Props) {
  const pct = max > 0 ? Math.min(1, score.total / max) : 0
  const parts = [
    { label: 'Meals', value: score.mealPoints },
    { label: 'Snacks', value: score.snackPoints },
    { label: 'Full day', value: score.fullDayBonus, bonus: true },
    { label: 'Streak', value: score.streakBonus, bonus: true },
  ]

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative"
        role="img"
        aria-label={`Score ${score.total} out of ${max}`}
        style={{ width: SIZE, height: SIZE }}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-brand-100"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - pct)}
            className={`transition-[stroke-dashoffset,stroke] duration-500 ease-out ${
              full ? 'stroke-leaf-600' : 'stroke-brand-600'
            }`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold tabular-nums text-stone-900">{score.total}</span>
          <span className="text-sm text-stone-500">of {max} pts</span>
        </div>
      </div>
      <dl className="mt-3 grid w-full grid-cols-4 gap-2 text-center">
        {parts.map((p) => (
          <div key={p.label} className="rounded-xl bg-white px-1 py-2 ring-1 ring-brand-100">
            <dt className="text-[11px] font-medium tracking-wide text-stone-500 uppercase">
              {p.label}
            </dt>
            <dd
              className={`text-base font-semibold tabular-nums ${
                p.value > 0 ? (p.bonus ? 'text-leaf-700' : 'text-stone-900') : 'text-stone-500'
              }`}
            >
              {p.bonus && p.value > 0 ? `+${p.value}` : p.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

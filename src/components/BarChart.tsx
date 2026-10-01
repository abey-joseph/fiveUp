import { useState } from 'react'
import { formatKey } from '../lib/dates.ts'
import { MEAL_KEYS } from '../lib/meals.ts'
import type { ChartDay } from '../lib/stats.ts'
import type { DateKey } from '../lib/types.ts'

interface Props {
  data: ChartDay[]
  /** Top of the y-axis (the max daily score). */
  max: number
  today: DateKey
}

// Drawn in viewBox units; the SVG scales to the card width (~1:1 on a 390px phone).
const W = 326
const H = 172
const LEFT = 22
const TOP = 16
const BOTTOM = 34
const PLOT_H = H - TOP - BOTTOM
const BAR_W = 14
const R = 4

function ticks(max: number): number[] {
  const step = max > 60 ? 20 : max > 30 ? 10 : 5
  const out: number[] = []
  for (let v = 0; v <= max; v += step) out.push(v)
  return out
}

/** A column with a 4px rounded top and a square base. */
function barPath(x: number, y: number, h: number): string {
  const r = Math.min(R, h, BAR_W / 2)
  const base = y + h
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + BAR_W - r}Q${x + BAR_W},${y} ${x + BAR_W},${y + r}V${base}Z`
}

function describe(d: ChartDay): string {
  return `${d.score} pts, ${d.mealsDone}/${MEAL_KEYS.length} meals${d.full ? ' (full day)' : ''}`
}

export default function BarChart({ data, max, today }: Props) {
  const [active, setActive] = useState<number | null>(null)
  const slot = (W - LEFT) / data.length
  const y = (v: number) => TOP + PLOT_H - (Math.min(v, max) / max) * PLOT_H
  const activeDay = active === null ? null : data[active]
  const activeLeft = active === null ? 0 : ((LEFT + slot * (active + 0.5)) / W) * 100

  return (
    <div className="relative" onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-pan-y select-none"
        role="img"
        aria-label={`Daily score for the last ${data.length} days`}
      >
        {ticks(max).map((t) => (
          <g key={t}>
            <line
              x1={LEFT}
              x2={W}
              y1={y(t)}
              y2={y(t)}
              className={t === 0 ? 'stroke-stone-300' : 'stroke-stone-100'}
              strokeWidth={1}
            />
            <text
              x={LEFT - 6}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              className="fill-stone-500 text-[10px] tabular-nums"
            >
              {t}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = LEFT + slot * (i + 0.5)
          const top = y(d.score)
          const h = TOP + PLOT_H - top
          const isToday = d.key === today
          const dim = active !== null && active !== i
          return (
            <g key={d.key}>
              {h > 0 && (
                <path
                  d={barPath(cx - BAR_W / 2, top, h)}
                  className={`fill-brand-600 transition-opacity ${dim ? 'opacity-40' : ''}`}
                />
              )}
              {d.full && (
                <text
                  x={cx}
                  y={top - 4}
                  textAnchor="middle"
                  className="fill-leaf-700 text-[10px] font-bold"
                  aria-hidden="true"
                >
                  ✓
                </text>
              )}
              <text
                x={cx}
                y={H - BOTTOM + 14}
                textAnchor="middle"
                className={`text-[10px] ${isToday ? 'fill-stone-900 font-bold' : 'fill-stone-500'}`}
              >
                {formatKey(d.key, 'EEEEE')}
              </text>
              <text
                x={cx}
                y={H - BOTTOM + 27}
                textAnchor="middle"
                className={`text-[10px] tabular-nums ${isToday ? 'fill-stone-900 font-bold' : 'fill-stone-500'}`}
              >
                {formatKey(d.key, 'd')}
              </text>
              {/* Hit target: the whole column, much bigger than the bar. */}
              <rect
                x={cx - slot / 2}
                y={0}
                width={slot}
                height={H}
                fill="transparent"
                onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(i)}
                onClick={() => setActive(active === i ? null : i)}
              />
            </g>
          )
        })}
      </svg>

      {activeDay && (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
          style={{ left: `clamp(4.5rem, ${activeLeft}%, calc(100% - 4.5rem))` }}
          role="status"
        >
          <span className="font-semibold">{formatKey(activeDay.key, 'EEE d MMM')}</span> ·{' '}
          <span className="tabular-nums">{activeDay.score} pts</span> ·{' '}
          <span className="tabular-nums">
            {activeDay.mealsDone}/{MEAL_KEYS.length} meals
          </span>
        </div>
      )}

      <div className="sr-only">
        <table>
          <caption>Daily score, last {data.length} days</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key}>
                <th scope="row">{formatKey(d.key, 'EEEE d MMMM')}</th>
                <td>{describe(d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

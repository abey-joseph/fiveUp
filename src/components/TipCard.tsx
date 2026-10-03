import { useState } from 'react'
import { pickTip } from '../lib/tips.ts'

/** A random weight-gain tip, picked once each time the screen opens. */
export default function TipCard() {
  const [tip] = useState(() => pickTip())

  return (
    <aside className="flex min-w-0 flex-1 flex-col gap-1 rounded-2xl bg-white px-3 py-3 ring-1 ring-brand-100">
      <p className="text-[11px] font-medium tracking-wide text-brand-700 uppercase">💡 Tip</p>
      <p className="text-sm leading-snug font-medium text-stone-800">{tip}</p>
    </aside>
  )
}

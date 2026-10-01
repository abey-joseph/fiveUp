import type { CSSProperties } from 'react'

const PIECES = ['🎉', '✨', '🍽️', '⭐', '💚', '✨', '🎉', '⭐', '💚', '✨']

/** A light, CSS-only burst shown when a day becomes full. Mount with a changing `key` to replay. */
export default function Celebration({ onDone }: { onDone: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-visible" aria-hidden="true">
      {PIECES.map((p, i) => {
        const angle = (i / PIECES.length) * 2 * Math.PI
        return (
          <span
            key={i}
            className="celebrate-piece absolute top-1/2 left-1/2 text-2xl"
            style={
              {
                '--dx': `${Math.cos(angle) * 130}px`,
                '--dy': `${Math.sin(angle) * 110}px`,
                animationDelay: `${(i % 3) * 60}ms`,
              } as CSSProperties
            }
          >
            {p}
          </span>
        )
      })}
      <span
        onAnimationEnd={onDone}
        className="celebrate-badge fixed top-[calc(env(safe-area-inset-top)+4.5rem)] left-1/2 z-30 rounded-full bg-leaf-700 px-4 py-1 text-sm font-bold whitespace-nowrap text-white shadow-md"
      >
        Full day! 🎉
      </span>
    </div>
  )
}

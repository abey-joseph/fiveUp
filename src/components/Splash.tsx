import { useEffect, useState } from 'react'
import { useOnline } from '../hooks/useOnline.ts'
import Logo from './Logo.tsx'

/** After this long, the splash explains what may be wrong instead of spinning forever. */
const SLOW_MS = 10_000

export default function Splash({ label = 'Loading…' }: { label?: string }) {
  const [slow, setSlow] = useState(false)
  const online = useOnline()
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), SLOW_MS)
    return () => clearTimeout(id)
  }, [])

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center"
      role="status"
    >
      <div className="animate-pulse">
        <Logo size={72} />
      </div>
      <p className="text-sm text-stone-600">{label}</p>
      {slow && (
        <div className="flex max-w-xs flex-col items-center gap-4">
          <p className="text-sm text-stone-600">
            {online
              ? "This is taking longer than usual — the server isn't responding. Check your internet connection, then try again."
              : "You're offline. Connect to the internet, then try again."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-12 rounded-full bg-brand-700 px-8 font-semibold text-white transition hover:bg-brand-800"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

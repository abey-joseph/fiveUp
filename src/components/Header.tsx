import { useEffect, useRef, useState } from 'react'
import { useSession } from '../lib/session.ts'
import Logo from './Logo.tsx'

export default function Header() {
  const session = useSession()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initial = (session.displayName || session.email || '?').charAt(0).toUpperCase()

  return (
    <header className="flex items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
      <div className="flex items-center gap-2">
        <Logo size={32} />
        <span className="text-lg font-bold text-stone-900">FiveUp</span>
      </div>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-label="Account menu"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex size-11 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-semibold text-brand-700 ring-1 ring-brand-200"
        >
          {session.photoURL ? (
            <img
              src={session.photoURL}
              alt=""
              referrerPolicy="no-referrer"
              className="size-full object-cover"
            />
          ) : (
            initial
          )}
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 z-20 mt-2 w-64 rounded-2xl bg-white p-2 text-sm shadow-lg ring-1 ring-stone-200"
          >
            <div className="px-3 py-2">
              <p className="truncate font-medium text-stone-900">
                {session.displayName ?? session.email}
              </p>
              <p className="truncate text-stone-500">{session.email}</p>
              <p className="mt-1 text-xs text-stone-500">
                {session.role === 'writer' ? 'Tracker (can edit)' : 'Viewer (read-only)'}
              </p>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => void session.signOut()}
              className="min-h-11 w-full rounded-xl px-3 text-left font-medium text-stone-700 hover:bg-stone-100"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

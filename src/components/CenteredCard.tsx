import type { ReactNode } from 'react'
import Logo from './Logo.tsx'

/** Full-screen centered card used by the sign-in, no-access and setup screens. */
export default function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-brand-100">
        <div className="mb-4 flex justify-center">
          <Logo size={64} />
        </div>
        {children}
      </div>
    </div>
  )
}

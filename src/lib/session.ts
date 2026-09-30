import { createContext, useContext } from 'react'
import type { Role, Settings, TrackerDoc } from './types.ts'

export interface Session {
  uid: string
  email: string
  displayName: string | null
  photoURL: string | null
  trackerId: string
  tracker: TrackerDoc
  settings: Settings
  role: Role
  canEdit: boolean
  signOut: () => Promise<void>
}

export const SessionContext = createContext<Session | null>(null)

/** The signed-in user's session. Only available inside the authenticated app shell. */
export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used inside SessionContext')
  return session
}

import { useMemo } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { User } from 'firebase/auth'
import Header from './components/Header.tsx'
import Splash from './components/Splash.tsx'
import TabBar from './components/TabBar.tsx'
import { useAuth } from './hooks/useAuth.ts'
import { useTracker } from './hooks/useTracker.ts'
import { TRACKER_ID, firebaseConfigured } from './lib/firebase.ts'
import { SessionContext, type Session } from './lib/session.ts'
import type { Role, TrackerDoc } from './lib/types.ts'
import ConfigMissing from './pages/ConfigMissing.tsx'
import History from './pages/History.tsx'
import NoAccess from './pages/NoAccess.tsx'
import SignIn from './pages/SignIn.tsx'
import Stats from './pages/Stats.tsx'
import Today from './pages/Today.tsx'

export default function App() {
  if (!firebaseConfigured) return <ConfigMissing />
  return <AuthGate />
}

function AuthGate() {
  const auth = useAuth()
  const tracker = useTracker(auth.user)

  if (auth.loading) return <Splash />
  if (!auth.user) return <SignIn onSignIn={auth.signIn} error={auth.error} />
  if (tracker.status === 'loading') return <Splash label="Loading your tracker…" />
  if (tracker.status === 'no-access' || tracker.status === 'error') {
    return (
      <NoAccess
        email={auth.user.email}
        onSignOut={auth.signOut}
        errorMessage={tracker.status === 'error' ? tracker.message : undefined}
      />
    )
  }
  return (
    <SignedInApp
      user={auth.user}
      tracker={tracker.tracker}
      role={tracker.role}
      signOut={auth.signOut}
    />
  )
}

interface SignedInProps {
  user: User
  tracker: TrackerDoc
  role: Role
  signOut: () => Promise<void>
}

function SignedInApp({ user, tracker, role, signOut }: SignedInProps) {
  const session = useMemo<Session>(
    () => ({
      uid: user.uid,
      email: user.email ?? '',
      displayName: user.displayName,
      photoURL: user.photoURL,
      trackerId: TRACKER_ID,
      tracker,
      settings: tracker.settings,
      role,
      canEdit: role === 'writer',
      signOut,
    }),
    [user, tracker, role, signOut],
  )

  return (
    <SessionContext.Provider value={session}>
      <div className="mx-auto flex min-h-dvh max-w-md flex-col">
        <Header />
        <main className="flex-1 px-4 pb-24">
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/history" element={<History />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <TabBar />
      </div>
    </SessionContext.Provider>
  )
}

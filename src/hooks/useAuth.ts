import { useCallback, useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { getFirebaseAuth } from '../lib/firebase.ts'

export interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

/** Errors where the popup can't work and a full-page redirect should be tried instead. */
const POPUP_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
])

/** Errors that just mean the user closed the popup — not worth showing. */
const SILENT_CODES = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])

function errorCode(e: unknown): string {
  return typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : ''
}

function friendlyError(e: unknown): string {
  const code = errorCode(e)
  if (code === 'auth/network-request-failed') return "Couldn't reach Google. Check your connection."
  if (code === 'auth/unauthorized-domain') return 'This domain is not authorised for sign-in yet.'
  return 'Sign-in failed. Please try again.'
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const auth = getFirebaseAuth()
    // Surfaces errors from a previous signInWithRedirect round-trip.
    getRedirectResult(auth).catch((e: unknown) => setError(friendlyError(e)))
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const signIn = useCallback(async () => {
    setError(null)
    const auth = getFirebaseAuth()
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    try {
      await signInWithPopup(auth, provider)
    } catch (e) {
      const code = errorCode(e)
      if (POPUP_FALLBACK_CODES.has(code)) {
        await signInWithRedirect(auth, provider)
        return
      }
      if (!SILENT_CODES.has(code)) setError(friendlyError(e))
    }
  }, [])

  const signOut = useCallback(async () => {
    await fbSignOut(getFirebaseAuth())
  }, [])

  return { user, loading, error, signIn, signOut }
}

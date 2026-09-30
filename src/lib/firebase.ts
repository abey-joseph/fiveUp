import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  signInWithCredential,
  type Auth,
} from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

const env = import.meta.env

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

export const TRACKER_ID: string = env.VITE_TRACKER_ID || 'main'

const useEmulators = env.VITE_USE_FIREBASE_EMULATORS === 'true'

/** False when `.env.local` hasn't been filled in; the app shows setup instructions instead. */
export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId)

let app: FirebaseApp | undefined
let auth: Auth | undefined
let db: Firestore | undefined

if (firebaseConfigured) {
  app = initializeApp(config)
  auth = getAuth(app)
  // Offline persistence: reads come from the local cache when offline and writes are queued.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
  if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
    if (import.meta.env.DEV) exposeEmulatorSignIn(auth)
  }
}

/**
 * Dev + emulator only: `await __emulatorSignIn('writer@example.com')` in the console signs in
 * with a fake Google credential (the Auth emulator accepts unsigned tokens). Handy for automated
 * UI checks where the Google popup can't load. Stripped from production builds.
 */
function exposeEmulatorSignIn(a: Auth) {
  Object.assign(window, {
    __emulatorSignIn: (email: string, name = email.split('@')[0]) =>
      signInWithCredential(
        a,
        GoogleAuthProvider.credential(
          JSON.stringify({ sub: email, email, email_verified: true, name }),
        ),
      ),
  })
}

function required<T>(value: T | undefined, name: string): T {
  if (!value) throw new Error(`Firebase ${name} used before configuration (see .env.example)`)
  return value
}

export function getFirebaseAuth(): Auth {
  return required(auth, 'Auth')
}

export function getDb(): Firestore {
  return required(db, 'Firestore')
}

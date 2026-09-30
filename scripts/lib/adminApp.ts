/**
 * Initialises the Firebase Admin SDK for scripts. Credentials, in order:
 *  1. FIREBASE_SERVICE_ACCOUNT — the service-account JSON, raw or base64-encoded
 *  2. GOOGLE_APPLICATION_CREDENTIALS — path to the service-account JSON file
 *  3. FIRESTORE_EMULATOR_HOST set — no credentials, talks to the local emulator only
 * The key is only held in memory and never printed.
 */
import { applicationDefault, cert, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

interface ServiceAccountJson {
  project_id: string
  client_email: string
  private_key: string
}

function parseServiceAccount(raw: string): ServiceAccountJson {
  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw.trim(), 'base64').toString('utf8')
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is neither valid JSON nor base64-encoded JSON.')
  }
  const sa = json as Partial<ServiceAccountJson>
  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is missing project_id, client_email or private_key.')
  }
  return sa as ServiceAccountJson
}

export function initAdmin(): { app: App; db: Firestore; projectId: string } {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  let app: App
  let projectId: string
  if (raw) {
    const sa = parseServiceAccount(raw)
    projectId = sa.project_id
    app = initializeApp({
      credential: cert({
        projectId: sa.project_id,
        clientEmail: sa.client_email,
        privateKey: sa.private_key,
      }),
      projectId,
    })
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    projectId = process.env.GCLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || ''
    app = initializeApp({ credential: applicationDefault(), ...(projectId ? { projectId } : {}) })
    projectId ||= app.options.projectId ?? '(from credentials)'
  } else if (process.env.FIRESTORE_EMULATOR_HOST) {
    projectId = process.env.GCLOUD_PROJECT || 'demo-fiveup'
    app = initializeApp({ projectId })
  } else {
    throw new Error(
      'No credentials: set FIREBASE_SERVICE_ACCOUNT (JSON or base64) or GOOGLE_APPLICATION_CREDENTIALS.',
    )
  }
  if (process.env.FIRESTORE_EMULATOR_HOST)
    projectId += ` (emulator ${process.env.FIRESTORE_EMULATOR_HOST})`
  return { app, db: getFirestore(app), projectId }
}

/** Minimal `--flag value` / `--switch` parser for scripts. */
export function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (!a.startsWith('--')) throw new Error(`Unexpected argument: ${a}`)
    const next = argv[i + 1]
    if (next !== undefined && !next.startsWith('--')) {
      out[a.slice(2)] = next
      i++
    } else {
      out[a.slice(2)] = true
    }
  }
  return out
}

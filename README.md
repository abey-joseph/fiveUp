# FiveUp

A tiny meal-tracking PWA for two people: one **tracker** logs five meals a day (plus snacks), one
**viewer** follows along read-only. Points and streaks keep things motivating.

Built with React 18 + Vite + TypeScript, Tailwind CSS, React Router, and Firebase (Auth, Firestore,
Hosting — free Spark plan only; no Cloud Functions or Storage).

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in your Firebase web config
npm run dev
```

## Scripts

| Command                 | What it does                                  |
| ----------------------- | --------------------------------------------- |
| `npm run dev`           | Start the dev server                          |
| `npm run build`         | Type-check and build for production (`dist/`) |
| `npm run preview`       | Serve the production build locally            |
| `npm test`              | Run unit tests (Vitest)                       |
| `npm run test:rules`    | Run Firestore security-rules tests (emulator) |
| `npm run emulators`     | Start the Auth + Firestore emulators          |
| `npm run seed:emulator` | Create a demo tracker doc in the emulator     |
| `npm run dev:emulator`  | Run the app against the emulators             |
| `npm run lint`          | Lint with ESLint                              |
| `npm run format`        | Format with Prettier                          |
| `npm run icons`         | Regenerate PWA icons from `public/logo.svg`   |

Admin scripts (need a service account, see below): `scripts/create-tracker.ts` creates the
tracker document; `scripts/import-days.ts` imports past days from a CSV.

## Firebase setup

1. **Create a project** at <https://console.firebase.google.com/> (the free Spark plan is enough).
2. **Authentication** → Get started → Sign-in method → enable **Google**.
3. **Firestore Database** → Create database (production mode).
4. **Register a web app** (Project settings → General → Your apps → `</>`). Copy the config values
   into `.env.local` (see `.env.example`). These web config values are public identifiers, not
   secrets, but `.env.local` is gitignored anyway.
   - Set `VITE_FIREBASE_AUTH_DOMAIN` to the domain that serves the app (e.g.
     `your-project.web.app` once deployed, or `your-project.firebaseapp.com`). Using the same
     domain as the app keeps the sign-in redirect working in Safari / iOS PWAs.
5. **Authorised domains** (Authentication → Settings) must include every domain you open the app
   on. `localhost`, `*.web.app` and `*.firebaseapp.com` for your project are there by default.
6. **Create the tracker document** — follow [`scripts/seed-tracker.md`](scripts/seed-tracker.md).
7. Put your project ID in [`.firebaserc`](.firebaserc) (replace `your-firebase-project-id`).

### Roles

After Google sign-in the app reads `trackers/main`:

- email = `writerEmail` → **tracker** (can edit)
- email in `viewerEmails` → **viewer** (read-only)
- anything else → "You don't have access" screen. The security rules enforce the same thing
  server-side, so other accounts can't read data even with their own client.

### Security rules

[`firestore.rules`](firestore.rules) is tested against the Firestore emulator (requires Java 11+):

```bash
npm run test:rules
```

### Local development with emulators

No real Firebase project needed:

```bash
npm run emulators        # terminal 1: Auth + Firestore emulators (UI at http://localhost:4000)
npm run seed:emulator    # terminal 2: creates trackers/main with demo emails
npm run dev:emulator     # terminal 2: app at http://localhost:5173
```

Sign in with the emulator's fake Google popup as `writer@example.com` (tracker),
`viewer@example.com` (viewer) or any other email (no access).

## Importing past data

History from before the app (18–30 Sep 2026) is loaded once with an admin script, so streaks,
the History calendar and Stats continue from it. The viewer stays read-only — the script uses the
Firebase Admin SDK, which bypasses security rules, and writes documents in exactly the app's
format (meals with `at: null`, no extra fields), so the tracker can still edit those days.

1. **Credentials:** a service-account key for the project (Firebase console → Project settings →
   Service accounts → Generate new private key). Provide it as `FIREBASE_SERVICE_ACCOUNT` (the
   JSON, raw or base64) or `GOOGLE_APPLICATION_CREDENTIALS` (path to the file). Never commit it.
2. **CSV:** copy [`data/backfill-template.csv`](data/backfill-template.csv) to e.g.
   `data/backfill-sep-2026.csv` (every `data/*.csv` except the template is gitignored):

   ```csv
   date,breakfast,brunch,lunch,evening,dinner,snacks,note
   2026-09-18,1,1,1,0,1,2,
   2026-09-19,1,0,1,1,1,0,"skipped brunch, busy day"
   ```

   - `date`: `yyyy-MM-dd` in the tracker timezone; not in the future, no duplicates.
   - Meals: `1`/`0`, `y`/`n`, `yes`/`no`, `true`/`false`; blank = no.
   - `snacks`: whole number 0–10, blank = 0. `note`: optional, ≤ 300 characters, quote it if it
     contains commas. The `snacks` and `note` columns may be left out.

3. **Dry run** (the default) — validates every row and prints each day's meals, score and streak
   using the app's scoring code. If any row is invalid, all problems are listed and nothing runs.

   ```bash
   npx tsx scripts/import-days.ts --file data/backfill-sep-2026.csv
   ```

4. **Write** once the dry run looks right:

   ```bash
   npx tsx scripts/import-days.ts --file data/backfill-sep-2026.csv --commit
   ```

Days that already exist in Firestore (e.g. logged in the app) are **skipped and reported**, never
overwritten, unless you pass `--overwrite`. Other options: `--tracker <id>` (default `main`).
To try it locally first, run it against the emulator with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`
and `FIREBASE_SERVICE_ACCOUNT` unset.

## Deploy

_TODO (stage 9)._

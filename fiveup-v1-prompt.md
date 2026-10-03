# FiveUp — v1 Build Spec

> **This file is the single source of truth for FiveUp v1.** Any change request is applied here
> first, then implemented. Current revision: **v1 + Change Request 3** (CR1: tracker timezone,
> one-time backfill importer; CR2: +1 snack bonus at 3 snacks, so snacks max out at 10 and the
> max daily score is 75; CR3: random weight-gain tip beside the score ring on Today).

You are building **FiveUp**, a small meal-tracking web app (PWA) for two people. Read this whole
spec before writing code. Work in the stages listed under "Build order", commit after each stage,
and stop to report at the end of each stage with what was done and anything the owner needs to do
manually.

---

## 1. Purpose

The tracker (the writer) is trying to **eat more**. Her target is 5 meals a day plus optional
snacks. She logs her meals in the app; the viewer can see her progress but cannot edit anything. A
points score and streaks keep her motivated.

- **Tracker (writer):** logs meals and snacks, can edit any past day. Lives in **New Zealand**.
- **Viewer (read-only):** sees everything, cannot change anything. Lives in **Singapore**.

**The writer's day is what counts.** All dates are in the _tracker timezone_ (section 4.1).

---

## 2. Tech stack (use exactly this)

- **Frontend:** React 18 + Vite + TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Routing:** React Router
- **Backend:** Firebase (free Spark plan only)
  - Firebase Auth — Google sign-in only
  - Cloud Firestore — with offline persistence (`persistentLocalCache`)
  - Firebase Hosting
- **PWA:** `vite-plugin-pwa` (manifest + service worker, installable via "Add to Home Screen")
- **Dates:** `date-fns` + `date-fns-tz`
- **Tests:** Vitest
- **Admin scripts:** Node + TypeScript run with `tsx`, using the Firebase Admin SDK (section 13)

**Hard constraints (Spark plan):**

- Do **NOT** use Cloud Functions, Cloud Storage, or any paid Firebase service.
- All score calculation happens on the client (and in admin scripts, using the same module).

---

## 3. Meals and scoring

### Meals (fixed order)

| Key         | Label     | Points |
| ----------- | --------- | ------ |
| `breakfast` | Breakfast | 10     |
| `brunch`    | Brunch    | 10     |
| `lunch`     | Lunch     | 10     |
| `evening`   | Evening   | 10     |
| `dinner`    | Dinner    | 10     |

### Snacks

- 3 points per snack.
- **Points are capped at 3 snacks per day.**
- **Snack bonus:** +1 when she reaches the cap (3 or more snacks), rounding snacks off to
  **max 10 pts** (3 × 3 + 1). The bonus is part of the snack points in the score breakdown.
- She may log more than 3 snacks (UI counter goes up to 10) — extra snacks are recorded but earn no
  points. Show a small hint like "Snack points maxed" once she passes 3.

### Bonuses

- **Full-day bonus:** +10 if all 5 meals are done that day.
- **Streak:** a day's streak = number of consecutive _full days_ (all 5 meals) ending on that day,
  counting backwards. A day that is not full has streak 0.
- **Streak bonus:** +5 on a full day whose streak is **≥ 3**.

### Maximum daily score

`50 (meals) + 10 (snacks, incl. +1 snack bonus) + 10 (full-day) + 5 (streak) = 75`

### Implementation rules

- Put all scoring in a **pure module** `src/lib/scoring.ts` with no Firebase imports. Suggested API:
  ```ts
  computeDayBaseScore(day: DayDoc, settings: Settings): number   // meals + snacks + full-day bonus
  isFullDay(day: DayDoc): boolean
  computeStreaks(days: Record<string, DayDoc>, upTo: string): Record<string, number> // dateKey -> streak
  computeDayScore(dateKey, days, settings): { base, streakBonus, total, streak }
  maxDailyScore(settings): number
  ```
- Point values come from the **settings document** (section 4), not hard-coded constants. Keep the
  defaults above in `src/lib/defaultSettings.ts` as a fallback if the settings doc is missing.
- Write **Vitest unit tests** covering: empty day = 0, all meals, snack cap and snack bonus (2, 3, 5 snacks → 6, 10, 10 pts),
  full-day bonus, streak of 1/2/3/4, streak broken by a non-full day, missing days (no document)
  count as non-full, max score = 75.

---

## 4. Firestore data model

### 4.1 Tracker timezone

- The timezone is a **setting**, not a constant: `trackers/{id}.settings.timezone`, default
  `"Pacific/Auckland"` (also in `defaultSettings.ts`).
- All date keys (`yyyy-MM-dd`), "today", week boundaries (Mon–Sun), month boundaries, streaks and
  "future date" checks use the **tracker timezone** — regardless of the device's timezone. Example:
  when it is 11 pm Wednesday in Singapore it is already Thursday in NZ, and the viewer's app must
  show Thursday as "today".
- Meal times (`at` timestamps) are **displayed in the tracker timezone** too, so "✓ 8:42 am" means
  8:42 am tracker time for both people.
- **Daylight saving:** New Zealand observes DST (NZDT UTC+13 from the last Sunday of September to
  the first Sunday of April, otherwise NZST UTC+12). Always use `date-fns-tz` with the IANA zone
  name — **never a hard-coded offset**.
- `src/lib/dates.ts` takes the timezone as a parameter, e.g. `todayKey(tz, now?)`,
  `toDateKey(date, tz)`, `startOfWeekKey(key)`, `addDaysKey(key, n)`. Date-key arithmetic works on
  the `yyyy-MM-dd` calendar dates, **not** by adding 24 hours to timestamps (that breaks on DST
  days). Never use the device's local timezone or UTC for date keys.
- `dates.test.ts` must cover:
  - Device in Singapore at `2026-10-01T23:30+08:00` → NZ key is `2026-10-02`.
  - NZ DST start `2026-09-27` (2 am → 3 am): the day produces exactly one key;
    `addDaysKey('2026-09-26', 1) === '2026-09-27'`, `addDaysKey('2026-09-27', 1) === '2026-09-28'`.
  - NZ DST end `2027-04-04`: same checks.
  - Week start (Monday) and month boundaries computed in NZ time.
  - "Future date" check: a date that is today in NZ but tomorrow in Singapore terms is not
    rejected, and the reverse case is handled correctly.
  - Changing the `timezone` parameter changes the result.

### 4.2 Documents

```
trackers/{trackerId}                      // one tracker doc; trackerId = "main"
  name: "FiveUp"
  writerName: string                      // optional display name, e.g. "Mia" (falls back to
                                          // the part of writerEmail before "@")
  writerEmail: string                     // the writer's Google email (lowercase)
  viewerEmails: string[]                  // [the viewer's email] (lowercase)
  settings: {
    mealPoints: 10,
    snackPoints: 3,
    snackCap: 3,
    snackCapBonus: 1,                     // extra points once snacks reach snackCap
    fullDayBonus: 10,
    streakBonus: 5,
    streakBonusMinDays: 3,
    timezone: "Pacific/Auckland"
  }

trackers/{trackerId}/days/{yyyy-MM-dd}    // key is a date in the tracker timezone
  meals: {
    breakfast: { done: boolean, at: Timestamp | null },
    brunch:    { done: boolean, at: Timestamp | null },
    lunch:     { done: boolean, at: Timestamp | null },
    evening:   { done: boolean, at: Timestamp | null },
    dinner:    { done: boolean, at: Timestamp | null }
  }
  snacks: number                          // 0–10
  note: string                            // optional, max 300 chars
  updatedAt: Timestamp (serverTimestamp)
```

Notes:

- Store **raw data only** — never store the score. Scores are always derived.
- A day document is created the first time she logs something that day.
- When a meal is ticked in the app, set `at` to the current time; when unticked, set
  `done: false, at: null`.
- `done: true` with `at: null` is **valid** (e.g. imported history, section 13). The UI shows just
  "✓" with no time in that case.
- Use `serverTimestamp()` for `updatedAt`.

---

## 5. Security rules (`firestore.rules`)

Access is controlled by the Google account email stored in the tracker doc.

- **Read** tracker doc and all days: allowed if the signed-in user's email equals `writerEmail` OR
  is in `viewerEmails`, and `email_verified == true`.
- **Write days:** only `writerEmail`. Validate on write:
  - doc ID matches `^\d{4}-\d{2}-\d{2}$`
  - only the fields `meals`, `snacks`, `note`, `updatedAt` are present
  - `snacks` is an int between 0 and 10
  - `note` is a string ≤ 300 chars
  - `meals` has exactly the five keys, each `{ done: bool, at: timestamp | null }` with no other
    fields, and `at == null` whenever `done == false`
  - `updatedAt == request.time` (i.e. written with `serverTimestamp()`)
- **Delete days:** only the writer.
- **Tracker doc (including settings):** read by writer + viewers; **no client writes** in v1 (edited
  in the Firebase console).
- Deny everything else by default.
- The viewer stays strictly read-only. Backfilled history is written by an admin script with the
  Admin SDK (which bypasses rules), so **no rule changes** are needed for it.

Add rules tests with `@firebase/rules-unit-testing` against the Firestore emulator (Java 21 is
available in the build environment): `npm run test:rules`.

For local development the app can run entirely against the Auth + Firestore emulators
(`npm run emulators`, `npm run seed:emulator`, `npm run dev:emulator`).

---

## 6. Screens

Mobile-first (design for ~390px width, must also look fine on desktop). Friendly, clean,
encouraging tone. Bottom tab bar: **Today · History · Stats**.

### 6.1 Sign-in

- "Sign in with Google" button (use `signInWithPopup`, fall back to `signInWithRedirect` if the
  popup is blocked — common on mobile PWAs).
- After sign-in, determine the role from the tracker doc:
  - email == `writerEmail` → **writer mode**
  - email in `viewerEmails` → **viewer mode**
  - otherwise → "You don't have access to this tracker" screen with a sign-out button.
- Show a sign-out option in a small header menu.

### 6.2 Today (default screen)

- Header: the date (e.g. "Thu, 1 Oct") and a date switcher (◀ ▶ arrows + tap to open a date
  picker) so she can go to **any past day** and edit it. Future dates (in the tracker timezone) are
  not allowed. A "Back to today" chip appears when not on today. "Today" is today in the tracker
  timezone. The selected date lives in the URL (`/?date=yyyy-MM-dd`, omitted for today) so
  History can link to a day; invalid or future dates fall back to today.
- **Score ring:** the day's total score out of 75 (`maxDailyScore(settings)`), with the breakdown
  underneath (meals / snacks / bonus / streak bonus).
- **Tip box:** in the same row as the score ring (to its right), a small box with one short
  weight-gain tip (a few words, e.g. "Add a spoon of peanut butter."). Tips are a fixed list in
  `src/lib/tips.ts` (100+ tips); one is picked at random each time the Today screen opens and stays
  the same while switching dates. Shown to both writer and viewer.
- **5 meal tiles** in fixed order. Tap to toggle done. Done tiles show a check and the logged time
  in the tracker timezone (e.g. "✓ 8:42 am"); if `at` is `null`, show just "✓". Show a small toast
  with "Undo" after each toggle.
- **Snack counter:** − / count / + buttons, 0–10, with the "Snack points maxed" hint after 3.
- **Note:** optional one-line text field, saves on blur (debounced).
- **Streak badge:** "🔥 4-day streak" if the current streak > 0. On today, while the day isn't
  full yet, a streak that is still alive (yesterday was full) keeps showing, with "finish today to
  keep it going".
- Celebrate a full day with a light, tasteful animation (no big confetti library — keep the bundle
  small).
- **Viewer mode:** same screen, all controls disabled/hidden, with a small
  "Viewing <writerName>'s tracker" label, and a line showing the tracker's local time, e.g.
  `Her time: Thu 1 Oct, 1:42 am (NZ)`.
- Updates must be **optimistic** (UI changes instantly) and use a real-time Firestore listener
  (`onSnapshot`) so the viewer sees changes live.

### 6.3 History

- Month calendar (swipe or arrows to change month; months in the tracker timezone). Each day cell
  colored by score:
  - Full day (all 5 meals): green
  - 3–4 meals: amber
  - 1–2 meals: light red
  - No data / 0 meals: grey
  - Future days: blank
- Tap a day → open that day on the Today screen (writer can edit; viewer read-only).
- Under the calendar: month total score and number of full days.

### 6.4 Stats

- Current streak and best streak ever.
- This week's (Mon–Sun, tracker timezone) average daily score and average meals per day.
- Bar chart of daily score for the last 14 days (keep it simple — hand-rolled SVG or a lightweight
  library; no heavy chart libraries).
- "Most missed meal" in the last 14 days (e.g. "Brunch — missed 5 of 14 days").
- Snacks logged this week.

### Data loading

- Only query the date range each screen needs (current month for History, last ~60 days for
  Stats/streaks). Don't read the whole collection.
- Streak calculation must look back far enough to be correct: if the streak reaches the edge of the
  loaded range, load further back. In particular, a streak that began during the backfill period
  (from 18 Sep 2026) must be counted correctly on day one of using the app.

---

## 7. Project structure (suggested)

```
src/
  lib/
    firebase.ts          // init, reads config from import.meta.env
    scoring.ts           // pure scoring logic
    scoring.test.ts
    dates.ts             // tracker-timezone date helpers (tz is a parameter)
    dates.test.ts
    defaultSettings.ts
    meals.ts             // single meal-definition config array
    tips.ts              // weight-gain tips + random pick
    types.ts
  hooks/
    useAuth.ts
    useTracker.ts        // tracker doc + role
    useDay.ts            // single day, real-time, optimistic updates
    useDayRange.ts       // range query for history/stats
  pages/
    SignIn.tsx
    Today.tsx
    History.tsx
    Stats.tsx
    NoAccess.tsx
  components/
    ScoreRing.tsx
    TipCard.tsx
    MealTile.tsx
    SnackCounter.tsx
    Calendar.tsx
    BarChart.tsx
    TabBar.tsx
scripts/
  import-days.ts         // admin backfill importer (section 13)
  lib/parseBackfill.ts   // pure CSV parsing + validation
  lib/parseBackfill.test.ts
  seed-tracker.md
data/
  backfill-template.csv  // committed; every other data/*.csv is gitignored
firestore.rules
firestore.indexes.json
firebase.json
.firebaserc
.env.example
README.md
```

---

## 8. Configuration and secrets

- Firebase web config goes in `.env.local` as `VITE_FIREBASE_API_KEY`,
  `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, etc. Commit a
  `.env.example` with empty values; **never commit `.env.local`**.
- Deployment and admin scripts use a **service account key**, provided as a secret in the cloud
  environment: `FIREBASE_SERVICE_ACCOUNT` (the key JSON, raw or base64-encoded — environment
  variables are single-line, so base64 is the easy option) or `GOOGLE_APPLICATION_CREDENTIALS`
  (path to the key file). Scripts load it via `scripts/lib/adminApp.ts`. **Never
  write the key into the repo, logs, or commit history.** `.gitignore` covers `*.json` key
  filenames and `.env*` (except `.env.example`).
- `data/*.csv` except `data/backfill-template.csv` is gitignored — it is personal data.
- Provide a `scripts/seed-tracker.md` (instructions, not code with secrets) explaining how to create
  the `trackers/main` doc in the Firebase console with the two emails and default settings
  (including `timezone`), plus `scripts/create-tracker.ts` to create it with the Admin SDK instead.

---

## 9. PWA

- App name "FiveUp", short name "FiveUp", warm food-friendly theme color (orange `#ea580c`).
- Simple original app icons (192px and 512px, plus maskable) generated from `public/logo.svg`.
- `display: standalone`, portrait orientation.
- Service worker caches the app shell; Firestore offline persistence handles data offline.

---

## 10. Build order (stop and report after each)

1. ~~**Scaffold**~~ ✅ done.
2. **Core logic:** `types.ts`, `dates.ts` (tracker-timezone version, section 4.1),
   `defaultSettings.ts` (with `timezone`), `scoring.ts`, full Vitest coverage (sections 3 and 4.1).
3. **Firebase + auth:** Firebase init from env, Google sign-in, role detection from tracker doc,
   NoAccess screen, `firestore.rules`, `firebase.json`, `.firebaserc` (project ID placeholder),
   rules tests with the emulator.
4. **Today screen:** meal tiles (incl. `at: null` → "✓"), snacks, note, score ring, date switcher,
   optimistic updates, real-time listener, viewer mode incl. "Her time" line.
5. **History screen.**
6. **Stats screen.**
7. **Polish:** loading and error states, empty states ("No meals logged yet — tap a meal to
   start"), accessibility (buttons have labels, good contrast, tap targets ≥ 44px), full-day
   animation, PWA icons.
8. **Backfill importer** (section 13): script, template, parser tests, README section. Stop and
   report; the owner provides the real CSV, a **dry run** is run and its output shown before any
   `--commit`.
9. **Deploy prep and deploy:** README with setup + deploy steps. Run `npm run build` and
   `npm test`. **Do not deploy** until the owner confirms — then deploy with
   `firebase deploy --only hosting,firestore:rules`.

---

## 11. Acceptance criteria for v1

- [ ] Writer can sign in, tick/untick all 5 meals, add/remove snacks, add a note, and edit any past
      day (not future days).
- [ ] Viewer can sign in and see everything live, but cannot change anything (UI disabled **and**
      rules reject writes).
- [ ] Any other Google account sees the NoAccess screen and cannot read data.
- [ ] Scores match the rules in section 3 exactly; max is 75; unit tests pass.
- [ ] Dates are always tracker-timezone dates (default `Pacific/Auckland`), even if the device
      timezone is different, and DST transitions are handled.
- [ ] History calendar and Stats are correct for the loaded data.
- [ ] Backfilled history (18–30 Sep 2026) is in Firestore, and streaks/history/stats continue from
      it.
- [ ] App is installable to the phone home screen and loads fast (production JS bundle ideally
      < 300 KB gzipped).
- [ ] No Cloud Functions, no Cloud Storage, no secrets or personal data in the repo.

---

## 12. Out of scope for v1 (planned later — keep the code easy to extend)

- Reminders / push notifications
- Meal photos
- Editing settings from the UI
- Multiple trackers or more users
- Portion sizes or food details

Design the meal list and settings so these can be added without rewrites (e.g. meal definitions come
from one config array, not repeated across components).

---

## 13. One-time backfill of past data (18 Sep – 30 Sep 2026)

The viewer tracked meals manually from 18 Sep to 30 Sep 2026 (NZ dates). This history must be in
Firestore before the writer starts using the app, so streaks, the history calendar and stats
continue from it.

### Approach: admin import script (not an in-app feature)

The viewer stays strictly read-only in the app and in the rules. A Node/TypeScript script uses the
Firebase Admin SDK with the service account from `GOOGLE_APPLICATION_CREDENTIALS`.

### Files

- `scripts/import-days.ts` — the importer (`npx tsx scripts/import-days.ts ...`)
- `scripts/lib/parseBackfill.ts` — pure CSV parsing + validation (no Firebase), unit-tested
- `data/backfill-template.csv` — header + example rows
- README section "Importing past data"

### CSV format

```
date,breakfast,brunch,lunch,evening,dinner,snacks,note
2026-09-18,1,1,1,0,1,2,
2026-09-19,1,0,1,1,1,0,skipped brunch
```

- `date`: `yyyy-MM-dd` in the tracker timezone.
- Meal columns: `1`/`0` (also `y`/`n`, `yes`/`no`, `true`/`false`; blank = 0).
- `snacks`: integer 0–10 (blank = 0).
- `note`: optional, ≤ 300 chars, may be quoted and contain commas.

### Behaviour

- **Dry run by default.** Prints a table for every row: date, meals ticked, snacks, and the score
  and streak each day would get (using the real `scoring.ts`), plus a summary (days, full days,
  final streak). Nothing is written unless `--commit` is passed.
- **Validation** (fail the whole import if any row is invalid, listing all errors): bad date format,
  duplicate dates, future dates (tracker timezone), values out of range, unknown columns, note too
  long.
- **Existing days:** if a day document already exists, skip it and report it, unless `--overwrite`
  is passed. Never silently overwrite data logged in the app.
- **Written documents match section 4 exactly:** `meals.<key> = { done, at: null }`, `snacks`,
  `note` (empty string if blank), `updatedAt: serverTimestamp()`. **No extra fields** (e.g. no
  `imported: true`) — the rules would otherwise reject later edits of those days.
- Batched write; print the number of documents written.
- Options: `--file <path>` (required), `--tracker <id>` (default `main`), `--commit`,
  `--overwrite`.

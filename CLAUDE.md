# FiveUp — notes for Claude

**The spec lives in [`fiveup-v1-prompt.md`](./fiveup-v1-prompt.md) and is the single source of
truth.** When the owner sends a change request, update that file first, then implement it.

Key rules (details in the spec):

- Work in the spec's build-order stages; commit, push and stop to report after each stage.
- Firebase Spark plan only: no Cloud Functions, no Cloud Storage. Scores are derived on the client,
  never stored.
- All dates use the **tracker timezone** (`settings.timezone`, default `Pacific/Auckland`), passed
  as a parameter to `src/lib/dates.ts`. Never the device timezone, UTC, or a hard-coded offset.
  Date arithmetic works on `yyyy-MM-dd` calendar dates, not on +24h timestamps.
- Scoring lives in the pure module `src/lib/scoring.ts`; point values come from settings, with
  defaults in `src/lib/defaultSettings.ts`.
- Meal definitions come from one config array (`src/lib/meals.ts`).
- Never commit secrets (`.env.local`, service-account keys) or personal data (`data/*.csv` other
  than the template).

Checks before pushing: `npm run lint`, `npm run format:check`, `npm test`, `npm run build`.

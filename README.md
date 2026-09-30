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

| Command           | What it does                                  |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | Start the dev server                          |
| `npm run build`   | Type-check and build for production (`dist/`) |
| `npm run preview` | Serve the production build locally            |
| `npm test`        | Run unit tests (Vitest)                       |
| `npm run lint`    | Lint with ESLint                              |
| `npm run format`  | Format with Prettier                          |
| `npm run icons`   | Regenerate PWA icons from `public/logo.svg`   |

## Firebase setup

_TODO (stage 3)._

## Deploy

_TODO (stage 8)._

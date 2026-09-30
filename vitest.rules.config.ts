import { defineConfig } from 'vitest/config'

// Security rules tests. They need the Firestore emulator, so they run via `npm run test:rules`
// (firebase emulators:exec) and are kept out of the default `npm test`.
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    environment: 'node',
    testTimeout: 15_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
})

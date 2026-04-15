import { defineConfig, devices } from '@playwright/test'
import { config }                from 'dotenv'

// Load app env vars first, then test-specific overrides
config({ path: '.env.local' })
config({ path: '.env.test', override: true })

export default defineConfig({
  testDir:       './tests/specs',
  fullyParallel: false,   // sequential — tests may share DB state
  forbidOnly:    !!process.env.CI,
  retries:       process.env.CI ? 1 : 0,
  workers:       1,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL:    process.env.BASE_URL ?? 'http://localhost:3000',
    trace:      'retain-on-failure',
    screenshot: 'only-on-failure',
    video:      'retain-on-failure',
    locale:     'fr-FR',
    // Generous timeouts for Next.js server actions
    actionTimeout:     12_000,
    navigationTimeout: 20_000,
  },

  projects: [
    // ── 1. Auth setup — runs once, writes session files ──────────────────────
    {
      name:      'setup',
      testDir:   './tests',
      testMatch: /auth\.setup\.ts/,
      use:       { ...devices['Desktop Chrome'] },
    },

    // ── 2. Main suite — depends on auth setup ────────────────────────────────
    {
      name:         'chromium',
      use:          { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],

  // Start the Next.js dev server automatically
  webServer: {
    command:             'npm run dev',
    url:                 process.env.BASE_URL ?? 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout:             60_000,
    stdout:              'ignore',
    stderr:              'pipe',
  },
})

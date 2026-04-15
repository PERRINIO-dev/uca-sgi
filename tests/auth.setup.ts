/**
 * tests/auth.setup.ts
 *
 * Playwright global auth setup — runs once before any test project.
 * Logs in each test role and persists the browser session (cookies + localStorage)
 * to .auth/<role>.json so individual specs can reuse it without re-authenticating.
 *
 * Requires .env.test (copy from .env.test.example and fill in credentials).
 */

import { test as setup, expect, type Page } from '@playwright/test'
import path                                 from 'path'
import fs                                   from 'fs'

const AUTH_DIR = path.resolve(__dirname, '.auth')

// Ensure .auth/ directory exists
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true })

// ── Login helper ──────────────────────────────────────────────────────────────
async function loginAndSave(
  page:         Page,
  email:        string,
  password:     string,
  expectedPath: string,
  outputFile:   string,
) {
  await page.goto('/login')
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.click('button[type="submit"]')
  await page.waitForURL(`**${expectedPath}`, { timeout: 20_000 })
  await page.context().storageState({ path: outputFile })
}

// ── Auth setup tests (one per role) ─────────────────────────────────────────

setup('auth: platform admin', async ({ page }) => {
  const email    = process.env.TEST_PLATFORM_ADMIN_EMAIL!
  const password = process.env.TEST_PLATFORM_ADMIN_PASSWORD!
  if (!email || !password) throw new Error('TEST_PLATFORM_ADMIN_EMAIL / TEST_PLATFORM_ADMIN_PASSWORD missing in .env.test')

  await loginAndSave(
    page, email, password,
    '/dashboard',
    path.join(AUTH_DIR, 'platform-admin.json'),
  )
})

setup('auth: owner', async ({ page }) => {
  const email    = process.env.TEST_OWNER_EMAIL!
  const password = process.env.TEST_OWNER_PASSWORD!
  if (!email || !password) throw new Error('TEST_OWNER_EMAIL / TEST_OWNER_PASSWORD missing in .env.test')

  await loginAndSave(
    page, email, password,
    '/dashboard',
    path.join(AUTH_DIR, 'owner.json'),
  )
})

setup('auth: vendor', async ({ page }) => {
  const email    = process.env.TEST_VENDOR_EMAIL!
  const password = process.env.TEST_VENDOR_PASSWORD!
  if (!email || !password) throw new Error('TEST_VENDOR_EMAIL / TEST_VENDOR_PASSWORD missing in .env.test')

  await loginAndSave(
    page, email, password,
    '/sales',
    path.join(AUTH_DIR, 'vendor.json'),
  )
})

setup('auth: warehouse', async ({ page }) => {
  const email    = process.env.TEST_WAREHOUSE_EMAIL!
  const password = process.env.TEST_WAREHOUSE_PASSWORD!
  if (!email || !password) throw new Error('TEST_WAREHOUSE_EMAIL / TEST_WAREHOUSE_PASSWORD missing in .env.test')

  await loginAndSave(
    page, email, password,
    '/warehouse',
    path.join(AUTH_DIR, 'warehouse.json'),
  )
})

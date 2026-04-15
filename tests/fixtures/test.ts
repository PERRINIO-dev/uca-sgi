/**
 * tests/fixtures/test.ts
 *
 * Extended Playwright fixtures providing pre-authenticated pages per role.
 * Usage:
 *   import { asOwner as test } from '../fixtures/test'
 *   test('my test', async ({ page }) => { ... })
 *
 * Each fixture loads the stored session for the matching role.
 */

import { test as base, BrowserContext, Page } from '@playwright/test'
import path                                   from 'path'

type AuthRole = 'platform-admin' | 'owner' | 'vendor' | 'warehouse'

function authFile(role: AuthRole) {
  return path.resolve(__dirname, '..', '.auth', `${role}.json`)
}

/** Create a test extension that uses the stored session for `role` */
function withRole(role: AuthRole) {
  return base.extend<{ page: Page; context: BrowserContext }>({
    context: async ({ browser }, use) => {
      const ctx = await browser.newContext({ storageState: authFile(role) })
      await use(ctx)
      await ctx.close()
    },
    page: async ({ context }, use) => {
      const page = await context.newPage()
      await use(page)
    },
  })
}

// Named exports — import the one matching the role under test
export const asPlatformAdmin = withRole('platform-admin')
export const asOwner         = withRole('owner')
export const asVendor        = withRole('vendor')
export const asWarehouse     = withRole('warehouse')

// ── Shared page-object helpers used in multiple specs ────────────────────────

/** Fill the login form and wait for redirect */
export async function loginAs(
  page: Page,
  email:     string,
  password:  string,
  waitForUrl: string,
) {
  await page.goto('/login')
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.click('button[type="submit"]')
  await page.waitForURL(waitForUrl, { timeout: 20_000 })
}

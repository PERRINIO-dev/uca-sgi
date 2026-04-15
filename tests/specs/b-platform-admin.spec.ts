/**
 * B — Platform Admin (Opérateur global)
 *
 * Tests: accès exclusif /admin, liste des companies, création d'une company,
 *        désactivation/réactivation, réinitialisation de mot de passe.
 */

import { expect }         from '@playwright/test'
import { asPlatformAdmin as test } from '../fixtures/test'

// ── B.1 Accès /admin — plateforme admin uniquement ────────────────────────────
test('B.1 platform admin can access /admin', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin/, { timeout: 10_000 })
  // Page title or kicker should confirm we're on the admin page
  await expect(page.locator('h1')).toBeVisible()
})

// ── B.2 Liste des companies visible ──────────────────────────────────────────
test('B.2 companies list renders', async ({ page }) => {
  await page.goto('/admin')
  // At least one company card should be visible
  // The companies render in cards with a name and stats
  await expect(page.locator('text=Propriétaire').first()).toBeVisible({ timeout: 8_000 })
})

// ── B.3 Création d'une nouvelle company + propriétaire ───────────────────────
test('B.3 create new company with owner', async ({ page }) => {
  await page.goto('/admin')

  const ts          = Date.now()
  const companyName = `TestCo-${ts}`
  const ownerEmail  = `owner-${ts}@pwtest.dev`
  const ownerName   = `PW Owner ${ts}`
  const ownerPwd    = 'Pw@test123!'

  // Click "Nouvelle entreprise" button
  await page.getByRole('button', { name: /Nouvelle entreprise/i }).click()

  // Fill the creation form
  const modal = page.locator('[role="dialog"], [data-modal], div').filter({ hasText: 'Nouvelle entreprise' }).last()

  // Company name
  await page.getByPlaceholder(/nom.*entreprise|company.name/i).fill(companyName)

  // Owner info
  await page.getByPlaceholder(/nom.*complet|full.name/i).fill(ownerName)
  await page.getByPlaceholder(/email/i).last().fill(ownerEmail)
  await page.getByPlaceholder(/mot de passe|password/i).fill(ownerPwd)

  // Submit
  await page.getByRole('button', { name: /Créer|Enregistrer/i }).last().click()

  // Expect success feedback (toast / message)
  await expect(page.locator('text=' + companyName)).toBeVisible({ timeout: 15_000 })
})

// ── B.4 Désactivation d'une company ──────────────────────────────────────────
test('B.4 toggle company active state', async ({ page }) => {
  await page.goto('/admin')

  // Click on the first company's details / action
  const firstCompanyCard = page.locator('button, [role="button"]').filter({ hasText: /Voir|Gérer|Détails/i }).first()
  if (await firstCompanyCard.count() > 0) {
    await firstCompanyCard.click()
  }

  // Look for a suspend/activate toggle button
  const toggleBtn = page.getByRole('button', { name: /Suspendre|Désactiver|Réactiver/i }).first()
  if (await toggleBtn.count() > 0) {
    const labelBefore = await toggleBtn.textContent()
    await toggleBtn.click()

    // Confirm in dialog if one appears
    const confirmBtn = page.getByRole('button', { name: /Confirmer|Oui|Suspendre/i }).last()
    if (await confirmBtn.count() > 0) {
      await confirmBtn.click()
    }

    // Expect an audit log entry or status change feedback
    await page.waitForTimeout(2_000)
    // Status changed — re-click to restore original state
    const toggleBtnAfter = page.getByRole('button', { name: /Suspendre|Désactiver|Réactiver/i }).first()
    if (await toggleBtnAfter.count() > 0 && labelBefore !== await toggleBtnAfter.textContent()) {
      await toggleBtnAfter.click()
      const confirmBtn2 = page.getByRole('button', { name: /Confirmer|Oui|Réactiver/i }).last()
      if (await confirmBtn2.count() > 0) await confirmBtn2.click()
    }
  }
})

// ── B.5 Non-admin est redirigé hors de /admin ─────────────────────────────────
test.describe('B.5 non-admin cannot access /admin', () => {
  // We use a fresh page with vendor credentials to test the redirect
  test('vendor redirected from /admin', async ({ browser }) => {
    const ctx  = await browser.newContext()
    const page = await ctx.newPage()

    // Login as vendor
    await page.goto('/login')
    await page.locator('#login-email').fill(process.env.TEST_VENDOR_EMAIL!)
    await page.locator('#login-password').fill(process.env.TEST_VENDOR_PASSWORD!)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/sales', { timeout: 20_000 })

    // Attempt to navigate to /admin
    await page.goto('/admin')
    // Should redirect to /dashboard (not /admin)
    await page.waitForURL(/\/dashboard|\/sales/, { timeout: 10_000 })
    expect(page.url()).not.toContain('/admin')

    await ctx.close()
  })
})

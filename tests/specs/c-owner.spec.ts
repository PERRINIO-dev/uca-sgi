/**
 * C — Owner / Admin (Gestion du tenant)
 *
 * Tests: dashboard KPIs, création produit (tile + unit), gestion employés,
 *        approbation d'une demande de stock, exports rapports.
 */

import { expect }    from '@playwright/test'
import { asOwner as test } from '../fixtures/test'
import {
  createTestProduct,
  deleteTestProduct,
  db,
  TEST_COMPANY_ID,
} from '../helpers/db'

// ── C.1 Dashboard charge avec KPIs ───────────────────────────────────────────
test('C.1 dashboard loads with KPI cards', async ({ page }) => {
  await page.goto('/dashboard')
  await page.waitForURL('**/dashboard', { timeout: 10_000 })

  // The dashboard has KPI cards — look for known labels
  await expect(page.locator('h1')).toBeVisible({ timeout: 8_000 })
  // Revenue or sales count card should render
  await expect(
    page.locator('text=/chiffre|ventes|revenus|total/i').first()
  ).toBeVisible({ timeout: 8_000 })
})

// ── C.2 Création d'un produit de type TILE (4-step wizard) ───────────────────
test('C.2 create tile product via 4-step wizard', async ({ page }) => {
  await page.goto('/products')

  // Open creation drawer
  await page.getByRole('button', { name: 'Nouveau produit' }).click()

  // ── Step 1: Type selection — Tile is default (first option)
  // Click the tile type button (label "Carreau / Revêtement m²")
  await page.getByText('Carreau / Revêtement m²').click()
  await page.getByRole('button', { name: /Suivant|Continuer/i }).first().click()

  // ── Step 2: Configuration
  const suffix = Date.now()
  await page.getByLabel(/Nom du produit/i).fill(`PW Tile ${suffix}`)
  await page.getByLabel(/Fournisseur/i).fill('PW Supplier')
  // Tile dimensions
  await page.getByLabel(/Largeur/i).fill('60')
  await page.getByLabel(/Hauteur|Longueur/i).fill('60')
  await page.getByLabel(/par carton/i).fill('10')
  await page.getByRole('button', { name: /Suivant|Continuer/i }).first().click()

  // ── Step 3: Prix & stock
  await page.getByLabel(/achat/i).fill('2000')
  await page.getByLabel(/plancher/i).fill('4000')
  await page.getByLabel(/référence/i).fill('6000')
  await page.getByLabel(/Initial.*cartons|Cartons initiaux/i).fill('10')
  await page.getByRole('button', { name: /Suivant|Continuer/i }).first().click()

  // ── Step 4: Résumé — click "Créer"
  await page.getByRole('button', { name: /Créer|Enregistrer/i }).last().click()

  // Expect success message
  await expect(page.locator('text=Produit créé')).toBeVisible({ timeout: 15_000 })
})

// ── C.3 Création d'un produit de type UNIT ───────────────────────────────────
test('C.3 create unit product', async ({ page }) => {
  await page.goto('/products')
  await page.getByRole('button', { name: 'Nouveau produit' }).click()

  // ── Step 1: Select 'unit' type
  await page.getByText('Pièce (unité)').click()
  await page.getByRole('button', { name: /Suivant|Continuer/i }).first().click()

  // ── Step 2: Config
  const suffix = Date.now()
  await page.getByLabel(/Nom du produit/i).fill(`PW Unit ${suffix}`)
  await page.getByLabel(/Fournisseur/i).fill('PW Supplier')
  await page.getByRole('button', { name: /Suivant|Continuer/i }).first().click()

  // ── Step 3: Prix
  await page.getByLabel(/plancher/i).fill('500')
  await page.getByLabel(/référence/i).fill('800')
  await page.getByLabel(/Initial.*quantité|Quantité initiale/i).fill('20')
  await page.getByRole('button', { name: /Suivant|Continuer/i }).first().click()

  // ── Step 4: Créer
  await page.getByRole('button', { name: /Créer|Enregistrer/i }).last().click()
  await expect(page.locator('text=Produit créé')).toBeVisible({ timeout: 15_000 })
})

// ── C.4 Création d'un employé vendeur ────────────────────────────────────────
test('C.4 create vendor employee', async ({ page }) => {
  await page.goto('/users')

  await page.getByRole('button', { name: /Nouvel employé|Ajouter/i }).click()

  const suffix = Date.now()
  await page.getByLabel(/Nom complet/i).fill(`PW Vendeur ${suffix}`)
  await page.getByLabel(/E-mail|Email/i).fill(`pw-vendor-${suffix}@pwtest.dev`)
  await page.getByLabel(/Mot de passe/i).fill('PwTest@123!')

  // Select role "vendor"
  const roleSelect = page.getByLabel(/Rôle/i)
  if (await roleSelect.count() > 0) {
    await roleSelect.selectOption('vendor')
  } else {
    // Role might be button-group style
    await page.getByText('Vendeur').last().click()
  }

  await page.getByRole('button', { name: /Créer|Enregistrer/i }).last().click()
  await expect(page.locator('text=/créé|ajouté/i').first()).toBeVisible({ timeout: 15_000 })
})

// ── C.5 Approbation d'une demande de stock ───────────────────────────────────
test('C.5 approve stock request from dashboard', async ({ page }) => {
  await page.goto('/dashboard')

  // Look for a pending stock request card
  const requestSection = page.locator('text=/demande.*stock|stock.*request/i').first()
  if (await requestSection.count() === 0) {
    test.skip()
    return
  }

  // Find and click the approve button
  const approveBtn = page.getByRole('button', { name: /Approuver/i }).first()
  if (await approveBtn.count() === 0) {
    test.skip()
    return
  }

  await approveBtn.click()
  // Wait for success feedback
  await expect(page.locator('text=/approuvé|approvée/i').first()).toBeVisible({ timeout: 10_000 })
})

// ── C.6 Page rapports accessible ─────────────────────────────────────────────
test('C.6 reports page loads with data', async ({ page }) => {
  await page.goto('/reports')
  await expect(page.locator('h1')).toBeVisible({ timeout: 8_000 })
  // Revenue section should render
  await expect(page.locator('text=/rapport|chiffre|revenus/i').first()).toBeVisible()
})

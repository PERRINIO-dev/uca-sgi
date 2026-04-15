/**
 * D — Vendeur (Flux des Ventes et Devis)
 *
 * Tests:
 *   D.1  Création d'un devis — aucun impact sur le stock
 *   D.2  Conversion devis → vente (N° VNT, stock réservé exactement N fois)
 *   D.3  Vente directe multi-produits
 *   D.4  Floor price violation → rejet + audit log
 *   D.5  Stock insuffisant → rejet
 *   D.6  Paiement complet
 *   D.7  Paiement partiel → statut 'partial'
 *   D.8  Annulation → reserved_tiles libéré
 *
 * DB helpers are used for setup (create products) and assertions (verify stock).
 */

import { expect, type Page } from '@playwright/test'
import { asVendor as test }  from '../fixtures/test'
import {
  createTestProduct,
  deleteTestProduct,
  getStockRow,
  getFloorViolations,
  db,
  TEST_COMPANY_ID,
} from '../helpers/db'

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Navigate to new sale form and add a tile product to the cart */
async function addTileToCart(
  page:        Page,
  productName: string,
  m2:          string,
  unitPrice:   string,
) {
  await page.goto('/sales/new')
  await page.waitForURL('**/sales/new', { timeout: 10_000 })

  // Search for the product in the catalogue
  await page.getByPlaceholder('Rechercher…').fill(productName.slice(0, 8))
  await page.getByText(productName, { exact: false }).first().click()

  // Mode = m² (default for tile) — fill m² input
  await page.getByPlaceholder(/m²|surface/i).fill(m2)
  await page.getByPlaceholder(/prix.*m²|unit.*price/i).fill(unitPrice)

  await page.getByRole('button', { name: /Ajouter au panier/i }).click()

  // Verify item in cart (right panel)
  await expect(page.locator('text=' + productName.slice(0, 8)).first()).toBeVisible({ timeout: 5_000 })
}

/** Fill step-2 customer info and optionally pay */
async function fillStep2(
  page:         Page,
  customerName: string,
  opts: { fullPayment?: boolean; cni?: string; phone?: string } = {},
) {
  await page.getByRole('button', { name: /Continuer/i }).click()
  await page.waitForTimeout(500)

  // Customer name
  await page.getByLabel('Nom du client').fill(customerName)
  if (opts.cni)   await page.getByLabel(/N° CNI/i).fill(opts.cni)
  if (opts.phone) await page.getByLabel(/Téléphone principal/i).fill(opts.phone)

  if (opts.fullPayment) {
    await page.getByRole('button', { name: 'Paiement complet' }).click()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// D.1 — Création d'un devis (aucun impact stock)
// ─────────────────────────────────────────────────────────────────────────────
test('D.1 create quote: DEV number assigned, stock unchanged', async ({ page }) => {
  const product = await createTestProduct({ totalCartons: 20, suffix: `D1-${Date.now()}` })
  const stockBefore = await getStockRow(product.id)

  try {
    await addTileToCart(page, product.name, '3.6', '5000')
    await fillStep2(page, 'Client Test D1', { cni: '123456', phone: '690000000' })

    // Save as quote
    await page.getByRole('button', { name: /Enregistrer comme devis/i }).click()

    // Success screen shows DEV-YYYY-NNNN
    await expect(page.locator('text=/DEV-/i')).toBeVisible({ timeout: 15_000 })

    // DB assertion: reserved_tiles must NOT have changed
    const stockAfter = await getStockRow(product.id)
    expect(stockAfter.reserved_tiles).toBe(stockBefore.reserved_tiles)
  } finally {
    await deleteTestProduct(product.id)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// D.2 — Conversion devis → vente (réservation exacte)
// ─────────────────────────────────────────────────────────────────────────────
test('D.2 convert quote to sale: VNT number, stock reserved exactly N', async ({ page }) => {
  const product = await createTestProduct({ totalCartons: 20, suffix: `D2-${Date.now()}` })
  const stockBefore = await getStockRow(product.id)

  try {
    // Create the quote (2 cartons = 20 tiles = 20 × 0.36 = 7.2 m²)
    await addTileToCart(page, product.name, '7.2', '5000')
    await fillStep2(page, 'Client Test D2', { cni: '654321', phone: '691000000' })
    await page.getByRole('button', { name: /Enregistrer comme devis/i }).click()

    // Get quote number from success screen
    const quoteNumEl = page.locator('text=/DEV-\\d{4}-\\d{4}/i')
    await expect(quoteNumEl).toBeVisible({ timeout: 15_000 })
    const quoteNumber = (await quoteNumEl.textContent()) ?? ''

    // Navigate to quotes list and convert
    await page.goto('/quotes')
    await expect(page.locator('h1')).toBeVisible({ timeout: 8_000 })

    // Find the quote row
    const quoteRow = page.locator(`text=${quoteNumber.trim()}`).first()
    await expect(quoteRow).toBeVisible({ timeout: 8_000 })

    // Click "Convertir en vente" button on that row
    const convertBtn = page.getByRole('button', { name: /Convertir/i }).first()
    await convertBtn.click()

    // Confirm conversion modal if it appears
    const confirmBtn = page.getByRole('button', { name: /Confirmer|Convertir/i }).last()
    if (await confirmBtn.count() > 0) {
      // Fill required fields if modal appears
      const cniInput = page.getByLabel(/CNI/i)
      if (await cniInput.count() > 0) await cniInput.fill('654321')
      const phoneInput = page.getByLabel(/Téléphone/i)
      if (await phoneInput.count() > 0 && !(await phoneInput.inputValue())) await phoneInput.fill('691000000')
      await confirmBtn.click()
    }

    // Expect VNT- number in success/page
    await expect(page.locator('text=/VNT-/i').first()).toBeVisible({ timeout: 15_000 })

    // DB assertion: reserved_tiles increased by exactly 20 (2 cartons × 10 tiles)
    const stockAfter = await getStockRow(product.id)
    expect(stockAfter.reserved_tiles).toBe(stockBefore.reserved_tiles + 20)
  } finally {
    await deleteTestProduct(product.id)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// D.3 — Vente directe (confirmation immédiate)
// ─────────────────────────────────────────────────────────────────────────────
test('D.3 direct sale: VNT number, stock reserved exactly N', async ({ page }) => {
  const product = await createTestProduct({ totalCartons: 30, suffix: `D3-${Date.now()}` })
  const stockBefore = await getStockRow(product.id)

  try {
    // 1 carton = 10 tiles = 10 × 0.36 = 3.6 m²
    await addTileToCart(page, product.name, '3.6', '5000')
    await fillStep2(page, 'Client Direct D3', {
      cni:         '999000',
      phone:       '699000000',
      fullPayment: true,
    })

    await page.getByRole('button', { name: /Confirmer la vente/i }).click()

    // Success screen with VNT- number
    await expect(page.locator('text=/VNT-/i').first()).toBeVisible({ timeout: 15_000 })

    // DB: exactly 10 tiles reserved
    const stockAfter = await getStockRow(product.id)
    expect(stockAfter.reserved_tiles).toBe(stockBefore.reserved_tiles + 10)
  } finally {
    await deleteTestProduct(product.id)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// D.4 — Floor price violation → rejet + audit log
// ─────────────────────────────────────────────────────────────────────────────
test('D.4 floor price violation: sale rejected, audit log created', async ({ page }) => {
  const product = await createTestProduct({
    totalCartons:    10,
    floorPricePerM2: 4000,
    suffix:          `D4-${Date.now()}`,
  })

  try {
    await addTileToCart(page, product.name, '3.6', '3000') // below floor (4000)
    await fillStep2(page, 'Client Floor Test', {
      cni:         '111222',
      phone:       '677000000',
      fullPayment: true,
    })

    await page.getByRole('button', { name: /Confirmer la vente/i }).click()

    // Error message must appear
    await expect(page.locator('text=Prix inférieur au plancher')).toBeVisible({ timeout: 10_000 })

    // DB: audit log must record the violation
    const logs = await getFloorViolations(product.id)
    expect(logs.length).toBeGreaterThan(0)
  } finally {
    await deleteTestProduct(product.id)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// D.5 — Stock insuffisant → rejet
// ─────────────────────────────────────────────────────────────────────────────
test('D.5 insufficient stock: sale rejected', async ({ page }) => {
  // Only 1 carton available = 10 tiles = 3.6 m²
  const product = await createTestProduct({ totalCartons: 1, suffix: `D5-${Date.now()}` })

  try {
    // Try to buy 50 m² (well above available 3.6 m²)
    await addTileToCart(page, product.name, '50', '5000')
    await fillStep2(page, 'Client Stock Test', {
      cni:         '333444',
      phone:       '677111000',
      fullPayment: true,
    })

    await page.getByRole('button', { name: /Confirmer la vente/i }).click()

    // Error: insufficient stock
    await expect(page.locator('text=Stock insuffisant')).toBeVisible({ timeout: 10_000 })
  } finally {
    await deleteTestProduct(product.id)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// D.6 — Paiement complet → statut 'paid'
// ─────────────────────────────────────────────────────────────────────────────
test('D.6 full payment sets status to paid', async ({ page }) => {
  const product = await createTestProduct({ totalCartons: 20, suffix: `D6-${Date.now()}` })

  try {
    await addTileToCart(page, product.name, '3.6', '5000')
    await fillStep2(page, 'Client Full Pay D6', {
      cni:         '555666',
      phone:       '677222000',
      fullPayment: true,
    })
    await page.getByRole('button', { name: /Confirmer la vente/i }).click()

    // Success screen
    await expect(page.locator('text=/VNT-/i').first()).toBeVisible({ timeout: 15_000 })

    // Get sale number and check status in DB
    const saleNumEl = page.locator('text=/VNT-\\d{4}-\\d{4}/i').first()
    const saleNumber = (await saleNumEl.textContent())?.trim() ?? ''

    if (saleNumber) {
      const { data: sale } = await db()
        .from('sales')
        .select('payment_status')
        .eq('sale_number', saleNumber)
        .single()
      expect(sale?.payment_status).toBe('paid')
    }
  } finally {
    await deleteTestProduct(product.id)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// D.7 — Paiement partiel → statut 'partial'
// ─────────────────────────────────────────────────────────────────────────────
test('D.7 partial payment sets status to partial', async ({ page }) => {
  const product = await createTestProduct({ totalCartons: 20, suffix: `D7-${Date.now()}` })

  try {
    await addTileToCart(page, product.name, '3.6', '5000')

    // Step 2 — do NOT click full payment button, manually fill a partial amount
    await page.getByRole('button', { name: /Continuer/i }).click()
    await page.waitForTimeout(500)

    await page.getByLabel('Nom du client').fill('Client Partial D7')
    await page.getByLabel(/N° CNI/i).fill('777888')
    await page.getByLabel(/Téléphone principal/i).fill('677333000')

    // Find the amount paid input and fill with a partial amount
    // Total is 5000 × 3.6 = 18000 — pay 9000 (50%)
    const amountInput = page.getByPlaceholder(/montant|amount|payé/i).first()
    if (await amountInput.count() > 0) {
      await amountInput.fill('9000')
    }

    await page.getByRole('button', { name: /Confirmer la vente/i }).click()
    await expect(page.locator('text=/VNT-/i').first()).toBeVisible({ timeout: 15_000 })

    // DB: payment_status should be 'partial'
    const saleNumEl = page.locator('text=/VNT-\\d{4}-\\d{4}/i').first()
    const saleNumber = (await saleNumEl.textContent())?.trim() ?? ''
    if (saleNumber) {
      const { data: sale } = await db()
        .from('sales')
        .select('payment_status')
        .eq('sale_number', saleNumber)
        .single()
      expect(sale?.payment_status).toBe('partial')
    }
  } finally {
    await deleteTestProduct(product.id)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// D.8 — Annulation d'une vente → reserved_tiles libéré
// ─────────────────────────────────────────────────────────────────────────────
test('D.8 cancel sale: reserved_tiles decremented back', async ({ page }) => {
  const product = await createTestProduct({ totalCartons: 20, suffix: `D8-${Date.now()}` })
  const stockBefore = await getStockRow(product.id)

  try {
    // Create a sale first (10 tiles reserved)
    await addTileToCart(page, product.name, '3.6', '5000')
    await fillStep2(page, 'Client Cancel D8', {
      cni:         '999001',
      phone:       '677444000',
      fullPayment: true,
    })
    await page.getByRole('button', { name: /Confirmer la vente/i }).click()
    await expect(page.locator('text=/VNT-/i').first()).toBeVisible({ timeout: 15_000 })

    // Get the VNT number
    const saleNumEl = page.locator('text=/VNT-\\d{4}-\\d{4}/i').first()
    const saleNumber = (await saleNumEl.textContent())?.trim() ?? ''

    // Verify reserved_tiles increased
    const stockAfterSale = await getStockRow(product.id)
    expect(stockAfterSale.reserved_tiles).toBeGreaterThan(stockBefore.reserved_tiles)

    // Navigate to sales list and cancel the sale
    await page.goto('/sales')
    await expect(page.locator('h1')).toBeVisible({ timeout: 8_000 })

    // Find the sale row
    if (saleNumber) {
      const saleRow = page.locator(`text=${saleNumber}`).first()
      if (await saleRow.count() > 0) {
        // Click on it to open details
        await saleRow.click()
      }
    }

    // Find and click cancel button
    const cancelBtn = page.getByRole('button', { name: /Annuler la vente|Annuler/i }).first()
    if (await cancelBtn.count() > 0) {
      await cancelBtn.click()

      // Confirm if modal appears
      const confirmCancelBtn = page.getByRole('button', { name: /Confirmer|Annuler définitivement/i }).last()
      if (await confirmCancelBtn.count() > 0) await confirmCancelBtn.click()

      await page.waitForTimeout(2_000)

      // DB: reserved_tiles should return to original value
      const stockAfterCancel = await getStockRow(product.id)
      expect(stockAfterCancel.reserved_tiles).toBe(stockBefore.reserved_tiles)
    }
  } finally {
    await deleteTestProduct(product.id)
  }
})

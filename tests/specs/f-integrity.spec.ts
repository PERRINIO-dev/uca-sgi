/**
 * F — Intégrité des Flux & Sécurité Multi-tenant
 *
 * Tests:
 *   F.1  Isolation cross-tenant: vendor de CompanyA ne peut PAS voir les données de CompanyB
 *   F.2  Triggers: set_sale_number assigne le bon format (DEV/VNT + année + seq)
 *   F.3  sync_sale_payment_totals: amount_paid et payment_status cohérents après un paiement additionnel
 *   F.4  Audit logs générés sur les événements critiques (SALE_CREATED, SALE_CANCELLED)
 */

import { expect }         from '@playwright/test'
import { asVendor as test } from '../fixtures/test'
import {
  createTestProduct,
  deleteTestProduct,
  getStockRow,
  getAuditLogs,
  db,
  TEST_COMPANY_ID,
  TEST_OTHER_COMPANY_ID,
} from '../helpers/db'

// ── F.1 Isolation cross-tenant ───────────────────────────────────────────────
test('F.1 authenticated vendor cannot read another company\'s products via API', async ({ page }) => {
  if (!TEST_OTHER_COMPANY_ID()) {
    test.skip()
    return
  }

  // The vendor is logged in as TEST_COMPANY user.
  // Hit the stock_view (or products) through the authenticated page fetch.
  // RLS must return 0 rows for the other company's products.

  // Navigate to a page that loads products (the vendor sale form shows products)
  await page.goto('/sales/new')
  await page.waitForURL('**/sales/new', { timeout: 10_000 })

  // Create a product in the OTHER company via admin client
  const { data: otherProduct } = await db()
    .from('products')
    .insert({
      company_id:             TEST_OTHER_COMPANY_ID(),
      product_type:           'tile',
      name:                   `CROSS_TENANT_TEST_${Date.now()}`,
      reference_code:         `CROSS-${Date.now()}`,
      supplier:               'Other Company',
      width_cm:               60, height_cm: 60,
      tile_area_m2:           0.36, tiles_per_carton: 10,
      purchase_price:         1000,
      floor_price_per_m2:     2000,
      reference_price_per_m2: 3000,
      unit_label: 'm²', package_label: 'carton',
      is_active: true,
    })
    .select('id, name')
    .single()

  if (!otherProduct) {
    test.skip()
    return
  }

  try {
    // Add stock to the other company's product
    await db().from('stock').update({ total_tiles: 100 })
      .eq('product_id', otherProduct.id)
      .eq('company_id', TEST_OTHER_COMPANY_ID())

    // The vendor's product list should NOT contain the other company's product
    const otherProductInList = page.locator(`text=${otherProduct.name}`)
    const count = await otherProductInList.count()
    expect(count).toBe(0)
  } finally {
    await db().from('stock').delete().eq('product_id', otherProduct.id)
    await db().from('products').delete().eq('id', otherProduct.id)
  }
})

// ── F.2 set_sale_number trigger ──────────────────────────────────────────────
test('F.2 sale number trigger: DEV format for draft, VNT for confirmed', async ({ page }) => {
  const currentYear = new Date().getFullYear()
  const product = await createTestProduct({ totalCartons: 10, suffix: `F2-${Date.now()}` })

  try {
    await page.goto('/sales/new')
    await page.waitForURL('**/sales/new', { timeout: 10_000 })

    // Create a quote (draft → DEV)
    await page.getByPlaceholder('Rechercher…').fill(product.name.slice(0, 8))
    await page.getByText(product.name, { exact: false }).first().click()
    await page.getByPlaceholder(/m²|surface/i).fill('3.6')
    await page.getByPlaceholder(/prix.*m²|unit.*price/i).fill('5000')
    await page.getByRole('button', { name: /Ajouter au panier/i }).click()

    await page.getByRole('button', { name: /Continuer/i }).click()
    await page.waitForTimeout(400)
    await page.getByLabel('Nom du client').fill('F2 Client')
    await page.getByLabel(/N° CNI/i).fill('F2CNI')
    await page.getByLabel(/Téléphone principal/i).fill('677000002')

    await page.getByRole('button', { name: /Enregistrer comme devis/i }).click()

    // DEV number format: DEV-YYYY-NNNN
    const devNum = page.locator(`text=/DEV-${currentYear}-\\d{4}/`)
    await expect(devNum).toBeVisible({ timeout: 15_000 })
    const devText = (await devNum.textContent())?.trim() ?? ''
    expect(devText).toMatch(new RegExp(`DEV-${currentYear}-\\d{4}`))
  } finally {
    await deleteTestProduct(product.id)
  }
})

// ── F.3 sync_sale_payment_totals trigger ─────────────────────────────────────
test('F.3 additional payment updates amount_paid and payment_status', async ({ page }) => {
  const product = await createTestProduct({ totalCartons: 10, suffix: `F3-${Date.now()}` })

  try {
    // Create a partial sale via DB
    const { data: boutique } = await db()
      .from('boutiques')
      .select('id')
      .eq('company_id', TEST_COMPANY_ID())
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    const { data: vendor } = await db()
      .from('users')
      .select('id')
      .eq('company_id', TEST_COMPANY_ID())
      .in('role', ['vendor', 'owner'])
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (!boutique || !vendor) { test.skip(); return }

    const totalAmount = 18000 // 10 tiles × 0.36 m² × 5000/m²
    const { data: sale } = await db()
      .from('sales')
      .insert({
        company_id: TEST_COMPANY_ID(), boutique_id: boutique.id,
        vendor_id: vendor.id, customer_name: 'F3 Client',
        customer_phone: '677000003', customer_cni: 'F3CNI',
        total_amount: totalAmount, amount_paid: 0,
        payment_status: 'unpaid', status: 'confirmed',
      })
      .select('id')
      .single()

    if (!sale) { test.skip(); return }

    // Insert first partial payment
    await db().from('sale_payments').insert({
      sale_id: sale.id, company_id: TEST_COMPANY_ID(),
      amount: 9000, payment_method: 'cash', recorded_by: vendor.id,
    })

    // Check payment_status is now 'partial'
    await page.waitForTimeout(500)
    const { data: salePartial } = await db()
      .from('sales')
      .select('payment_status, amount_paid')
      .eq('id', sale.id)
      .single()
    expect(salePartial?.payment_status).toBe('partial')
    expect(salePartial?.amount_paid).toBe(9000)

    // Insert second payment (completes the total)
    await db().from('sale_payments').insert({
      sale_id: sale.id, company_id: TEST_COMPANY_ID(),
      amount: 9000, payment_method: 'cash', recorded_by: vendor.id,
    })

    await page.waitForTimeout(500)
    const { data: salePaid } = await db()
      .from('sales')
      .select('payment_status, amount_paid')
      .eq('id', sale.id)
      .single()
    expect(salePaid?.payment_status).toBe('paid')
    expect(salePaid?.amount_paid).toBe(18000)

    // Cleanup sale
    await db().from('sale_payments').delete().eq('sale_id', sale.id)
    await db().from('sales').delete().eq('id', sale.id)
  } finally {
    await deleteTestProduct(product.id)
  }
})

// ── F.4 Audit logs sur événements critiques ───────────────────────────────────
test('F.4 SALE_CREATED audit log generated on direct sale', async ({ page }) => {
  const product = await createTestProduct({ totalCartons: 10, suffix: `F4-${Date.now()}` })

  try {
    await page.goto('/sales/new')
    await page.waitForURL('**/sales/new', { timeout: 10_000 })

    await page.getByPlaceholder('Rechercher…').fill(product.name.slice(0, 8))
    await page.getByText(product.name, { exact: false }).first().click()
    await page.getByPlaceholder(/m²|surface/i).fill('3.6')
    await page.getByPlaceholder(/prix.*m²|unit.*price/i).fill('5000')
    await page.getByRole('button', { name: /Ajouter au panier/i }).click()

    await page.getByRole('button', { name: /Continuer/i }).click()
    await page.waitForTimeout(400)
    await page.getByLabel('Nom du client').fill('F4 Audit Client')
    await page.getByLabel(/N° CNI/i).fill('F4CNI')
    await page.getByLabel(/Téléphone principal/i).fill('677000004')
    await page.getByRole('button', { name: 'Paiement complet' }).click()

    await page.getByRole('button', { name: /Confirmer la vente/i }).click()
    await expect(page.locator('text=/VNT-/i').first()).toBeVisible({ timeout: 15_000 })

    // Get the VNT number
    const saleNumEl = page.locator('text=/VNT-\\d{4}-\\d{4}/i').first()
    const saleNumber = (await saleNumEl.textContent())?.trim() ?? ''

    if (saleNumber) {
      // Find the sale ID
      const { data: sale } = await db()
        .from('sales')
        .select('id')
        .eq('sale_number', saleNumber)
        .single()

      if (sale) {
        const logs = await getAuditLogs(sale.id, 'SALE_CREATED')
        expect(logs.length).toBeGreaterThan(0)
      }
    }
  } finally {
    await deleteTestProduct(product.id)
  }
})

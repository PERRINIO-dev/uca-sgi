/**
 * E — Magasinier (Warehouse)
 *
 * Tests:
 *   E.1  File d'attente des commandes visible
 *   E.2  Progression: confirmed → preparing → ready
 *   E.3  Livraison: decrement_stock_on_delivery (total_tiles + reserved_tiles)
 *   E.4  Demande de stock soumise (audit log créé)
 */

import { expect }            from '@playwright/test'
import { asWarehouse as test } from '../fixtures/test'
import {
  createTestProduct,
  deleteTestProduct,
  getStockRow,
  db,
  TEST_COMPANY_ID,
} from '../helpers/db'

// ── Helper: create a confirmed sale via DB (bypass UI for setup) ──────────────
async function createTestSale(productId: string, quantityTiles: number) {
  // Get an active boutique for this company
  const { data: boutique } = await db()
    .from('boutiques')
    .select('id')
    .eq('company_id', TEST_COMPANY_ID())
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (!boutique) throw new Error('No active boutique for test company')

  // Get a vendor user
  const { data: vendor } = await db()
    .from('users')
    .select('id')
    .eq('company_id', TEST_COMPANY_ID())
    .eq('role', 'vendor')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (!vendor) throw new Error('No active vendor for test company')

  const { data: product } = await db()
    .from('products')
    .select('floor_price_per_m2, tile_area_m2, tiles_per_carton, reference_price_per_m2, purchase_price')
    .eq('id', productId)
    .single()

  if (!product) throw new Error('Product not found')

  const tileArea  = parseFloat(product.tile_area_m2)
  const unitPrice = parseFloat(product.reference_price_per_m2)
  const quantityM2 = quantityTiles * tileArea
  const totalPrice = Math.round(unitPrice * quantityM2)

  // Insert confirmed sale
  const { data: sale, error: saleErr } = await db()
    .from('sales')
    .insert({
      company_id:      TEST_COMPANY_ID(),
      boutique_id:     boutique.id,
      vendor_id:       vendor.id,
      customer_name:   'E2E Test Customer',
      customer_phone:  '677000001',
      customer_cni:    '999E2E',
      total_amount:    totalPrice,
      amount_paid:     totalPrice,
      payment_status:  'paid',
      status:          'confirmed',
    })
    .select('id')
    .single()

  if (saleErr || !sale) throw new Error(`createTestSale failed: ${saleErr?.message}`)

  // Insert sale item
  await db().from('sale_items').insert({
    sale_id:                  sale.id,
    product_id:               productId,
    quantity_tiles:           quantityTiles,
    unit_price_per_m2:        unitPrice,
    total_price:              totalPrice,
    floor_price_snapshot:     parseFloat(product.floor_price_per_m2),
    reference_price_snapshot: unitPrice,
    purchase_price_snapshot:  parseFloat(product.purchase_price ?? 0),
    tile_area_m2_snapshot:    tileArea,
    tiles_per_carton_snapshot: parseInt(product.tiles_per_carton),
  })

  // Reserve stock via RPC
  await db().rpc('reserve_stock_on_sale', {
    p_sale_id:  sale.id,
    p_items:    [{ product_id: productId, quantity_tiles: quantityTiles }],
    p_company_id: TEST_COMPANY_ID(),
  })

  return sale.id
}

// ── E.1 File d'attente des commandes ─────────────────────────────────────────
test('E.1 warehouse queue renders order cards', async ({ page }) => {
  await page.goto('/warehouse')
  await expect(page.locator('h1')).toBeVisible({ timeout: 8_000 })
  // There should be a section for orders
  await expect(page.locator('text=/commandes|orders|file/i').first()).toBeVisible()
})

// ── E.2 Progression confirmed → preparing → ready ────────────────────────────
test('E.2 order status: confirmed → preparing → ready', async ({ page }) => {
  const product = await createTestProduct({ totalCartons: 10, suffix: `E2-${Date.now()}` })

  try {
    const saleId = await createTestSale(product.id, 10) // 10 tiles

    await page.goto('/warehouse')
    await expect(page.locator('h1')).toBeVisible({ timeout: 8_000 })

    // The sale becomes an order with status "Nouvelle"
    // Find the "Commencer" (start preparing) button for our order
    const commencerBtn = page.getByRole('button', { name: /Commencer/i }).first()
    await expect(commencerBtn).toBeVisible({ timeout: 10_000 })
    await commencerBtn.click()

    // DB: status should be 'preparing'
    await page.waitForTimeout(1_500)
    const { data: order } = await db()
      .from('orders')
      .select('status')
      .eq('sale_id', saleId)
      .single()
    expect(order?.status).toBe('preparing')

    // Click "Marquer prête"
    await page.goto('/warehouse')
    const preteBtn = page.getByRole('button', { name: /Marquer prête/i }).first()
    await expect(preteBtn).toBeVisible({ timeout: 8_000 })
    await preteBtn.click()

    await page.waitForTimeout(1_500)
    const { data: orderReady } = await db()
      .from('orders')
      .select('status')
      .eq('sale_id', saleId)
      .single()
    expect(orderReady?.status).toBe('ready')
  } finally {
    await deleteTestProduct(product.id)
  }
})

// ── E.3 Livraison : decrement_stock_on_delivery ───────────────────────────────
test('E.3 delivery: total_tiles and reserved_tiles decremented', async ({ page }) => {
  const product = await createTestProduct({ totalCartons: 10, suffix: `E3-${Date.now()}` })
  const stockBefore = await getStockRow(product.id)

  try {
    const saleId = await createTestSale(product.id, 10)

    // Advance to 'ready' via DB directly (skip UI for speed)
    await db().from('orders').update({ status: 'ready' }).eq('sale_id', saleId)

    await page.goto('/warehouse')
    await expect(page.locator('h1')).toBeVisible({ timeout: 8_000 })

    // Click "Confirmer la livraison"
    const livraisonBtn = page.getByRole('button', { name: /Confirmer la livraison/i }).first()
    await expect(livraisonBtn).toBeVisible({ timeout: 8_000 })
    await livraisonBtn.click()

    // Confirm modal
    const confirmBtn = page.getByRole('button', { name: /Confirmer/i }).last()
    if (await confirmBtn.count() > 0) await confirmBtn.click()

    await page.waitForTimeout(2_000)

    // DB assertions
    const stockAfter = await getStockRow(product.id)
    // total_tiles decremented by 10
    expect(stockAfter.total_tiles).toBe(stockBefore.total_tiles - 10)
    // reserved_tiles decremented back to 0 (or original)
    expect(stockAfter.reserved_tiles).toBe(stockBefore.reserved_tiles)

    // Order status should be 'delivered'
    const { data: order } = await db()
      .from('orders')
      .select('status')
      .eq('sale_id', saleId)
      .single()
    expect(order?.status).toBe('delivered')
  } finally {
    await deleteTestProduct(product.id)
  }
})

// ── E.4 Demande de stock soumise → audit log créé ────────────────────────────
test('E.4 stock request submitted creates audit log', async ({ page }) => {
  const product = await createTestProduct({ totalCartons: 5, suffix: `E4-${Date.now()}` })

  try {
    await page.goto('/warehouse')
    await expect(page.locator('h1')).toBeVisible({ timeout: 8_000 })

    // Locate the stock request form — find product search
    const reqSearch = page.getByPlaceholder(/Rechercher un produit/i)
    await expect(reqSearch).toBeVisible({ timeout: 8_000 })

    await reqSearch.fill(product.name.slice(0, 8))
    await page.waitForTimeout(400)

    // Select the product from the dropdown
    const productOption = page.locator('text=' + product.name).first()
    await expect(productOption).toBeVisible({ timeout: 5_000 })
    await productOption.click()

    // Fill quantity
    const cartonsInput = page.getByLabel(/cartons/i).first()
    if (await cartonsInput.count() > 0) {
      await cartonsInput.fill('5')
    } else {
      await page.getByLabel(/quantité/i).first().fill('5')
    }

    // Fill justification (required — min 10 chars)
    const justifInput = page.getByLabel(/justification|motif/i).first()
    await expect(justifInput).toBeVisible({ timeout: 5_000 })
    await justifInput.fill('Test Playwright — réapprovisionnement automatique')

    // Submit
    await page.getByRole('button', { name: /Soumettre pour approbation/i }).click()

    // Success feedback
    await expect(
      page.locator('text=/envoyée|soumise|succès/i').first()
    ).toBeVisible({ timeout: 10_000 })

    // DB: audit log should have STOCK_REQUEST_SUBMITTED
    const { data: logs } = await db()
      .from('audit_logs')
      .select('*')
      .eq('company_id', TEST_COMPANY_ID())
      .eq('action_type', 'STOCK_REQUEST_SUBMITTED')
      .order('created_at', { ascending: false })
      .limit(1)
    expect(logs?.length).toBeGreaterThan(0)
  } finally {
    await deleteTestProduct(product.id)
  }
})

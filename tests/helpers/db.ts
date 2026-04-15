/**
 * tests/helpers/db.ts
 *
 * Supabase admin client for Playwright tests.
 * Uses the service-role key — bypasses RLS.
 * Provides:
 *   - DB setup / teardown helpers (create & clean test data)
 *   - Assertion helpers (read stock, sales, audit logs)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ── Singleton admin client ────────────────────────────────────────────────────
let _db: SupabaseClient | null = null
export function db(): SupabaseClient {
  if (!_db) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    _db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  }
  return _db
}

// ── Test company IDs (from .env.test) ────────────────────────────────────────
export const TEST_COMPANY_ID       = () => process.env.TEST_COMPANY_ID!
export const TEST_OTHER_COMPANY_ID = () => process.env.TEST_OTHER_COMPANY_ID!

// ─────────────────────────────────────────────────────────────────────────────
// Assertion helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface StockRow {
  product_id:     string
  company_id:     string
  total_tiles:    number
  reserved_tiles: number
}

/** Read raw stock row for a product */
export async function getStockRow(productId: string): Promise<StockRow> {
  const { data, error } = await db()
    .from('stock')
    .select('product_id, company_id, total_tiles, reserved_tiles')
    .eq('product_id', productId)
    .eq('company_id', TEST_COMPANY_ID())
    .single()
  if (error || !data) throw new Error(`Stock not found for product ${productId}: ${error?.message}`)
  return data
}

/** Find a sale by its sale_number or quote_number */
export async function getSaleByNumber(number: string) {
  const { data } = await db()
    .from('sales')
    .select('*, sale_items(*)')
    .or(`sale_number.eq.${number},quote_number.eq.${number}`)
    .eq('company_id', TEST_COMPANY_ID())
    .maybeSingle()
  return data
}

/** Get all audit logs for an entity, optionally filtered by action_type */
export async function getAuditLogs(entityId: string, actionType?: string) {
  let q = db()
    .from('audit_logs')
    .select('*')
    .eq('entity_id', entityId)
    .eq('company_id', TEST_COMPANY_ID())
  if (actionType) q = (q as any).eq('action_type', actionType)
  const { data } = await q.order('created_at', { ascending: false })
  return data ?? []
}

/** Get floor-price violation audit logs */
export async function getFloorViolations(productId: string) {
  const { data } = await db()
    .from('audit_logs')
    .select('*')
    .eq('entity_id', productId)
    .eq('action_type', 'FLOOR_PRICE_VIOLATION_ATTEMPT')
    .eq('company_id', TEST_COMPANY_ID())
    .order('created_at', { ascending: false })
  return data ?? []
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup helpers — create test data that tests need
// ─────────────────────────────────────────────────────────────────────────────

/** Create a tile product with initial stock for tests */
export async function createTestProduct(opts: {
  totalCartons?:        number   // initial stock in cartons (default 50)
  floorPricePerM2?:     number   // floor price (default 4000)
  referencePricePerM2?: number   // reference price (default 6000)
  suffix?:              string
} = {}): Promise<{ id: string; name: string; floorPrice: number }> {
  const suffix  = opts.suffix ?? Date.now().toString()
  const name    = `PW-TEST-${suffix}`

  const { data: product, error } = await db()
    .from('products')
    .insert({
      company_id:             TEST_COMPANY_ID(),
      product_type:           'tile',
      name,
      reference_code:         `TST-${suffix}`,
      supplier:               'Playwright Tests',
      width_cm:               60,
      height_cm:              60,
      tile_area_m2:           0.36,
      tiles_per_carton:       10,
      purchase_price:         2000,
      floor_price_per_m2:     opts.floorPricePerM2     ?? 4000,
      reference_price_per_m2: opts.referencePricePerM2 ?? 6000,
      unit_label:             'm²',
      package_label:          'carton',
      is_active:              true,
    })
    .select('id, name, floor_price_per_m2')
    .single()

  if (error || !product) throw new Error(`createTestProduct failed: ${error?.message}`)

  // The trigger creates the stock row — wait briefly and then set total_tiles
  await new Promise(r => setTimeout(r, 400))
  const cartons = opts.totalCartons ?? 50
  await db()
    .from('stock')
    .update({ total_tiles: cartons * 10 })
    .eq('product_id', product.id)
    .eq('company_id', TEST_COMPANY_ID())

  return { id: product.id, name, floorPrice: product.floor_price_per_m2 }
}

/** Forcibly reset reserved_tiles to 0 for a product (test cleanup) */
export async function resetReservation(productId: string) {
  await db()
    .from('stock')
    .update({ reserved_tiles: 0 })
    .eq('product_id', productId)
    .eq('company_id', TEST_COMPANY_ID())
}

// ─────────────────────────────────────────────────────────────────────────────
// Teardown helpers — delete test data after tests
// ─────────────────────────────────────────────────────────────────────────────

/** Delete all sales (+ payments + items) that reference a given product */
export async function cleanupSalesByProduct(productId: string) {
  const { data: items } = await db()
    .from('sale_items')
    .select('sale_id')
    .eq('product_id', productId)

  if (items?.length) {
    const saleIds = [...new Set(items.map(i => i.sale_id))]
    await db().from('sale_payments').delete().in('sale_id', saleIds)
    await db().from('sale_items').delete().in('sale_id', saleIds)
    await db().from('orders').delete().in('sale_id', saleIds)
    await db().from('sales').delete().in('id', saleIds)
  }
}

/** Full cleanup for a test product (sales + stock + product row) */
export async function deleteTestProduct(productId: string) {
  await cleanupSalesByProduct(productId)
  await db().from('stock').delete().eq('product_id', productId)
  await db().from('products').delete().eq('id', productId)
}

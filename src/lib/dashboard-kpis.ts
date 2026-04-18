/**
 * Shared KPI computation for the dashboard.
 *
 * Single source of truth — consumed by both the server-render path
 * (dashboard/page.tsx) and the SWR refresh path (api/dashboard/route.ts).
 * Any change to business logic is made here and takes effect in both paths.
 */

import { LOW_STOCK_CARTONS, LOW_STOCK_UNITS } from '@/lib/constants'

// ── Input shape (mirrors getDashboardStats return) ────────────────────────────
interface KpisInput {
  todaySales:          any[]
  mtdSales:            any[]
  prevMonthSales:      any[]
  weekSales:           any[]
  allTimeCreanceSales: any[]
  stockLevels:         any[]
  productTypes:        any[]
}

// ── Output shape ──────────────────────────────────────────────────────────────
export interface DashboardKpisOutput {
  todayCount:      number
  mtdRevenue:      number
  mtdCreances:     number
  mtdAvgBasket:    number
  mtdTrend:        number | null
  mtdMargin:       number
  mtdMarginPct:    number | null
  allTimeCreances: number
  boutiqueStats:   { name: string; ca: number }[]
  dailyChart:      { day: string; ca: number }[]
  stockAlerts:     any[]
}

export function computeDashboardKpis(
  stats:     KpisInput,
  chartData: any[],
): DashboardKpisOutput {

  // ── Today ─────────────────────────────────────────────────────────────────
  const todayCount = stats.todaySales.length

  // ── Month-to-date revenue + encaissement ──────────────────────────────────
  const mtdRevenue  = stats.mtdSales.reduce((s: number, x: any) => s + Number(x.total_amount), 0)
  const mtdEncaisse = stats.mtdSales.reduce((s: number, x: any) => s + Number(x.amount_paid ?? 0), 0)
  const mtdCreances  = Math.max(0, mtdRevenue - mtdEncaisse)
  const mtdCount     = stats.mtdSales.length
  const mtdAvgBasket = mtdCount > 0 ? mtdRevenue / mtdCount : 0

  // ── MTD gross margin ──────────────────────────────────────────────────────
  // product_type is the authoritative isTile signal — more robust than a null
  // check on tile_area_m2_snapshot, which can be absent for valid reasons.
  // Tile cost:     purchase_price × quantity_tiles × tile_area_m2
  // Non-tile cost: purchase_price × quantity_tiles  (no area multiplier)
  const mtdCost = stats.mtdSales.reduce((sum: number, s: any) =>
    sum + (s.sale_items ?? []).reduce((a: number, item: any) => {
      const isTile = item.products?.product_type === 'tile'
      const pp     = Number(item.purchase_price_snapshot) || 0
      const qty    = Number(item.quantity_tiles)
      const m2     = isTile ? Number(item.tile_area_m2_snapshot ?? 0) : 0
      return a + (isTile ? pp * qty * m2 : pp * qty)
    }, 0)
  , 0)
  const mtdMargin    = mtdRevenue - mtdCost
  const mtdMarginPct = mtdRevenue > 0 ? (mtdMargin / mtdRevenue) * 100 : null

  // ── All-time outstanding créances ─────────────────────────────────────────
  const allTimeCreances = stats.allTimeCreanceSales.reduce(
    (s: number, x: any) => s + Math.max(0, Number(x.total_amount) - Number(x.amount_paid ?? 0))
  , 0)

  // ── MTD trend vs same period last month ───────────────────────────────────
  // Filter previous-month data to the same day-of-month as today so the
  // comparison is apples-to-apples (e.g. Apr 1–15 vs Mar 1–15).
  const todayDayOfMonth = new Date().getDate()
  const prevMonthRevenue = stats.prevMonthSales
    .filter((s: any) => new Date(s.created_at).getDate() <= todayDayOfMonth)
    .reduce((s: number, x: any) => s + Number(x.total_amount), 0)
  const mtdTrend = prevMonthRevenue > 0
    ? ((mtdRevenue - prevMonthRevenue) / prevMonthRevenue) * 100
    : null

  // ── Boutique breakdown (MTD) ──────────────────────────────────────────────
  const boutiqueMap: Record<string, number> = {}
  stats.weekSales.forEach((s: any) => {
    const name = s.boutiques?.name ?? 'Inconnue'
    boutiqueMap[name] = (boutiqueMap[name] ?? 0) + Number(s.total_amount)
  })
  const boutiqueStats = Object.entries(boutiqueMap).map(([name, ca]) => ({ name, ca }))

  // ── Daily chart — 30-day trend ────────────────────────────────────────────
  // ISO date (YYYY-MM-DD) used as map key so Object.values can be sorted
  // chronologically — a localised string like "15 avr." has no defined order.
  const dailyMap: Record<string, { day: string; ca: number; _iso: string }> = {}
  chartData.forEach((s: any) => {
    const iso = (s.created_at as string).slice(0, 10)
    if (!dailyMap[iso]) dailyMap[iso] = {
      _iso: iso,
      day:  new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      ca:   0,
    }
    dailyMap[iso].ca += Number(s.total_amount)
  })
  const dailyChart = Object.values(dailyMap)
    .sort((a, b) => a._iso.localeCompare(b._iso))
    .map(({ day, ca }) => ({ day, ca }))

  // ── Stock alerts ──────────────────────────────────────────────────────────
  // Tiles:     threshold on available_full_cartons
  // Non-tiles: threshold on available_qty (individual units)
  const typeMap = new Map(
    (stats.productTypes ?? []).map((p: any) => [p.id, p.product_type])
  )
  const stockAlerts = stats.stockLevels
    .filter((s: any) => {
      const type = typeMap.get(s.product_id) ?? 'tile'
      return type === 'tile'
        ? Number(s.available_full_cartons) < LOW_STOCK_CARTONS
        : Number(s.available_qty)          < LOW_STOCK_UNITS
    })
    .map((s: any) => ({ ...s, product_type: typeMap.get(s.product_id) ?? 'tile' }))

  return {
    todayCount,
    mtdRevenue, mtdCreances, mtdAvgBasket,
    mtdTrend, mtdMargin, mtdMarginPct,
    allTimeCreances,
    boutiqueStats, dailyChart, stockAlerts,
  }
}

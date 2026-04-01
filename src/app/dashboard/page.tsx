import { createClient }                           from '@/lib/supabase/server'
import { redirect }                               from 'next/navigation'
import { getDashboardStats, getSalesByPeriod }    from '@/lib/supabase/queries'
import { getBadgeCounts }                         from '@/lib/supabase/badge-counts'
import { LOW_STOCK_CARTONS, LOW_STOCK_UNITS }      from '@/lib/constants'
import DashboardClient                            from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, email, role, boutique_id, is_active, is_platform_admin, companies(currency)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (!profile.is_active) redirect('/login?error=account_suspended')
  if (profile.is_platform_admin) redirect('/admin')
  if (!['owner', 'admin'].includes(profile.role)) {
    if (profile.role === 'vendor')    redirect('/sales')
    if (profile.role === 'warehouse') redirect('/warehouse')
    redirect('/sales')
  }

  const [stats, chartData, badgeCounts] = await Promise.all([
    getDashboardStats(),
    getSalesByPeriod(30),
    getBadgeCounts(profile.role, supabase),
  ])

  // ── Today KPIs ────────────────────────────────────────────────────────────
  const todayRevenue = stats.todaySales.reduce(
    (sum: number, s: any) => sum + Number(s.total_amount), 0
  )
  const todayCount = stats.todaySales.length

  // ── Month-to-date KPIs ────────────────────────────────────────────────────
  const mtdRevenue   = stats.mtdSales.reduce(
    (sum: number, s: any) => sum + Number(s.total_amount), 0
  )
  const mtdEncaisse  = stats.mtdSales.reduce(
    (sum: number, s: any) => sum + Number(s.amount_paid ?? 0), 0
  )
  const mtdCreances  = Math.max(0, mtdRevenue - mtdEncaisse)
  const mtdCount     = stats.mtdSales.length
  const mtdAvgBasket = mtdCount > 0 ? mtdRevenue / mtdCount : 0

  // ── MTD gross margin (owner-only) ─────────────────────────────────────────
  // Tile:     cost = purchase_price × quantity_tiles × tile_area_m2
  // Non-tile: cost = purchase_price × quantity_tiles (no area multiplier)
  const mtdCost = stats.mtdSales.reduce((sum: number, s: any) =>
    sum + (s.sale_items ?? []).reduce((a: number, item: any) => {
      const pp  = Number(item.purchase_price_snapshot) || 0
      const qty = Number(item.quantity_tiles)
      const isTile = item.tile_area_m2_snapshot != null
      return a + (isTile ? pp * qty * Number(item.tile_area_m2_snapshot) : pp * qty)
    }, 0)
  , 0)
  const mtdMargin    = mtdRevenue - mtdCost
  const mtdMarginPct = mtdRevenue > 0 ? (mtdMargin / mtdRevenue) * 100 : null

  // ── All-time outstanding créances ─────────────────────────────────────────
  const allTimeCreances = stats.allTimeCreanceSales.reduce(
    (sum: number, s: any) =>
      sum + Math.max(0, Number(s.total_amount) - Number(s.amount_paid ?? 0))
    , 0
  )

  // ── Previous month for trend (same day-range as current MTD) ─────────────
  // Only count previous-month sales up to the same day-of-month as today,
  // so the comparison is apples-to-apples (e.g. March 1–15 vs Feb 1–15).
  const todayDayOfMonth = new Date().getDate()
  const prevMonthSamePeriod = stats.prevMonthSales.filter(
    (s: any) => new Date(s.created_at).getDate() <= todayDayOfMonth
  )
  const prevMonthRevenue = prevMonthSamePeriod.reduce(
    (sum: number, s: any) => sum + Number(s.total_amount), 0
  )
  const mtdTrend = prevMonthRevenue > 0
    ? ((mtdRevenue - prevMonthRevenue) / prevMonthRevenue) * 100
    : null

  // ── Revenue by boutique (MTD) ─────────────────────────────────────────────
  const boutiqueMap: Record<string, number> = {}
  stats.weekSales.forEach((s: any) => {
    const name = s.boutiques?.name ?? 'Inconnue'
    boutiqueMap[name] = (boutiqueMap[name] ?? 0) + Number(s.total_amount)
  })
  const boutiqueStats = Object.entries(boutiqueMap).map(([name, ca]) => ({ name, ca }))

  // ── Daily chart data (last 7 days) ────────────────────────────────────────
  const dailyMap: Record<string, number> = {}
  chartData.forEach((s: any) => {
    const day = new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    dailyMap[day] = (dailyMap[day] ?? 0) + Number(s.total_amount)
  })
  const dailyChart = Object.entries(dailyMap).map(([day, ca]) => ({ day, ca }))

  // ── Stock alerts — tile: < LOW_STOCK_CARTONS full cartons
  //                  non-tile: < LOW_STOCK_UNITS available units ──────────────
  const typeMap = new Map(
    (stats.productTypes ?? []).map((p: any) => [p.id, p.product_type])
  )
  const stockAlerts = stats.stockLevels
    .filter((s: any) => {
      const type = typeMap.get(s.product_id) ?? 'tile'
      return type === 'tile'
        ? Number(s.available_full_cartons) < LOW_STOCK_CARTONS
        : Number(s.available_tiles)        < LOW_STOCK_UNITS
    })
    .map((s: any) => ({
      ...s,
      product_type: typeMap.get(s.product_id) ?? 'tile',
    }))

  const currency = (profile.companies as any)?.currency ?? 'FCFA'

  return (
    <DashboardClient
      profile={profile}
      currency={currency}
      todayRevenue={todayRevenue}
      todayCount={todayCount}
      mtdRevenue={mtdRevenue}
      mtdCreances={mtdCreances}
      mtdAvgBasket={mtdAvgBasket}
      mtdTrend={mtdTrend}
      mtdMargin={mtdMargin}
      mtdMarginPct={mtdMarginPct}
      allTimeCreances={allTimeCreances}
      activeOrdersCount={stats.activeOrdersCount}
      pendingRequests={stats.pendingRequests}
      stockAlerts={stockAlerts}
      boutiqueStats={boutiqueStats}
      dailyChart={dailyChart}
      badgeCounts={badgeCounts}
    />
  )
}

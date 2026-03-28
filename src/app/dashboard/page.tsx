import { createClient }                           from '@/lib/supabase/server'
import { redirect }                               from 'next/navigation'
import { getDashboardStats, getSalesByPeriod }    from '@/lib/supabase/queries'
import { getBadgeCounts }                         from '@/lib/supabase/badge-counts'
import { LOW_STOCK_CARTONS }                      from '@/lib/constants'
import DashboardClient                            from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, email, role, boutique_id, is_active, is_platform_admin')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
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
  // Cost = sum(purchase_price_snapshot × quantity_tiles × tile_area_m2_snapshot)
  const mtdCost = stats.mtdSales.reduce((sum: number, s: any) =>
    sum + (s.sale_items ?? []).reduce((a: number, item: any) =>
      a + (Number(item.purchase_price_snapshot) || 0)
        * Number(item.quantity_tiles)
        * Number(item.tile_area_m2_snapshot)
    , 0)
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

  // ── Stock alerts (available < 50 cartons) ────────────────────────────────
  const stockAlerts = stats.stockLevels.filter(
    (s: any) => Number(s.available_full_cartons) < LOW_STOCK_CARTONS
  )

  return (
    <DashboardClient
      profile={profile}
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

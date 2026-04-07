import { NextResponse }                         from 'next/server'
import { createClient }                         from '@/lib/supabase/server'
import { getDashboardStats, getSalesByPeriod }  from '@/lib/supabase/queries'
import { getBadgeCounts }                       from '@/lib/supabase/badge-counts'
import { LOW_STOCK_CARTONS, LOW_STOCK_UNITS }   from '@/lib/constants'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, email, role, boutique_id, is_active, is_platform_admin, companies(currency)')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active || profile.is_platform_admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!['owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [stats, chartData, badgeCounts] = await Promise.all([
    getDashboardStats(),
    getSalesByPeriod(30),
    getBadgeCounts(profile.role, supabase),
  ])

  // ── KPI calculations (mirrors dashboard/page.tsx) ──────────────────────────
  const todayRevenue = stats.todaySales.reduce(
    (sum: number, s: any) => sum + Number(s.total_amount), 0
  )
  const todayCount = stats.todaySales.length

  const mtdRevenue  = stats.mtdSales.reduce(
    (sum: number, s: any) => sum + Number(s.total_amount), 0
  )
  const mtdEncaisse = stats.mtdSales.reduce(
    (sum: number, s: any) => sum + Number(s.amount_paid ?? 0), 0
  )
  const mtdCreances  = Math.max(0, mtdRevenue - mtdEncaisse)
  const mtdCount     = stats.mtdSales.length
  const mtdAvgBasket = mtdCount > 0 ? mtdRevenue / mtdCount : 0

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

  const allTimeCreances = stats.allTimeCreanceSales.reduce(
    (sum: number, s: any) =>
      sum + Math.max(0, Number(s.total_amount) - Number(s.amount_paid ?? 0))
    , 0
  )

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

  const boutiqueMap: Record<string, number> = {}
  stats.weekSales.forEach((s: any) => {
    const name = s.boutiques?.name ?? 'Inconnue'
    boutiqueMap[name] = (boutiqueMap[name] ?? 0) + Number(s.total_amount)
  })
  const boutiqueStats = Object.entries(boutiqueMap).map(([name, ca]) => ({ name, ca }))

  const dailyMap: Record<string, number> = {}
  chartData.forEach((s: any) => {
    const day = new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    dailyMap[day] = (dailyMap[day] ?? 0) + Number(s.total_amount)
  })
  const dailyChart = Object.entries(dailyMap).map(([day, ca]) => ({ day, ca }))

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

  return NextResponse.json({
    currency,
    todayRevenue,
    todayCount,
    mtdRevenue,
    mtdCreances,
    mtdAvgBasket,
    mtdTrend,
    mtdMargin,
    mtdMarginPct,
    allTimeCreances,
    activeOrdersCount: stats.activeOrdersCount,
    pendingRequests:   stats.pendingRequests,
    stockAlerts,
    boutiqueStats,
    dailyChart,
    badgeCounts,
  })
}

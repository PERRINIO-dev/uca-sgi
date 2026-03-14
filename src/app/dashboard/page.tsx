import { createClient }                           from '@/lib/supabase/server'
import { redirect }                               from 'next/navigation'
import { getDashboardStats, getSalesByPeriod }    from '@/lib/supabase/queries'
import DashboardClient                            from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, email, role, boutique_id, is_active')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (!['owner', 'admin'].includes(profile.role)) {
    if (profile.role === 'vendor')    redirect('/sales')
    if (profile.role === 'warehouse') redirect('/warehouse')
    redirect('/sales')
  }

  const [stats, chartData] = await Promise.all([
    getDashboardStats(),
    getSalesByPeriod(7),
  ])

  // Aggregate KPIs
  const todayRevenue = stats.todaySales.reduce(
    (sum: number, s: any) => sum + Number(s.total_amount), 0
  )
  const todayCount = stats.todaySales.length

  // Revenue by boutique this week
  const boutiqueMap: Record<string, number> = {}
  stats.weekSales.forEach((s: any) => {
    const name = s.boutiques?.name ?? 'Inconnue'
    boutiqueMap[name] = (boutiqueMap[name] ?? 0) + Number(s.total_amount)
  })
  const boutiqueStats = Object.entries(boutiqueMap).map(([name, ca]) => ({ name, ca }))

  // Daily chart data
  const dailyMap: Record<string, number> = {}
  chartData.forEach((s: any) => {
    const day = new Date(s.created_at).toLocaleDateString('fr-FR', { weekday: 'short' })
    dailyMap[day] = (dailyMap[day] ?? 0) + Number(s.total_amount)
  })
  const dailyChart = Object.entries(dailyMap).map(([day, ca]) => ({ day, ca }))

  // Stock alerts (available < 50 tiles)
  const stockAlerts = stats.stockLevels.filter(
    (s: any) => Number(s.available_tiles) < 50
  )

  return (
    <DashboardClient
      profile={profile}
      todayRevenue={todayRevenue}
      todayCount={todayCount}
      pendingRequests={stats.pendingRequests}
      stockAlerts={stockAlerts}
      boutiqueStats={boutiqueStats}
      dailyChart={dailyChart}
    />
  )
}

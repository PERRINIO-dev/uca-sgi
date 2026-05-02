import { createClient }                           from '@/lib/supabase/server'
import { redirect }                               from 'next/navigation'
import { getDashboardStats, getSalesByPeriod }    from '@/lib/supabase/queries'
import { getBadgeCounts }                         from '@/lib/supabase/badge-counts'
import { computeDashboardKpis }                   from '@/lib/dashboard-kpis'
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
  if (!['owner', 'manager', 'accountant'].includes(profile.role)) {
    if (profile.role === 'seller')      redirect('/sales/new')
    if (profile.role === 'cashier')     redirect('/caisse')
    if (profile.role === 'warehouse')   redirect('/warehouse')
    if (profile.role === 'delivery')    redirect('/deliveries')
    if (profile.role === 'field_agent') redirect('/pipeline')
    redirect('/sales')
  }

  const [stats, chartData, badgeCounts] = await Promise.all([
    getDashboardStats(),
    getSalesByPeriod(30),
    getBadgeCounts(profile.role, supabase),
  ])

  const kpis     = computeDashboardKpis(stats, chartData)
  const currency = (profile.companies as any)?.currency ?? 'FCFA'

  return (
    <DashboardClient
      profile={profile}
      currency={currency}
      todayCount={kpis.todayCount}
      mtdRevenue={kpis.mtdRevenue}
      mtdCreances={kpis.mtdCreances}
      mtdAvgBasket={kpis.mtdAvgBasket}
      mtdTrend={kpis.mtdTrend}
      mtdMargin={kpis.mtdMargin}
      mtdMarginPct={kpis.mtdMarginPct}
      allTimeCreances={kpis.allTimeCreances}
      stockValuation={kpis.stockValuation}
      paymentsByMethod={kpis.paymentsByMethod}
      activeOrdersCount={stats.activeOrdersCount}
      pendingRequests={stats.pendingRequests}
      stockAlerts={kpis.stockAlerts}
      boutiqueStats={kpis.boutiqueStats}
      dailyChart={kpis.dailyChart}
      overdueSchedule={kpis.overdueSchedule}
      todayDateStr={kpis.todayDateStr}
      badgeCounts={badgeCounts}
    />
  )
}

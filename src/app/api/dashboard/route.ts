import { NextResponse }                         from 'next/server'
import { createClient }                         from '@/lib/supabase/server'
import { getDashboardStats, getSalesByPeriod }  from '@/lib/supabase/queries'
import { getBadgeCounts }                       from '@/lib/supabase/badge-counts'
import { computeDashboardKpis }                 from '@/lib/dashboard-kpis'

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

  const kpis     = computeDashboardKpis(stats, chartData)
  const currency = (profile.companies as any)?.currency ?? 'FCFA'

  return NextResponse.json({
    currency,
    ...kpis,
    activeOrdersCount: stats.activeOrdersCount,
    pendingRequests:   stats.pendingRequests,
    badgeCounts,
  })
}

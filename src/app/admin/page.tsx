import { createClient }                      from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect }                          from 'next/navigation'
import { getBadgeCounts }                    from '@/lib/supabase/badge-counts'
import AdminClient                           from './AdminClient'

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// Platform-level audit events — the only ones visible to the operator.
// Tenant operational data (sales, payments, stock, employees) is their
// proprietary business data and must not appear in the admin console.
const PLATFORM_EVENTS = [
  'COMPANY_CREATED',
  'COMPANY_ACTIVATED',
  'COMPANY_DEACTIVATED',
  'PLATFORM_USER_SUSPENDED',
  'PLATFORM_USER_REACTIVATED',
  'PLATFORM_USER_PASSWORD_RESET',
] as const

export default async function AdminPage() {
  const supabase = await createClient()
  const admin    = getAdmin()

  // ── Auth guard ────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role, is_platform_admin')
    .eq('id', user.id)
    .single()

  if (!profile)                 redirect('/login')
  if (!profile.is_platform_admin) redirect('/dashboard')

  // ── Platform data (requires service-role) ────────────────────────────────
  const [
    { data: companies },
    { data: allUsers },
    { data: allProducts },
    { data: auditLogs },
    { data: salesActivity },  // company_id + date only — no PII, no amounts
    badgeCounts,
  ] = await Promise.all([

    admin
      .from('companies')
      .select('id, name, slug, is_active, created_at')
      .order('created_at', { ascending: true }),

    admin
      .from('users')
      .select('id, company_id, is_active, role, full_name, email'),

    admin
      .from('products')
      .select('company_id')
      .eq('is_active', true),

    // Platform-level events only.
    admin
      .from('audit_logs')
      .select(`
        id, created_at, action_type, entity_type, entity_id,
        company_id, user_role_snapshot, data_after,
        users!audit_logs_user_id_fkey ( full_name )
      `)
      .in('action_type', PLATFORM_EVENTS)
      .order('created_at', { ascending: false })
      .limit(500),

    // Aggregate signal per company: just company_id and timestamp.
    // We derive COUNT and last-active date in JS below — zero PII.
    admin
      .from('sales')
      .select('company_id, created_at')
      .neq('status', 'draft'),

    getBadgeCounts(profile.role, supabase),
  ])

  // ── Build per-company activity map ────────────────────────────────────────
  type ActivityEntry = { count: number; lastAt: string | null }
  const activityMap = new Map<string, ActivityEntry>()

  for (const s of salesActivity ?? []) {
    const cur = activityMap.get(s.company_id) ?? { count: 0, lastAt: null }
    activityMap.set(s.company_id, {
      count:  cur.count + 1,
      lastAt: !cur.lastAt || s.created_at > cur.lastAt ? s.created_at : cur.lastAt,
    })
  }

  // ── Build per-company 30-day sparkline arrays (index 0 = 30 days ago, 29 = today) ──
  const sparklineMap = new Map<string, number[]>()
  const sparklineRef  = new Date()
  sparklineRef.setHours(23, 59, 59, 999)

  for (const s of salesActivity ?? []) {
    const daysAgo = Math.floor(
      (sparklineRef.getTime() - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysAgo >= 0 && daysAgo < 30) {
      if (!sparklineMap.has(s.company_id)) sparklineMap.set(s.company_id, Array(30).fill(0))
      const arr = sparklineMap.get(s.company_id)!
      arr[29 - daysAgo] = (arr[29 - daysAgo] || 0) + 1
    }
  }

  // ── Enrich companies ──────────────────────────────────────────────────────
  const companiesWithStats = (companies ?? []).map(c => {
    const activity     = activityMap.get(c.id) ?? { count: 0, lastAt: null }
    const companyUsers = (allUsers ?? []).filter(u => u.company_id === c.id)
    return {
      ...c,
      totalUsers:     companyUsers.length,
      activeUsers:    companyUsers.filter(u => u.is_active).length,
      activeProducts: (allProducts ?? []).filter(p => p.company_id === c.id).length,
      salesCount:     activity.count,
      lastSaleAt:     activity.lastAt,
      sparkline:      sparklineMap.get(c.id) ?? Array(30).fill(0),
      owner:          companyUsers.find(u => u.role === 'owner') ?? null,
      // All non-owner users — shown in drawer for seat management
      members:        companyUsers.filter(u => u.role !== 'owner'),
    }
  })

  // ── Platform-wide KPI: sales this calendar month (aggregate count only) ──
  const monthStart = new Date()
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const totalSalesThisMonth = (salesActivity ?? [])
    .filter(s => s.created_at >= monthStart.toISOString()).length

  return (
    <AdminClient
      profile={profile}
      companies={companiesWithStats}
      auditLogs={auditLogs ?? []}
      totalSalesThisMonth={totalSalesThisMonth}
      badgeCounts={badgeCounts}
    />
  )
}

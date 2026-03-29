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

  if (!profile)              redirect('/login')
  if (!profile.is_platform_admin) redirect('/dashboard')

  // ── Cross-company data (requires service-role client) ────────────────────
  const [
    { data: companies },
    { data: allUsers },
    { data: allProducts },
    { data: auditLogs },
    badgeCounts,
  ] = await Promise.all([
    admin
      .from('companies')
      .select('id, name, slug, is_active, created_at')
      .order('created_at', { ascending: true }),

    // Full user profiles — needed for drawer member list + owner identification
    admin
      .from('users')
      .select('id, company_id, is_active, role, full_name, email'),

    admin
      .from('products')
      .select('company_id')
      .eq('is_active', true),

    // Platform-level audit events only
    admin
      .from('audit_logs')
      .select(`
        id, created_at, action_type, entity_type, entity_id,
        company_id, user_role_snapshot, data_after,
        users!audit_logs_user_id_fkey ( full_name )
      `)
      .in('action_type', [
        'COMPANY_CREATED',
        'COMPANY_ACTIVATED',
        'COMPANY_DEACTIVATED',
        'PLATFORM_USER_SUSPENDED',
        'PLATFORM_USER_REACTIVATED',
        'PLATFORM_USER_PASSWORD_RESET',
      ])
      .order('created_at', { ascending: false })
      .limit(200),

    getBadgeCounts(profile.role, supabase),
  ])

  // ── Enrich companies with live stats + owner only ─────────────────────────
  // Non-owner team members (vendors, warehouse, admins) are internal to each
  // company and must not be exposed to the platform operator.
  const companiesWithStats = (companies ?? []).map(c => ({
    ...c,
    totalUsers:     (allUsers ?? []).filter(u => u.company_id === c.id).length,
    activeUsers:    (allUsers ?? []).filter(u => u.company_id === c.id && u.is_active).length,
    activeProducts: (allProducts ?? []).filter(p => p.company_id === c.id).length,
    owner:          (allUsers ?? []).find(u => u.company_id === c.id && u.role === 'owner') ?? null,
    members:        [] as NonNullable<typeof allUsers>,
  }))

  return (
    <AdminClient
      profile={profile}
      companies={companiesWithStats}
      auditLogs={auditLogs ?? []}
      badgeCounts={badgeCounts}
    />
  )
}

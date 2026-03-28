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
    badgeCounts,
  ] = await Promise.all([
    admin
      .from('companies')
      .select('id, name, slug, is_active, created_at')
      .order('created_at', { ascending: true }),

    // Lightweight: only the two columns needed for per-company counts
    admin
      .from('users')
      .select('company_id, is_active'),

    admin
      .from('products')
      .select('company_id')
      .eq('is_active', true),

    getBadgeCounts(profile.role, supabase),
  ])

  // ── Enrich companies with live stats ──────────────────────────────────────
  const companiesWithStats = (companies ?? []).map(c => ({
    ...c,
    totalUsers:      (allUsers     ?? []).filter(u => u.company_id === c.id).length,
    activeUsers:     (allUsers     ?? []).filter(u => u.company_id === c.id && u.is_active).length,
    activeProducts:  (allProducts  ?? []).filter(p => p.company_id === c.id).length,
  }))

  return (
    <AdminClient
      profile={profile}
      companies={companiesWithStats}
      badgeCounts={badgeCounts}
    />
  )
}

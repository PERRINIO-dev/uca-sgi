import { createClient }   from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import { getBadgeCounts } from '@/lib/supabase/badge-counts'
import ReportsClient      from './ReportsClient'

export default async function ReportsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (!['owner', 'admin'].includes(profile.role)) redirect('/dashboard')

  // Last 90 days of sales
  const since = new Date()
  since.setDate(since.getDate() - 90)

  const { data: sales } = await supabase
    .from('sales')
    .select(`
      id, sale_number, created_at, status,
      total_amount, amount_paid, payment_status,
      customer_name, customer_phone, notes,
      boutiques ( id, name ),
      users!sales_vendor_id_fkey ( id, full_name ),
      sale_items (
        id, quantity_tiles, unit_price_per_m2,
        total_price, tile_area_m2_snapshot,
        tiles_per_carton_snapshot,
        products ( id, name, reference_code, category, purchase_price )
      )
    `)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })

  const { data: boutiques } = await supabase
    .from('boutiques')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  const { data: vendors } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('role', 'vendor')
    .eq('is_active', true)
    .order('full_name')

  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select(`
      id, created_at, action_type, entity_type, entity_id,
      user_role_snapshot, data_after,
      users!audit_logs_user_id_fkey ( full_name )
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  const badgeCounts = await getBadgeCounts(profile.role, supabase)

  return (
    <ReportsClient
      profile={profile}
      sales={sales ?? []}
      boutiques={boutiques ?? []}
      vendors={vendors ?? []}
      auditLogs={auditLogs ?? []}
      badgeCounts={badgeCounts}
    />
  )
}

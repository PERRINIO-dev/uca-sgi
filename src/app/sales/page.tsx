import { createClient }    from '@/lib/supabase/server'
import { redirect }        from 'next/navigation'
import { getBadgeCounts }  from '@/lib/supabase/badge-counts'
import SalesListClient     from './SalesListClient'

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role, boutique_id, is_platform_admin, boutiques(id, name)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (profile.is_platform_admin) redirect('/admin')

  // Warehouse role has no access to the sales page
  if (profile.role === 'warehouse') redirect('/warehouse')

  let query = supabase
    .from('sales')
    .select(`
      id, created_at, sale_number, status, vendor_id,
      total_amount, amount_paid, payment_status,
      customer_name, customer_phone, customer_cni, notes,
      boutiques(name),
      users!sales_vendor_id_fkey(full_name),
      sale_items (
        id, quantity_tiles, unit_price_per_m2,
        total_price, tile_area_m2_snapshot,
        tiles_per_carton_snapshot,
        products ( name, reference_code, product_type, unit_label )
      )
    `)
    .order('created_at', { ascending: false })

  if (profile.role === 'vendor') {
    query = query.eq('vendor_id', user.id)
  }

  const isOwnerOrAdmin = ['owner', 'admin'].includes(profile.role)

  const [{ data: sales }, badgeCounts, boutiquesResult, ownerResult] = await Promise.all([
    query,
    getBadgeCounts(profile.role, supabase),
    // Fetch boutique count for owner/admin so the client can warn before navigating
    isOwnerOrAdmin
      ? supabase.from('boutiques').select('id', { count: 'exact', head: true }).eq('is_active', true)
      : Promise.resolve({ count: 1 }),
    supabase.from('users').select('full_name').eq('role', 'owner').limit(1).single(),
  ])

  const hasBoutiques = isOwnerOrAdmin ? ((boutiquesResult as any).count ?? 0) > 0 : true
  const ownerName = (ownerResult as any).data?.full_name ?? 'Le Propriétaire'

  return (
    <SalesListClient
      profile={profile}
      sales={sales ?? []}
      badgeCounts={badgeCounts}
      errorCode={params.error}
      hasBoutiques={hasBoutiques}
      ownerName={ownerName}
    />
  )
}

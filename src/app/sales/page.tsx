import { createClient }    from '@/lib/supabase/server'
import { redirect }        from 'next/navigation'
import { getBadgeCounts }  from '@/lib/supabase/badge-counts'
import SalesListClient     from './SalesListClient'

const PAGE_SIZE = 50

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; page?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const currentPage = Math.max(1, parseInt(params.page ?? '1'))

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role, boutique_id, is_platform_admin, boutiques(id, name), companies(currency)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (profile.is_platform_admin) redirect('/admin')

  // Warehouse role has no access to the sales page
  if (profile.role === 'warehouse') redirect('/warehouse')

  const offset = (currentPage - 1) * PAGE_SIZE

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
    .range(offset, offset + PAGE_SIZE - 1)

  let countQuery = supabase
    .from('sales')
    .select('id', { count: 'exact', head: true })

  if (profile.role === 'vendor') {
    query      = query.eq('vendor_id', user.id)
    countQuery = countQuery.eq('vendor_id', user.id)
  }

  const isOwnerOrAdmin = ['owner', 'admin'].includes(profile.role)

  const [{ data: sales }, { count: totalCount }, badgeCounts, boutiquesResult, ownerResult] = await Promise.all([
    query,
    countQuery,
    getBadgeCounts(profile.role, supabase),
    // Fetch boutique count for owner/admin so the client can warn before navigating
    isOwnerOrAdmin
      ? supabase.from('boutiques').select('id', { count: 'exact', head: true }).eq('is_active', true)
      : Promise.resolve({ count: 1 }),
    supabase.from('users').select('full_name').eq('role', 'owner').limit(1).single(),
  ])

  const hasBoutiques = isOwnerOrAdmin ? ((boutiquesResult as any).count ?? 0) > 0 : true
  const ownerName = (ownerResult as any).data?.full_name ?? 'Le Propriétaire'
  const currency = (profile.companies as any)?.currency ?? 'FCFA'
  const total = totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <SalesListClient
      profile={profile}
      currency={currency}
      sales={sales ?? []}
      badgeCounts={badgeCounts}
      errorCode={params.error}
      hasBoutiques={hasBoutiques}
      ownerName={ownerName}
      currentPage={currentPage}
      totalPages={totalPages}
      totalCount={total}
    />
  )
}

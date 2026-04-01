import { createClient }    from '@/lib/supabase/server'
import { redirect }        from 'next/navigation'
import { getBadgeCounts }  from '@/lib/supabase/badge-counts'
import SalesListClient     from './SalesListClient'

const PAGE_SIZE = 50

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string; page?: string
    search?: string; status?: string; payment?: string
    dateFrom?: string; dateTo?: string; boutique_id?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const currentPage = Math.max(1, parseInt(params.page ?? '1'))

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role, is_active, boutique_id, is_platform_admin, boutiques(id, name), companies(currency, name)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (!profile.is_active) redirect('/login?error=account_suspended')
  if (profile.is_platform_admin) redirect('/admin')

  // Warehouse role has no access to the sales page
  if (profile.role === 'warehouse') redirect('/warehouse')

  const offset = (currentPage - 1) * PAGE_SIZE
  const isOwnerOrAdmin = ['owner', 'admin'].includes(profile.role)

  // Sanitize filter params
  const search     = params.search?.trim() ?? ''
  const status     = params.status ?? ''
  const payment    = params.payment ?? ''
  const dateFrom   = params.dateFrom ?? ''
  const dateTo     = params.dateTo ?? ''
  const boutiqueId = params.boutique_id ?? ''

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

  // Role-based filter: vendors see only their own sales
  if (profile.role === 'vendor') {
    query      = query.eq('vendor_id', user.id)
    countQuery = countQuery.eq('vendor_id', user.id)
  }

  // Text search across sale number, customer name, phone
  if (search) {
    const escaped = search.replace(/%/g, '\\%').replace(/_/g, '\\_')
    const like    = `%${escaped}%`
    query      = query.or(`sale_number.ilike.${like},customer_name.ilike.${like},customer_phone.ilike.${like}`)
    countQuery = countQuery.or(`sale_number.ilike.${like},customer_name.ilike.${like},customer_phone.ilike.${like}`)
  }

  if (status) {
    query      = query.eq('status', status)
    countQuery = countQuery.eq('status', status)
  }

  if (payment) {
    query      = query.eq('payment_status', payment)
    countQuery = countQuery.eq('payment_status', payment)
  }

  if (dateFrom) {
    query      = query.gte('created_at', dateFrom + 'T00:00:00')
    countQuery = countQuery.gte('created_at', dateFrom + 'T00:00:00')
  }

  if (dateTo) {
    query      = query.lte('created_at', dateTo + 'T23:59:59')
    countQuery = countQuery.lte('created_at', dateTo + 'T23:59:59')
  }

  if (boutiqueId) {
    query      = query.eq('boutique_id', boutiqueId)
    countQuery = countQuery.eq('boutique_id', boutiqueId)
  }

  const [{ data: sales }, { count: totalCount }, badgeCounts, boutiquesResult, ownerResult] = await Promise.all([
    query,
    countQuery,
    getBadgeCounts(profile.role, supabase),
    // Fetch all active boutiques for the filter dropdown (owner/admin only)
    isOwnerOrAdmin
      ? supabase.from('boutiques').select('id, name').eq('is_active', true).order('name')
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase.from('users').select('full_name').eq('role', 'owner').limit(1).single(),
  ])

  const boutiquesList = isOwnerOrAdmin ? ((boutiquesResult as any).data ?? []) : []
  const hasBoutiques  = isOwnerOrAdmin ? boutiquesList.length > 0 : true
  const ownerName     = (ownerResult as any).data?.full_name ?? 'Le Propriétaire'
  const currency      = (profile.companies as any)?.currency ?? 'FCFA'
  const companyName   = (profile.companies as any)?.name ?? 'SGI'
  const total         = totalCount ?? 0
  const totalPages    = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <SalesListClient
      key={`${currentPage}-${search}-${status}-${payment}-${dateFrom}-${dateTo}-${boutiqueId}`}
      profile={profile}
      currency={currency}
      sales={sales ?? []}
      badgeCounts={badgeCounts}
      errorCode={params.error}
      hasBoutiques={hasBoutiques}
      ownerName={ownerName}
      companyName={companyName}
      currentPage={currentPage}
      totalPages={totalPages}
      totalCount={total}
      boutiquesList={boutiquesList}
      activeSearch={search}
      activeStatus={status}
      activePayment={payment}
      activeDateFrom={dateFrom}
      activeDateTo={dateTo}
      activeBoutiqueId={boutiqueId}
    />
  )
}

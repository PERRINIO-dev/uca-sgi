import { createClient }   from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import { getBadgeCounts } from '@/lib/supabase/badge-counts'
import QuotesClient       from './QuotesClient'

const PAGE_SIZE = 50

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>
}) {
  const params  = await searchParams
  const supabase = await createClient()
  const currentPage = Math.min(10_000, Math.max(1, parseInt(params.page ?? '1')))

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
  if (profile.role === 'cashier')     redirect('/caisse')
  if (profile.role === 'delivery')    redirect('/deliveries')
  if (profile.role === 'warehouse')   redirect('/warehouse')
  if (profile.role === 'accountant')  redirect('/reports')

  const offset      = (currentPage - 1) * PAGE_SIZE
  const search      = params.search?.trim() ?? ''
  const statusParam = params.status ?? ''

  let query = supabase
    .from('sales')
    .select(`
      id, created_at, quote_number, sale_number, status, vendor_id,
      total_amount, amount_paid, payment_status,
      customer_name, customer_phone, customer_cni, notes,
      boutiques(name),
      users!sales_vendor_id_fkey(full_name),
      sale_items (
        id, quantity_tiles, unit_price_per_m2,
        total_price, tile_area_m2_snapshot, tiles_per_carton_snapshot,
        products ( name, reference_code, product_type, unit_label, bag_weight_kg, pieces_per_package, package_label )
      )
    `)
    .in('status', ['draft', 'cancelled'])
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  let countQuery = supabase
    .from('sales')
    .select('id', { count: 'exact', head: true })
    .in('status', ['draft', 'cancelled'])

  if (['seller', 'field_agent'].includes(profile.role)) {
    query      = query.eq('vendor_id', user.id)
    countQuery = countQuery.eq('vendor_id', user.id)
  }

  if (search) {
    const escaped = search.replace(/%/g, '\\%').replace(/_/g, '\\_')
    const like    = `%${escaped}%`
    query      = query.or(`quote_number.ilike.${like},customer_name.ilike.${like},customer_phone.ilike.${like}`)
    countQuery = countQuery.or(`quote_number.ilike.${like},customer_name.ilike.${like},customer_phone.ilike.${like}`)
  }

  if (statusParam) {
    query      = query.eq('status', statusParam)
    countQuery = countQuery.eq('status', statusParam)
  }

  const [{ data: quotes }, { count: totalCount }, badgeCounts, ownerResult] = await Promise.all([
    query,
    countQuery,
    getBadgeCounts(profile.role, supabase),
    supabase.from('users').select('full_name').eq('role', 'owner').limit(1).single(),
  ])

  const currency    = (profile.companies as any)?.currency ?? 'FCFA'
  const companyName = (profile.companies as any)?.name ?? 'SGI'
  const ownerName   = (ownerResult as any).data?.full_name ?? 'Le Propriétaire'
  const total       = totalCount ?? 0
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <QuotesClient
      profile={profile}
      currency={currency}
      quotes={quotes ?? []}
      badgeCounts={badgeCounts}
      companyName={companyName}
      ownerName={ownerName}
      currentPage={currentPage}
      totalPages={totalPages}
      totalCount={total}
      activeSearch={search}
      activeStatus={statusParam}
    />
  )
}

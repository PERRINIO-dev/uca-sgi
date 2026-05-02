import { createClient }   from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import { getBadgeCounts } from '@/lib/supabase/badge-counts'
import SuppliersClient    from './SuppliersClient'

export default async function SuppliersPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role, is_active, boutique_id, is_platform_admin, companies(currency, name)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (!profile.is_active) redirect('/login?error=account_suspended')
  if (profile.is_platform_admin) redirect('/admin')
  if (!['owner', 'manager', 'warehouse', 'accountant'].includes(profile.role)) redirect('/dashboard')

  const [badgeCounts, suppliersRes, ordersRes, productsRes] = await Promise.all([
    getBadgeCounts(profile.role, supabase),

    supabase
      .from('suppliers')
      .select('id, name, contact_name, phone, email, address, notes, is_active, created_at')
      .order('name'),

    supabase
      .from('purchase_orders')
      .select(`
        id, order_number, supplier_id, status, expected_date, notes,
        total_amount, created_at, received_at,
        suppliers(name),
        purchase_order_items(
          id, product_id, qty_ordered, unit_price, qty_received,
          products(name, reference_code, unit_label, product_type)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(200),

    supabase
      .from('products')
      .select('id, name, reference_code, unit_label, product_type, is_active')
      .eq('is_active', true)
      .order('name'),
  ])

  const currency    = (profile.companies as any)?.currency ?? 'FCFA'
  const companyName = (profile.companies as any)?.name ?? 'SGI'

  return (
    <SuppliersClient
      profile={profile}
      currency={currency}
      companyName={companyName}
      badgeCounts={badgeCounts}
      initialSuppliers={suppliersRes.data ?? []}
      initialOrders={(ordersRes.data ?? []) as any[]}
      products={productsRes.data ?? []}
    />
  )
}

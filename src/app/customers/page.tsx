import { createClient }   from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import { getBadgeCounts } from '@/lib/supabase/badge-counts'
import CustomersClient    from './CustomersClient'

export default async function CustomersPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role, is_active, is_platform_admin, companies(currency, name)')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) redirect('/login')
  if (profile.is_platform_admin)       redirect('/admin')
  if (profile.role === 'warehouse')    redirect('/warehouse')
  if (!['owner', 'admin', 'vendor'].includes(profile.role)) redirect('/dashboard')

  const [customersResult, badgeCounts] = await Promise.all([
    supabase.rpc('get_customers_with_stats'),
    getBadgeCounts(profile.role, supabase),
  ])

  const currency = (profile.companies as any)?.currency ?? 'FCFA'

  return (
    <CustomersClient
      profile={profile}
      currency={currency}
      customers={customersResult.data ?? []}
      badgeCounts={badgeCounts}
    />
  )
}

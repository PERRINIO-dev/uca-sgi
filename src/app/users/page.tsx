import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import UsersClient      from './UsersClient'

export default async function UsersPage() {
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

  const { data: employees } = await supabase
    .from('users')
    .select(`
      id, email, full_name, role,
      is_active, created_at,
      boutiques ( id, name )
    `)
    .order('created_at', { ascending: false })

  const { data: boutiques } = await supabase
    .from('boutiques')
    .select('id, name, is_active')
    .order('name')

  return (
    <UsersClient
      profile={profile}
      employees={employees ?? []}
      boutiques={boutiques ?? []}
      currentUserId={user.id}
    />
  )
}

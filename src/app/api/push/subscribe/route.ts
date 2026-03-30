import { NextRequest, NextResponse }          from 'next/server'
import { createServerClient }                 from '@supabase/ssr'
import { getAdminClient } from '@/lib/supabase/admin'
import { cookies }        from 'next/headers'

const getAdmin = getAdminClient

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  return supabase.auth.getUser()
}

// POST /api/push/subscribe — save or refresh a push subscription
export async function POST(req: NextRequest) {
  const { data: { user } } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subscription } = await req.json()
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const admin = getAdmin()
  await admin.from('push_subscriptions').upsert(
    {
      user_id:      user.id,
      endpoint:     subscription.endpoint,
      subscription: subscription,
    },
    { onConflict: 'endpoint' },
  )

  return NextResponse.json({ ok: true })
}

// DELETE /api/push/subscribe — remove a push subscription on logout/unsubscribe
export async function DELETE(req: NextRequest) {
  const { data: { user } } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint } = await req.json()
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })

  const admin = getAdmin()
  await admin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  return NextResponse.json({ ok: true })
}

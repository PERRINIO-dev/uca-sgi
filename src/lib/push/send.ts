import webPush from 'web-push'

// Only configure once per process
let vapidConfigured = false
function ensureVapid() {
  if (vapidConfigured) return
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return
  webPush.setVapidDetails(
    process.env.VAPID_CONTACT ?? 'mailto:admin@sgi.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
  vapidConfigured = true
}

// Accept any Supabase admin client regardless of generic parameters
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = { from: (table: string) => any }

export interface PushPayload {
  title: string
  body:  string
  url?:  string
  tag?:  string
}

async function dispatch(subs: { subscription: unknown }[], payload: PushPayload) {
  ensureVapid()
  if (!vapidConfigured || !subs.length) return
  const data = JSON.stringify(payload)
  await Promise.allSettled(
    subs.map(({ subscription }) =>
      webPush.sendNotification(
        subscription as webPush.PushSubscription,
        data,
      ).catch(() => { /* stale subscription — ignore */ })
    )
  )
}

/** Send a push notification to all active users with any of the given roles,
 *  scoped to a specific company (admin client bypasses RLS, so we must filter
 *  company_id explicitly to prevent cross-tenant notification leakage). */
export async function sendPushToRoles(
  admin:     AdminClient,
  roles:     string[],
  payload:   PushPayload,
  companyId: string,
) {
  const { data: users } = await admin
    .from('users')
    .select('id')
    .in('role', roles)
    .eq('is_active', true)
    .eq('company_id', companyId)

  if (!users?.length) return

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('subscription')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .in('user_id', users.map((u: any) => u.id))

  await dispatch(subs ?? [], payload)
}

/** Send a push notification to a single specific user */
export async function sendPushToUser(
  admin:   AdminClient,
  userId:  string,
  payload: PushPayload,
) {
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId)

  await dispatch(subs ?? [], payload)
}

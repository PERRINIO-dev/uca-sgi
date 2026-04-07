import webPush from 'web-push'

// Only configure once per process
let vapidConfigured = false
function ensureVapid() {
  if (vapidConfigured) return
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return
  webPush.setVapidDetails(
    process.env.VAPID_CONTACT ?? 'mailto:admin@meram.app',
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

async function dispatch(
  admin: AdminClient,
  subs: { endpoint: string; subscription: unknown }[],
  payload: PushPayload,
) {
  ensureVapid()
  if (!vapidConfigured || !subs.length) return
  const data = JSON.stringify(payload)

  const results = await Promise.allSettled(
    subs.map(({ subscription }) =>
      webPush.sendNotification(subscription as webPush.PushSubscription, data)
    )
  )

  // Remove stale subscriptions (410 Gone = browser revoked, 404 = endpoint gone)
  const staleEndpoints: string[] = []
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const status = (result.reason as any)?.statusCode
      if (status === 410 || status === 404) {
        staleEndpoints.push(subs[i].endpoint)
      }
    }
  })

  if (staleEndpoints.length > 0) {
    admin
      .from('push_subscriptions')
      .delete()
      .in('endpoint', staleEndpoints)
      .then(() => {})
      .catch((err: unknown) => console.error('[Push] Failed to delete stale subscriptions:', err))
  }
}

/** Send a push notification to all active users with any of the given roles,
 *  scoped to a specific company (admin client bypasses RLS, so we must filter
 *  company_id explicitly to prevent cross-tenant notification leakage).
 *  Single query via join — avoids the two-step users → subscriptions lookup. */
export async function sendPushToRoles(
  admin:     AdminClient,
  roles:     string[],
  payload:   PushPayload,
  companyId: string,
) {
  // Join push_subscriptions → users in one query
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, subscription, users!inner(role, is_active, company_id)')
    .eq('users.company_id', companyId)
    .eq('users.is_active', true)
    .in('users.role', roles)

  if (!subs?.length) return
  await dispatch(admin, subs, payload)
}

/** Send a push notification to a single specific user */
export async function sendPushToUser(
  admin:   AdminClient,
  userId:  string,
  payload: PushPayload,
) {
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, subscription')
    .eq('user_id', userId)

  if (!subs?.length) return
  await dispatch(admin, subs, payload)
}

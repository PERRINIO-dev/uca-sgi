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
 *  scoped to a specific company.
 *
 *  Two-step approach (instead of a JOIN) because push_subscriptions.user_id
 *  typically FKs to auth.users — PostgREST only operates on the public schema
 *  and cannot resolve cross-schema joins, so users!inner would return 0 rows. */
export async function sendPushToRoles(
  admin:     AdminClient,
  roles:     string[],
  payload:   PushPayload,
  companyId: string,
) {
  // Step 1: resolve user IDs that match the role/company criteria
  const { data: users } = await admin
    .from('users')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .in('role', roles)

  if (!users?.length) return

  const userIds = users.map((u: { id: string }) => u.id)

  // Step 2: fetch push subscriptions for those users
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, subscription')
    .in('user_id', userIds)

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

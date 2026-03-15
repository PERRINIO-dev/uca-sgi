// UCA SGI — Service Worker v2
const CACHE_NAME   = 'uca-sgi-v2'
const OFFLINE_URL  = '/offline.html'

// Pages to pre-cache so they're available instantly
const SHELL_PAGES  = [OFFLINE_URL, '/login']

// ── Install ───────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_PAGES))
  )
  self.skipWaiting()
})

// ── Activate: wipe old caches ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle GET from same origin
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // Next.js immutable static chunks: cache-first, long-lived
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(res => {
          caches.open(CACHE_NAME).then(c => c.put(request, res.clone()))
          return res
        })
      })
    )
    return
  }

  // Next.js image optimisation: cache-first
  if (url.pathname.startsWith('/_next/image')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(res => {
          if (res.ok) {
            caches.open(CACHE_NAME).then(c => c.put(request, res.clone()))
          }
          return res
        })
      })
    )
    return
  }

  // Static public assets (icons, sw, manifest…): cache-first
  if (
    url.pathname.startsWith('/icon') ||
    url.pathname.startsWith('/apple-icon') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/offline.html' ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png')
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(res => {
          caches.open(CACHE_NAME).then(c => c.put(request, res.clone()))
          return res
        })
      })
    )
    return
  }

  // HTML navigation: network-first, fall back to cached version, then offline page
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(res => {
          // Cache a fresh copy for offline use
          if (res.ok) {
            caches.open(CACHE_NAME).then(c => c.put(request, res.clone()))
          }
          return res
        })
        .catch(() =>
          caches.match(request).then(cached =>
            cached ?? caches.match(OFFLINE_URL)
          )
        )
    )
    return
  }
})

// ── Push notifications ────────────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'UCA SGI', body: event.data.text() }
  }

  const { title, body, url = '/', tag = 'uca-sgi' } = payload

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:               '/icon',
      badge:              '/icon',
      tag,
      data:               { url },
      requireInteraction: false,
      vibrate:            [100, 50, 100],
    })
  )
})

// ── Notification click: focus or open the target URL ─────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()

  const targetUrl = event.notification.data?.url ?? '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // If a window is already open on this origin, navigate it
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus()
            client.navigate(targetUrl)
            return
          }
        }
        // Otherwise open a new window
        return self.clients.openWindow(targetUrl)
      })
  )
})

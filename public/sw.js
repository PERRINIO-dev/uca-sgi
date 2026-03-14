// UCA SGI — Service Worker v1
const CACHE_NAME  = 'uca-sgi-v1'
const OFFLINE_URL = '/offline.html'

// ── Install: pre-cache the offline fallback ───────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([OFFLINE_URL]))
  )
  self.skipWaiting()
})

// ── Activate: clean up old caches ────────────────────────────────────────
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

  // Only handle GET requests from same origin
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // Next.js static assets (_next/static): cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(res => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          return res
        })
      })
    )
    return
  }

  // HTML navigation: network-first, fall back to cached page, then offline
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
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

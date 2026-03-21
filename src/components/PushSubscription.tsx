'use client'

import { useEffect, useState } from 'react'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

async function subscribeToPush() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!key) return

  const reg = await navigator.serviceWorker.ready
  let sub   = await reg.pushManager.getSubscription()

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(key).buffer as ArrayBuffer,
    })
  }

  await fetch('/api/push/subscribe', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ subscription: sub.toJSON() }),
  })
}

export default function PushSubscription() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    if (Notification.permission === 'denied') return

    if (Notification.permission === 'granted') {
      // Already granted — silently ensure subscription is registered
      subscribeToPush().catch(console.error)
      return
    }

    // Not yet decided — show the banner after a short delay
    // (only if not already dismissed this session)
    if (sessionStorage.getItem('uca-push-session-dismissed')) return
    const t = setTimeout(() => setShowBanner(true), 2500)
    return () => clearTimeout(t)
  }, [])

  const handleEnable = async () => {
    setShowBanner(false)
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      subscribeToPush().catch(console.error)
    }
  }

  const handleDismiss = () => {
    // Only dismiss for this session — banner reappears on next login
    sessionStorage.setItem('uca-push-session-dismissed', '1')
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div style={{
      position:   'fixed',
      top:        16,
      right:      16,
      zIndex:     9998,
      background: '#FFFFFF',
      border:     '1px solid #E2E8F0',
      borderRadius: 12,
      boxShadow:  '0 8px 32px rgba(0,0,0,0.12)',
      padding:    '16px 18px',
      maxWidth:   300,
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    }}>
      {/* Bell icon */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 9, background: '#EFF6FF',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 3 }}>
            Activer les notifications
          </div>
          <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
            Recevez des alertes pour les nouvelles commandes, stocks bas et demandes en attente.
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleDismiss}
          style={{
            flex: 1, padding: '8px', borderRadius: 7, border: '1px solid #E2E8F0',
            background: '#F8FAFC', color: '#475569', fontSize: 12,
            fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Plus tard
        </button>
        <button
          onClick={handleEnable}
          style={{
            flex: 1, padding: '8px', borderRadius: 7, border: 'none',
            background: '#2563EB', color: '#fff', fontSize: 12,
            fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Activer
        </button>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'uca-sgi-tour-v1'
const FONT        = "system-ui, -apple-system, 'Segoe UI', sans-serif"
const OVERLAY     = 'rgba(10,18,36,0.75)'
const PAD         = 10
const GAP         = 16
const TW          = 292

interface Step {
  title:     string
  desc:      string
  target:    string | null
  placement?: 'top' | 'bottom' | 'right' | 'left'
}

const STEPS: Step[] = [
  {
    title:  'Bienvenue dans UCA SGI',
    desc:   "Voici un tour rapide des fonctionnalités principales. Cela ne prendra qu'une minute.",
    target: null,
  },
  {
    title:     'Indicateurs du mois',
    desc:      "Chiffre d'affaires, créances clients, commandes actives et marge brute — mis à jour en temps réel.",
    target:    'tour-kpis',
    placement: 'bottom',
  },
  {
    title:     'Tendance des ventes',
    desc:      "Évolution quotidienne sur 30 jours et répartition par boutique pour analyser les performances.",
    target:    'tour-chart',
    placement: 'top',
  },
  {
    title:     'Module Ventes',
    desc:      "Créez des ventes, enregistrez des paiements progressifs et gérez les créances sur le long terme.",
    target:    'tour-nav-sales',
    placement: 'right',
  },
  {
    title:     'Module Entrepôt',
    desc:      "Soumettez et validez des demandes de stock, gérez les commandes et les niveaux d'inventaire.",
    target:    'tour-nav-warehouse',
    placement: 'right',
  },
  {
    title:     'Rapports & Audit',
    desc:      "Performances financières, statistiques produits et journal d'audit complet pour une traçabilité totale.",
    target:    'tour-nav-reports',
    placement: 'right',
  },
  {
    title:  'Vous êtes prêt !',
    desc:   'UCA SGI est opérationnel. Toutes les fonctionnalités sont accessibles depuis la barre de navigation.',
    target: null,
  },
]

// ── Geometry ──────────────────────────────────────────────────────────────────
interface Box { top: number; left: number; width: number; height: number }

function measureBox(target: string): Box | null {
  const el = document.querySelector(`[data-tour="${target}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  // Off-screen (e.g. closed mobile sidebar)
  if (r.right < -50 || r.bottom < 0 || r.left > window.innerWidth + 50) return null
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }
}

function calcPos(box: Box, p: Step['placement']): React.CSSProperties {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cx = box.left + box.width  / 2
  const cy = box.top  + box.height / 2
  if (p === 'bottom') return { top:  box.top + box.height + GAP, left: Math.max(12, Math.min(cx - TW / 2, vw - TW - 12)) }
  if (p === 'top')    return { bottom: Math.max(12, vh - box.top + GAP), left: Math.max(12, Math.min(cx - TW / 2, vw - TW - 12)) }
  if (p === 'right') {
    const left = box.left + box.width + GAP
    if (left + TW > vw - 12) return { top: Math.max(12, cy - 80), right: Math.max(12, vw - box.left + GAP) }
    return { top: Math.max(12, cy - 80), left }
  }
  return {}
}

// ── Arrow ─────────────────────────────────────────────────────────────────────
function Arrow({ p, flipped }: { p?: Step['placement']; flipped: boolean }) {
  const s: React.CSSProperties = { position: 'absolute', width: 0, height: 0 }
  const dir = flipped ? 'left' : p
  if (dir === 'bottom') return <div style={{ ...s, top:    -8, left: '50%', transform: 'translateX(-50%)', borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: '8px solid #fff' }} />
  if (dir === 'top')    return <div style={{ ...s, bottom: -8, left: '50%', transform: 'translateX(-50%)', borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop:    '8px solid #fff' }} />
  if (dir === 'right')  return <div style={{ ...s, left:   -8, top: '50%', transform: 'translateY(-50%)', borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderRight: '8px solid #fff' }} />
  if (dir === 'left')   return <div style={{ ...s, right:  -8, top: '50%', transform: 'translateY(-50%)', borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderLeft:  '8px solid #fff' }} />
  return null
}

// ── Progress dots ─────────────────────────────────────────────────────────────
function Dots({ count, current, size = 'sm' }: { count: number; current: number; size?: 'sm' | 'lg' }) {
  const h = size === 'lg' ? 6 : 4
  const w = size === 'lg' ? 22 : 14
  const g = size === 'lg' ? 5 : 4
  return (
    <div style={{ display: 'flex', gap: g }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          height: h, borderRadius: h / 2,
          width:      i === current ? w : h,
          background: i === current ? '#2563EB' : i < current ? '#BFDBFE' : '#E2E8F0',
          transition: 'all .3s',
        }} />
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OnboardingTour() {
  const [active, setActive] = useState(false)
  const [idx,    setIdx]    = useState(0)
  const [box,    setBox]    = useState<Box | null>(null)
  const [pos,    setPos]    = useState<React.CSSProperties>({})
  const idxRef = useRef(0)
  idxRef.current = idx

  // Show once
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return
    const t = setTimeout(() => setActive(true), 800)
    return () => clearTimeout(t)
  }, [])

  // Update spotlight position on step change or resize
  useEffect(() => {
    if (!active) return
    const s = STEPS[idx]

    function update() {
      if (!s.target) { setBox(null); setPos({}); return }
      const el = document.querySelector(`[data-tour="${s.target}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      const delay = el ? 320 : 0
      const t = setTimeout(() => {
        const b = measureBox(s.target!)
        setBox(b)
        setPos(b && s.placement ? calcPos(b, s.placement) : {})
      }, delay)
      return t
    }

    const t = update()
    window.addEventListener('resize', update as EventListener)
    return () => {
      if (t) clearTimeout(t)
      window.removeEventListener('resize', update as EventListener)
    }
  }, [active, idx])

  // Keyboard nav
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { done(); return }
      if (e.key === 'ArrowRight') {
        if (idxRef.current >= STEPS.length - 1) done()
        else setIdx(i => i + 1)
        return
      }
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const done = () => { setActive(false); localStorage.setItem(STORAGE_KEY, '1') }
  const next = () => { if (idx >= STEPS.length - 1) done(); else setIdx(i => i + 1) }
  const prev = () => setIdx(i => Math.max(0, i - 1))

  if (!active) return null

  const step    = STEPS[idx]
  const isFirst = idx === 0
  const isLast  = idx === STEPS.length - 1
  const noSpot  = !step.target || !box

  // ── CENTER MODAL (welcome, done, or mobile fallback) ──────────────────────
  if (noSpot) {
    return (
      <>
        <div style={{ position: 'fixed', inset: 0, background: OVERLAY, zIndex: 9990, backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }} />

        <div key={idx} style={{
          position: 'fixed', zIndex: 9992,
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(420px, calc(100vw - 32px))',
          background: '#fff', borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.28)',
          fontFamily: FONT, animation: 'ot-fade .25s ease',
        }}>
          <div style={{ height: 4, background: 'linear-gradient(90deg,#1B3A6B,#2563EB)' }} />
          <div style={{ padding: '32px 32px 28px' }}>

            {/* Icon */}
            {isFirst
              ? (
                <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg,#2563EB,#1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 8px 24px rgba(37,99,235,0.28)' }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', fontFamily: 'Georgia,serif' }}>U</span>
                </div>
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, animation: 'ot-pop .4s ease' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12l5 5L20 7" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )
            }

            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
              {step.title}
            </h2>
            <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.65, margin: '0 0 24px' }}>
              {step.desc}
            </p>

            <div style={{ marginBottom: 24 }}>
              <Dots count={STEPS.length} current={idx} size="lg" />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {!isFirst && !isLast && (
                <button onClick={prev} style={{ padding: '11px 18px', background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: FONT }}>
                  Précédent
                </button>
              )}
              <div style={{ flex: 1 }} />
              {!isLast && (
                <button onClick={done} style={{ padding: '11px 14px', background: 'transparent', color: '#94A3B8', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: FONT }}>
                  Passer
                </button>
              )}
              <button onClick={next} style={{
                padding: '11px 24px', background: '#1B3A6B', color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: FONT,
                display: 'flex', alignItems: 'center', gap: 7,
                boxShadow: '0 4px 14px rgba(27,58,107,0.3)',
              }}>
                {isLast ? 'Commencer' : 'Démarrer le guide'}
                {!isLast && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7h8M7.5 4l3.5 3-3.5 3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </div>

          </div>
        </div>

        <style>{`
          @keyframes ot-fade { from { opacity:0; transform:translate(-50%,calc(-50% + 14px)) } to { opacity:1; transform:translate(-50%,-50%) } }
          @keyframes ot-pop  { 0% { transform:scale(.5) } 70% { transform:scale(1.15) } 100% { transform:scale(1) } }
        `}</style>
      </>
    )
  }

  // ── SPOTLIGHT + TOOLTIP ────────────────────────────────────────────────────
  const flipped = step.placement === 'right' && box != null && (box.left + box.width + GAP + TW) > window.innerWidth - 12

  return (
    <>
      {/* Click blocker — prevents interacting with the app during the tour */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9990, cursor: 'default' }} />

      {/* Spotlight — box-shadow creates the dark overlay around the highlighted element */}
      <div style={{
        position: 'fixed',
        top: box.top, left: box.left, width: box.width, height: box.height,
        borderRadius: 12,
        boxShadow: `0 0 0 9999px ${OVERLAY}, 0 0 0 2px rgba(59,130,246,0.8), 0 0 28px rgba(59,130,246,0.2)`,
        zIndex: 9991,
        pointerEvents: 'none',
        transition: 'top .3s cubic-bezier(.4,0,.2,1), left .3s cubic-bezier(.4,0,.2,1), width .3s, height .3s',
      }} />

      {/* Tooltip */}
      <div key={`tip-${idx}`} style={{
        position: 'fixed', ...pos, width: TW,
        zIndex: 9993, background: '#fff', borderRadius: 14,
        boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
        fontFamily: FONT, animation: 'ot-tip .2s ease',
        overflow: 'visible',
      }}>
        {step.placement && <Arrow p={step.placement} flipped={flipped} />}

        {/* Progress bar */}
        <div style={{ height: 3, borderRadius: '14px 14px 0 0', background: '#F1F5F9', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(idx + 1) / STEPS.length * 100}%`, background: 'linear-gradient(90deg,#1B3A6B,#2563EB)', transition: 'width .3s' }} />
        </div>

        <div style={{ padding: '14px 16px' }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#2563EB', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Étape {idx + 1} / {STEPS.length}
            </span>
            <button onClick={done} aria-label="Fermer le guide" style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#94A3B8', display: 'flex', lineHeight: 1 }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
            {step.title}
          </h3>
          <p style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.6, margin: '0 0 12px' }}>
            {step.desc}
          </p>

          <div style={{ marginBottom: 12 }}>
            <Dots count={STEPS.length} current={idx} />
          </div>

          {/* Nav buttons */}
          <div style={{ display: 'flex', gap: 7 }}>
            {idx > 0 && (
              <button onClick={prev} style={{ padding: '8px 14px', background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: FONT }}>
                Précédent
              </button>
            )}
            <button onClick={next} style={{
              flex: 1, padding: '8px 0', background: '#1B3A6B', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', fontFamily: FONT,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              {isLast ? 'Terminer' : 'Suivant'}
              {!isLast && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6h8M6.5 3l3.5 3-3.5 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes ot-tip { from { opacity:0; transform:scale(.92) } to { opacity:1; transform:scale(1) } }`}</style>
    </>
  )
}

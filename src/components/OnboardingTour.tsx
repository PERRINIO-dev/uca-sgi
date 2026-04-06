'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// ── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'meram-sgi-tour-v2'
const FONT        = "system-ui, -apple-system, 'Segoe UI', sans-serif"
const OVERLAY     = 'rgba(10,18,36,0.72)'
const TW          = 304   // tooltip panel width (desktop)
const PAD         = 10    // spotlight padding
const GAP         = 14    // gap between spotlight and tooltip

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  ink:     '#1C1917', slate:  '#44403C', muted:  '#78716C',
  border:  '#E7E5E4', bg:     '#F5F2ED', surface: '#FDFCF9',
  blue:    '#2563EB', blueL:  '#EFF6FF',
  green:   '#059669', greenL: '#ECFDF5',
  orange:  '#D97706',
  purple:  '#8B5CF6',
}

// ── Step definitions ──────────────────────────────────────────────────────────
interface TourStep {
  title:      string
  body:       string
  bullets?:   string[]
  target:     string | null    // data-tour attr; null = modal display
  page:       string | null    // required pathname; null = show on any page
  nextPage?:  string           // page to navigate to when advancing
  placement?: 'top' | 'bottom' | 'right' | 'left'
  accent:     string
}

const STEPS: TourStep[] = [
  {
    title:    'Bienvenue dans MERAM SGI',
    body:     "Votre système de gestion intégré pour le commerce de matériaux. Ce guide vous présente les modules essentiels — il ne prend que 2 minutes.",
    target:   null, page: null, nextPage: '/dashboard',
    accent:   C.blue,
  },
  {
    title:    'Indicateurs en temps réel',
    body:     "Chiffre d'affaires, créances clients, commandes actives et marge brute — mis à jour automatiquement à chaque transaction.",
    target:   'tour-kpis', page: '/dashboard', placement: 'bottom',
    accent:   C.blue,
  },
  {
    title:    'Tendance des ventes',
    body:     "30 jours d'évolution quotidienne et performance par boutique pour piloter votre activité commerciale.",
    target:   'tour-chart', page: '/dashboard', placement: 'top',
    nextPage: '/sales',
    accent:   C.blue,
  },
  {
    title:    'Module Ventes',
    body:     "Enregistrez des ventes en quelques secondes, gérez les paiements progressifs et suivez les créances. Chaque vente génère un bon de commande entrepôt automatiquement.",
    bullets:  ['Paiements par acomptes et solde', 'Créances clients centralisées', 'Bons de commande automatiques'],
    target:   null, page: '/sales', nextPage: '/products',
    accent:   C.green,
  },
  {
    title:    'Catalogue Produits',
    body:     "Tous vos produits en un seul endroit — carreaux, peinture, matériaux en vrac. Stock disponible en temps réel avec prix plancher protégé.",
    bullets:  ['5 types de produits supportés', 'Prix plancher anti-fraude', 'Stock consulté en temps réel'],
    target:   null, page: '/products', nextPage: '/warehouse',
    accent:   C.orange,
  },
  {
    title:    'Entrepôt & Logistique',
    body:     "Le poste de travail de l'équipe logistique. Demandes de réapprovisionnement, validation des livraisons et préparation des commandes.",
    bullets:  ['Demandes soumises par les vendeurs', 'Validation par le gestionnaire', 'Fiche de préparation imprimable'],
    target:   null, page: '/warehouse', nextPage: '/reports',
    accent:   C.purple,
  },
  {
    title:    'Rapports & Analyses',
    body:     "Tableaux de bord financiers, classement produits et journal d'audit complet — toutes les décisions s'appuient sur des données fiables.",
    bullets:  ['Performances financières détaillées', 'Produits les plus vendus', "Journal d'audit complet"],
    target:   null, page: '/reports',
    accent:   C.orange,
  },
  {
    title:    "C'est parti !",
    body:     "MERAM SGI est entièrement opérationnel. Commencez par explorer le catalogue ou créez votre première vente.",
    target:   null, page: null,
    accent:   C.green,
  },
]

// ── localStorage helpers ──────────────────────────────────────────────────────
function readStore(): { step: number } | 'done' | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    if (raw === 'done') return 'done'
    return JSON.parse(raw) as { step: number }
  } catch { return null }
}
function writeStore(step: number) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ step })) } catch {}
}
function markDone() {
  try { localStorage.setItem(STORAGE_KEY, 'done') } catch {}
}

// ── Spotlight geometry ────────────────────────────────────────────────────────
interface Box { top: number; left: number; width: number; height: number }

function measureBox(target: string): Box | null {
  const el = document.querySelector(`[data-tour="${target}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.right < -50 || r.bottom < 0 || r.left > window.innerWidth + 50 || r.top > window.innerHeight + 100) return null
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }
}

function calcTipPos(box: Box, p: TourStep['placement']): React.CSSProperties {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cx = box.left + box.width / 2
  const cy = box.top + box.height / 2
  if (p === 'bottom') return { top: box.top + box.height + GAP, left: Math.max(12, Math.min(cx - TW / 2, vw - TW - 12)) }
  if (p === 'top')    return { bottom: Math.max(12, vh - box.top + GAP), left: Math.max(12, Math.min(cx - TW / 2, vw - TW - 12)) }
  if (p === 'right') {
    const lft = box.left + box.width + GAP
    return lft + TW > vw - 12
      ? { top: Math.max(12, cy - 80), right: Math.max(12, vw - box.left + GAP) }
      : { top: Math.max(12, cy - 80), left: lft }
  }
  return { top: Math.max(12, cy - 80), left: Math.max(12, box.left - TW - GAP) }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ModuleIcon({ step, size = 26 }: { step: TourStep; size?: number }) {
  const w = size
  // MERAM logo (welcome + done)
  if (step.target === null && (step.accent === C.blue || step.accent === C.green) && !step.page) {
    if (step.accent === C.green) {
      return (
        <svg width={w} height={w} viewBox="0 0 24 24" fill="none">
          <path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    }
    return (
      <svg width={w} height={Math.round(w * 0.85)} viewBox="0 0 20 17" fill="none">
        <path d="M2 15V2L10 9L18 2V15" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 15h16" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
      </svg>
    )
  }
  if (step.page === '/dashboard' || (!step.page && step.accent === C.blue)) {
    return (
      <svg width={w} height={w} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="12" width="4" height="9" rx="1.5" fill="#fff"/>
        <rect x="10" y="7" width="4" height="14" rx="1.5" fill="#fff"/>
        <rect x="17" y="3" width="4" height="18" rx="1.5" fill="#fff"/>
      </svg>
    )
  }
  if (step.page === '/sales') {
    return (
      <svg width={w} height={w} viewBox="0 0 24 24" fill="none">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M3 6h18M16 10a4 4 0 01-8 0" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    )
  }
  if (step.page === '/products') {
    return (
      <svg width={w} height={w} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="8" height="8" rx="2" fill="#fff" fillOpacity="0.8"/>
        <rect x="13" y="3" width="8" height="8" rx="2" fill="#fff"/>
        <rect x="3" y="13" width="8" height="8" rx="2" fill="#fff"/>
        <rect x="13" y="13" width="8" height="8" rx="2" fill="#fff" fillOpacity="0.7"/>
      </svg>
    )
  }
  if (step.page === '/warehouse') {
    return (
      <svg width={w} height={w} viewBox="0 0 24 24" fill="none">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
        <rect x="9" y="14" width="6" height="7" rx="1" fill="#fff" fillOpacity="0.75"/>
      </svg>
    )
  }
  if (step.page === '/reports') {
    return (
      <svg width={w} height={w} viewBox="0 0 24 24" fill="none">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M14 2v6h6M8 13h8M8 17h5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    )
  }
  return null
}

function Dots({ count, current, size = 'sm' }: { count: number; current: number; size?: 'sm' | 'lg' }) {
  const h = size === 'lg' ? 6 : 4
  const aw = size === 'lg' ? 24 : 16
  const g = size === 'lg' ? 5 : 4
  return (
    <div style={{ display: 'flex', gap: g, alignItems: 'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          height: h, borderRadius: h / 2,
          width:      i === current ? aw : h,
          background: i === current ? C.blue : i < current ? '#BFDBFE' : '#D4D1CC',
          transition: 'all .28s cubic-bezier(.4,0,.2,1)',
          flexShrink: 0,
        }} />
      ))}
    </div>
  )
}

function Arrow({ placement }: { placement?: string }) {
  const s: React.CSSProperties = { position: 'absolute', width: 0, height: 0 }
  if (placement === 'bottom') return <div style={{ ...s, top: -7, left: '50%', transform: 'translateX(-50%)', borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: `7px solid ${C.surface}` }} />
  if (placement === 'top')    return <div style={{ ...s, bottom: -7, left: '50%', transform: 'translateX(-50%)', borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: `7px solid ${C.surface}` }} />
  if (placement === 'right')  return <div style={{ ...s, left: -7, top: 40, borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderRight: `7px solid ${C.surface}` }} />
  return null
}

function BulletList({ items, accent }: { items: string[]; accent: string }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'flex', flexDirection: 'column', gap: 7 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: C.slate, fontFamily: FONT }}>
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            background: accent + '1A', border: `1px solid ${accent}35`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginTop: 1,
          }}>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1.5 4.5l2 2 3-4" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {item}
        </li>
      ))}
    </ul>
  )
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Fermer le guide"
      style={{
        background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%',
        width: 28, height: 28, cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M1 1l8 8M9 1L1 9" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    </button>
  )
}

const KEYFRAMES = `
  @keyframes ot-bg     { from { opacity:0 } to { opacity:1 } }
  @keyframes ot-modal  { from { opacity:0; transform:scale(.94) translateY(10px) } to { opacity:1; transform:scale(1) translateY(0) } }
  @keyframes ot-pop    { 0% { transform:scale(.55) } 70% { transform:scale(1.12) } 100% { transform:scale(1) } }
  @keyframes ot-tip    { from { opacity:0; transform:scale(.9) } to { opacity:1; transform:scale(1) } }
  @keyframes ot-sheet  { from { transform:translateY(100%) } to { transform:translateY(0) } }
`

// ── Main component ────────────────────────────────────────────────────────────
export default function OnboardingTour() {
  const router   = useRouter()
  const pathname = usePathname()

  const [idx,    setIdx]    = useState<number | null>(null)
  const [isMob,  setIsMob]  = useState(false)
  const [box,    setBox]    = useState<Box | null>(null)
  const [tipPos, setTipPos] = useState<React.CSSProperties>({})

  // ── Initialise from localStorage ──────────────────────────────────────────
  useEffect(() => {
    setIsMob(window.innerWidth <= 768)

    const stored = readStore()
    if (stored === 'done') return

    if (stored === null) {
      // First visit: show welcome after short delay
      const t = setTimeout(() => { writeStore(0); setIdx(0) }, 900)
      return () => clearTimeout(t)
    }

    const { step } = stored
    const def = STEPS[step]
    if (!def) { markDone(); return }
    // Resume if the stored step belongs to the current page (or has no page requirement)
    if (def.page === null || def.page === pathname) {
      setIdx(step)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // ── Spotlight tracking ────────────────────────────────────────────────────
  useEffect(() => {
    if (idx === null) return
    const step = STEPS[idx]
    if (!step.target || isMob) { setBox(null); setTipPos({}); return }

    const el = document.querySelector(`[data-tour="${step.target}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

    const update = () => {
      const b = measureBox(step.target!)
      setBox(b)
      setTipPos(b && step.placement ? calcTipPos(b, step.placement) : {})
    }

    const t = setTimeout(update, 260)
    window.addEventListener('resize', update)
    return () => { clearTimeout(t); window.removeEventListener('resize', update) }
  }, [idx, isMob])

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    if (idx === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')      done()
      else if (e.key === 'ArrowRight') handleNext()
      else if (e.key === 'ArrowLeft')  handlePrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  const done = () => { markDone(); setIdx(null) }

  const handleNext = () => {
    if (idx === null) return
    const nextIdx = idx + 1
    if (nextIdx >= STEPS.length) { done(); return }
    const next = STEPS[nextIdx]
    writeStore(nextIdx)
    if (next.page !== null && next.page !== pathname) {
      setIdx(null)             // hide while navigating
      router.push(next.page)
    } else {
      setIdx(nextIdx)
    }
  }

  const handlePrev = () => {
    if (idx === null || idx === 0) return
    const prevIdx = idx - 1
    const prev = STEPS[prevIdx]
    writeStore(prevIdx)
    if (prev.page !== null && prev.page !== pathname) {
      setIdx(null)
      router.push(prev.page)
    } else {
      setIdx(prevIdx)
    }
  }

  if (idx === null) return null

  const step    = STEPS[idx]
  const isFirst = idx === 0
  const isLast  = idx === STEPS.length - 1
  const total   = STEPS.length

  // ── CENTER MODAL: target-less steps (welcome, page intros, done) ──────────
  if (step.target === null) {
    return (
      <>
        <style>{KEYFRAMES}</style>
        <div
          onClick={e => { if (e.target === e.currentTarget) done() }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9990,
            background: OVERLAY, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', animation: 'ot-bg .28s ease',
          }}
        >
          <div
            key={idx}
            onClick={e => e.stopPropagation()}
            style={{
              background: C.surface, borderRadius: 20, overflow: 'hidden',
              width: '100%', maxWidth: 464,
              boxShadow: '0 32px 80px rgba(0,0,0,0.32)',
              fontFamily: FONT,
              animation: 'ot-modal .32s cubic-bezier(.34,1.56,.64,1)',
            }}
          >
            {/* Accent bar */}
            <div style={{ height: 4, background: `linear-gradient(90deg, ${step.accent}, ${step.accent}99)` }} />

            <div style={{ padding: '28px 28px 24px' }}>
              {/* Icon */}
              <div style={{
                width: 58, height: 58, borderRadius: 16,
                background: `linear-gradient(135deg, ${step.accent}, ${step.accent}CC)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20,
                boxShadow: `0 8px 24px ${step.accent}33`,
                animation: isLast ? 'ot-pop .5s cubic-bezier(.34,1.56,.64,1)' : undefined,
              }}>
                <ModuleIcon step={step} size={27} />
              </div>

              <h2 style={{ fontSize: 21, fontWeight: 800, color: C.ink, margin: '0 0 10px', letterSpacing: '-0.025em', fontFamily: FONT }}>
                {step.title}
              </h2>
              <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.65, margin: 0, fontFamily: FONT }}>
                {step.body}
              </p>
              {step.bullets && <BulletList items={step.bullets} accent={step.accent} />}

              <div style={{ margin: '22px 0 20px' }}>
                <Dots count={total} current={idx} size="lg" />
              </div>

              {/* Actions */}
              {isLast ? (
                <button
                  onClick={done}
                  style={{
                    width: '100%', padding: '14px', background: step.accent,
                    color: '#fff', border: 'none', borderRadius: 12,
                    fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                    boxShadow: `0 4px 16px ${step.accent}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l4 4 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Commencer
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onClick={handleNext}
                    style={{
                      width: '100%', padding: '13px 24px', background: step.accent,
                      color: '#fff', border: 'none', borderRadius: 12,
                      fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                      boxShadow: `0 4px 16px ${step.accent}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    {isFirst ? 'Démarrer le guide' : 'Continuer'}
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 7h8M7 3.5l4 3.5-4 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {!isFirst && idx > 0 && (
                    <button
                      onClick={handlePrev}
                      style={{
                        width: '100%', padding: '11px', background: C.bg,
                        color: C.slate, border: `1px solid ${C.border}`, borderRadius: 10,
                        fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: FONT,
                      }}
                    >
                      Précédent
                    </button>
                  )}
                  <div style={{ textAlign: 'center' }}>
                    <button
                      onClick={done}
                      style={{
                        background: 'none', border: 'none', fontSize: 12.5, color: C.muted,
                        cursor: 'pointer', fontFamily: FONT, padding: '6px 0',
                      }}
                    >
                      Passer le guide
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── MOBILE BOTTOM SHEET: for all spotlight steps on mobile ────────────────
  if (isMob) {
    return (
      <>
        <style>{KEYFRAMES}</style>
        {/* Dimmed backdrop */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
        }} />
        {/* Bottom sheet */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9993,
          background: C.surface, borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.22)',
          fontFamily: FONT,
          animation: 'ot-sheet .3s cubic-bezier(.34,1.16,.64,1)',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        }}>
          {/* Drag handle */}
          <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border }} />
          </div>

          {/* Progress bar */}
          <div style={{ height: 3, background: C.border, margin: '10px 20px 0', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${(idx + 1) / total * 100}%`,
              background: `linear-gradient(90deg, ${step.accent}, ${step.accent}BB)`,
              transition: 'width .3s ease',
            }} />
          </div>

          <div style={{ padding: '14px 20px 24px' }}>
            {/* Step label + close */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: step.accent, letterSpacing: '0.09em', textTransform: 'uppercase' }}>
                Étape {idx + 1} sur {total}
              </span>
              <CloseBtn onClick={done} />
            </div>

            <h3 style={{ fontSize: 19, fontWeight: 800, color: C.ink, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              {step.title}
            </h3>
            <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.62, margin: 0 }}>
              {step.body}
            </p>
            {step.bullets && <BulletList items={step.bullets} accent={step.accent} />}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
              <button
                onClick={handleNext}
                style={{
                  padding: '15px 24px', background: step.accent, color: '#fff',
                  border: 'none', borderRadius: 13,
                  fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: `0 4px 16px ${step.accent}40`,
                  minHeight: 52,
                }}
              >
                {isLast ? "C'est parti !" : 'Suivant'}
                {!isLast && (
                  <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7h8M7 3.5l4 3.5-4 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                {idx > 0 && (
                  <button
                    onClick={handlePrev}
                    style={{
                      flex: 1, padding: '13px', minHeight: 48,
                      background: C.bg, color: C.slate,
                      border: `1px solid ${C.border}`, borderRadius: 11,
                      fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: FONT,
                    }}
                  >
                    Précédent
                  </button>
                )}
                <button
                  onClick={done}
                  style={{
                    flex: 1, padding: '13px', minHeight: 48,
                    background: 'transparent', color: C.muted,
                    border: `1px solid ${C.border}`, borderRadius: 11,
                    fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  Passer
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── DESKTOP SPOTLIGHT + TOOLTIP ───────────────────────────────────────────
  // If the target element isn't measurable, render a center modal fallback
  if (!box) {
    return (
      <>
        <style>{KEYFRAMES}</style>
        <div
          onClick={e => { if (e.target === e.currentTarget) done() }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9990,
            background: OVERLAY, backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
            animation: 'ot-bg .28s ease',
          }}
        >
          <div
            key={idx}
            onClick={e => e.stopPropagation()}
            style={{
              background: C.surface, borderRadius: 16, overflow: 'hidden',
              width: '100%', maxWidth: 380,
              boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
              fontFamily: FONT, animation: 'ot-modal .28s ease',
            }}
          >
            <div style={{ height: 3, background: `linear-gradient(90deg, ${step.accent}, ${step.accent}88)` }} />
            <div style={{ padding: '20px 20px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: step.accent, letterSpacing: '0.09em', textTransform: 'uppercase' }}>
                  {idx + 1} / {total}
                </span>
                <CloseBtn onClick={done} />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: '0 0 7px', letterSpacing: '-0.01em', fontFamily: FONT }}>
                {step.title}
              </h3>
              <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: '0 0 14px', fontFamily: FONT }}>
                {step.body}
              </p>
              <Dots count={total} current={idx} />
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                {idx > 0 && (
                  <button onClick={handlePrev} style={{ padding: '9px 16px', background: C.bg, color: C.slate, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: FONT }}>
                    Précédent
                  </button>
                )}
                <button
                  onClick={handleNext}
                  style={{
                    flex: 1, padding: '9px 0', background: step.accent, color: '#fff',
                    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', fontFamily: FONT,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {isLast ? 'Terminer' : 'Suivant'}
                  {!isLast && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{KEYFRAMES}</style>

      {/* Click-blocker: prevents app interaction during tour */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9990, cursor: 'default' }} />

      {/* Spotlight ring */}
      <div style={{
        position: 'fixed',
        top: box.top, left: box.left, width: box.width, height: box.height,
        borderRadius: 12,
        boxShadow: `0 0 0 9999px ${OVERLAY}, 0 0 0 2.5px ${step.accent}, 0 0 24px ${step.accent}44`,
        zIndex: 9991, pointerEvents: 'none',
        transition: 'top .32s cubic-bezier(.4,0,.2,1), left .32s cubic-bezier(.4,0,.2,1), width .32s, height .32s',
      }} />

      {/* Tooltip panel */}
      <div
        key={`tip-${idx}`}
        style={{
          position: 'fixed', ...tipPos, width: TW,
          zIndex: 9993, background: C.surface, borderRadius: 14,
          boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
          border: `1px solid ${C.border}`,
          fontFamily: FONT, animation: 'ot-tip .2s ease',
          overflow: 'visible',
        }}
      >
        {step.placement && <Arrow placement={step.placement} />}

        {/* Progress bar */}
        <div style={{ height: 3, borderRadius: '13px 13px 0 0', background: C.border, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${(idx + 1) / total * 100}%`,
            background: `linear-gradient(90deg, ${step.accent}, ${step.accent}BB)`,
            transition: 'width .3s ease',
          }} />
        </div>

        <div style={{ padding: '14px 16px 16px' }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: step.accent, letterSpacing: '0.09em', textTransform: 'uppercase' }}>
              Étape {idx + 1} / {total}
            </span>
            <CloseBtn onClick={done} />
          </div>

          <h3 style={{ fontSize: 14.5, fontWeight: 700, color: C.ink, margin: '0 0 7px', letterSpacing: '-0.01em' }}>
            {step.title}
          </h3>
          <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: '0 0 14px' }}>
            {step.body}
          </p>

          <Dots count={total} current={idx} />

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {idx > 0 && (
              <button
                onClick={handlePrev}
                style={{
                  padding: '9px 14px', background: C.bg, color: C.slate,
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: FONT,
                }}
              >
                Précédent
              </button>
            )}
            <button
              onClick={handleNext}
              style={{
                flex: 1, padding: '9px 0', background: step.accent, color: '#fff',
                border: 'none', borderRadius: 8,
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: `0 3px 10px ${step.accent}40`,
              }}
            >
              {isLast ? 'Terminer' : 'Suivant'}
              {!isLast && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

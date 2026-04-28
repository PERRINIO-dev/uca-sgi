'use client'

import React, { useState, useCallback, useMemo, useTransition } from 'react'
import { useRouter }         from 'next/navigation'
import { createClient }      from '@/lib/supabase/client'
import PageLayout            from '@/components/PageLayout'
import type { BadgeCounts }  from '@/lib/supabase/badge-counts'
import { fmtCurrency }       from '@/lib/format'
import { C, F, R, SP, SH, TR, Z } from '@/lib/design-system'
import {
  getCaisseData,
  getCaisseHistory,
  addCashEntry,
  closeCaisse,
  type CaisseDay,
  type CashClosing,
  type CashEntryType,
} from './actions'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDateShort(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, color, bg, bd,
}: {
  label: string; value: string; sub?: string
  color: string; bg: string; bd: string
}) {
  return (
    <div style={{
      background: bg, border: `1.5px solid ${bd}`, borderRadius: R.lg,
      padding: `${SP[4]} ${SP[5]}`, minWidth: 140, flex: 1,
    }}>
      <div style={{ fontSize: F.xs, color, fontWeight: F.semibold, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: SP[1] }}>
        {label}
      </div>
      <div style={{ fontSize: F.xl, fontWeight: F.bold, color, fontFamily: F.mono, lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: F.xs, color, opacity: 0.7, marginTop: SP[1] }}>{sub}</div>
      )}
    </div>
  )
}

function StatusBadge({ closed, closedAt }: { closed: boolean; closedAt?: string }) {
  if (closed) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: SP[1],
        background: C.greenBg, color: C.green, border: `1px solid ${C.greenBd}`,
        borderRadius: R.full, padding: `2px ${SP[2]}`, fontSize: F.xs, fontWeight: F.semibold,
      }}>
        <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3.5" fill={C.green}/></svg>
        Clôturée {closedAt ? `à ${closedAt}` : ''}
      </span>
    )
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: SP[1],
      background: C.goldBg, color: C.gold, border: `1px solid ${C.goldBd}`,
      borderRadius: R.full, padding: `2px ${SP[2]}`, fontSize: F.xs, fontWeight: F.semibold,
    }}>
      <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3.5" fill={C.gold}/></svg>
      Ouverte
    </span>
  )
}

function DiffBadge({ diff }: { diff: number }) {
  if (diff === 0) {
    return (
      <span style={{ color: C.green, fontFamily: F.mono, fontSize: F.sm, fontWeight: F.semibold }}>
        Juste
      </span>
    )
  }
  const positive = diff > 0
  return (
    <span style={{
      color: positive ? C.blue : C.red,
      fontFamily: F.mono, fontSize: F.sm, fontWeight: F.semibold,
    }}>
      {positive ? '+' : ''}{new Intl.NumberFormat('fr-FR').format(diff)}
    </span>
  )
}

const ENTRY_META: Record<CashEntryType, { label: string; bg: string; color: string; bd: string; sign: '+' | '-' }> = {
  opening:    { label: 'Fonds de caisse', bg: C.blueBg,   color: C.blue,   bd: C.blueBd,   sign: '+' },
  expense:    { label: 'Dépense',         bg: C.redBg,    color: C.red,    bd: C.redBd,    sign: '-' },
  withdrawal: { label: 'Retrait',         bg: C.orangeBg, color: C.orange, bd: C.orangeBd, sign: '-' },
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CaisseClient({
  profile,
  currency,
  companyName,
  badgeCounts,
  boutiques,
  initialBoutiqueId,
  initialDate,
  initialData,
}: {
  profile:           any
  currency:          string
  companyName:       string
  badgeCounts?:      BadgeCounts
  boutiques:         { id: string; name: string }[]
  initialBoutiqueId: string
  initialDate:       string
  initialData:       CaisseDay | null
}) {
  const router   = useRouter()
  const supabase = createClient()
  const fmt      = (n: number) => fmtCurrency(n, currency)

  const isOwnerOrAdmin = ['owner', 'admin'].includes(profile.role)
  const today          = new Date().toISOString().slice(0, 10)

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeBoutiqueId, setActiveBoutiqueId] = useState(initialBoutiqueId)
  const [activeDate,       setActiveDate]       = useState(initialDate)
  const [data,             setData]             = useState<CaisseDay | null>(initialData)
  const [loading,          setLoading]          = useState(false)
  const [tab,              setTab]              = useState<'today' | 'history'>('today')

  // Add entry modal
  const [showAdd,      setShowAdd]     = useState(false)
  const [addType,      setAddType]     = useState<CashEntryType>('expense')
  const [addAmount,    setAddAmount]   = useState('')
  const [addDesc,      setAddDesc]     = useState('')
  const [addLoading,   setAddLoading]  = useState(false)
  const [addError,     setAddError]    = useState<string | null>(null)

  // Clôture modal
  const [showClose,     setShowClose]    = useState(false)
  const [declaredAmt,   setDeclaredAmt]  = useState('')
  const [closeNotes,    setCloseNotes]   = useState('')
  const [closeLoading,  setCloseLoading] = useState(false)
  const [closeError,    setCloseError]   = useState<string | null>(null)

  // History
  const [history,      setHistory]     = useState<CashClosing[]>([])
  const [histLoading,  setHistLoading] = useState(false)
  const [histLoaded,   setHistLoaded]  = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Data fetching ──────────────────────────────────────────────────────────

  const loadData = useCallback(async (boutiqueId: string, date: string) => {
    if (!boutiqueId) return
    setLoading(true)
    const { data: d } = await getCaisseData(boutiqueId, date)
    setData(d)
    setLoading(false)
  }, [])

  const handleBoutiqueChange = (id: string) => {
    setActiveBoutiqueId(id)
    setData(null)
    loadData(id, activeDate)
  }

  const handleDateChange = (date: string) => {
    setActiveDate(date)
    setData(null)
    loadData(activeBoutiqueId, date)
  }

  const loadHistory = async () => {
    if (histLoaded || !activeBoutiqueId) return
    setHistLoading(true)
    const { data: h } = await getCaisseHistory(activeBoutiqueId)
    setHistory(h)
    setHistLoaded(true)
    setHistLoading(false)
  }

  const handleTabChange = (t: 'today' | 'history') => {
    setTab(t)
    if (t === 'history' && !histLoaded) loadHistory()
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const especes   = useMemo(() => data?.payments.reduce((s, p) => s + p.amount, 0) ?? 0, [data])
  const openings  = useMemo(() => data?.entries.filter(e => e.entry_type === 'opening').reduce((s, e) => s + e.amount, 0) ?? 0, [data])
  const outflows  = useMemo(() => data?.entries.filter(e => e.entry_type !== 'opening').reduce((s, e) => s + e.amount, 0) ?? 0, [data])
  const expected  = useMemo(() => especes + openings - outflows, [especes, openings, outflows])
  const isClosed  = !!data?.closing

  // ── Add entry handler ──────────────────────────────────────────────────────

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError(null)
    const amount = parseFloat(addAmount.replace(/\s/g, '').replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) {
      setAddError('Montant invalide.')
      return
    }
    setAddLoading(true)
    const { error } = await addCashEntry({
      boutique_id: activeBoutiqueId,
      entry_date:  activeDate,
      entry_type:  addType,
      amount,
      description: addDesc,
    })
    setAddLoading(false)
    if (error) { setAddError(error); return }
    setShowAdd(false)
    setAddAmount(''); setAddDesc('')
    await loadData(activeBoutiqueId, activeDate)
  }

  // ── Clôture handler ────────────────────────────────────────────────────────

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault()
    setCloseError(null)
    const declared = parseFloat(declaredAmt.replace(/\s/g, '').replace(',', '.'))
    if (!Number.isFinite(declared) || declared < 0) {
      setCloseError('Montant déclaré invalide.')
      return
    }
    setCloseLoading(true)
    const { error } = await closeCaisse({
      boutique_id:     activeBoutiqueId,
      closing_date:    activeDate,
      expected_amount: expected,
      declared_amount: declared,
      notes:           closeNotes.trim() || null,
    })
    setCloseLoading(false)
    if (error) { setCloseError(error); return }
    setShowClose(false)
    setDeclaredAmt(''); setCloseNotes('')
    await loadData(activeBoutiqueId, activeDate)
    // Invalidate history so it reloads on next visit
    setHistLoaded(false)
    setHistory([])
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    background:   C.surface,
    border:       `1.5px solid ${C.border}`,
    borderRadius: R.xl,
    padding:      SP[6],
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: `${SP[2]} ${SP[3]}`, borderRadius: R.md,
    border: `1.5px solid ${C.border}`, fontSize: F.sm,
    color: C.text, background: C.bg, fontFamily: F.body,
    outline: 'none',
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: `${SP[2]} ${SP[4]}`, borderRadius: R.md,
    background:  active ? C.amberGlow : 'transparent',
    color:       active ? C.amber : C.muted,
    fontWeight:  active ? F.semibold : 400,
    fontSize:    F.sm, border: 'none', cursor: 'pointer',
    transition:  TR.fast,
    fontFamily:  F.body,
  })

  const btnPrimary: React.CSSProperties = {
    background: C.amber, color: '#fff',
    border: 'none', borderRadius: R.md,
    padding: `${SP[2]} ${SP[4]}`, fontSize: F.sm,
    fontWeight: F.semibold, cursor: 'pointer',
    fontFamily: F.body,
  }

  const btnSecondary: React.CSSProperties = {
    background: 'transparent', color: C.muted,
    border: `1.5px solid ${C.border}`, borderRadius: R.md,
    padding: `${SP[2]} ${SP[4]}`, fontSize: F.sm,
    fontWeight: 400, cursor: 'pointer',
    fontFamily: F.body,
  }

  const activeBoutique = boutiques.find(b => b.id === activeBoutiqueId)
  const isToday        = activeDate === today

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageLayout
      profile={profile}
      activeRoute="/caisse"
      onLogout={handleLogout}
      badgeCounts={badgeCounts}
    >
      <div
        className="fade-in-up"
        style={{ padding: `${SP[8]} ${SP[6]}`, maxWidth: 900, margin: '0 auto' }}
      >
        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: SP[3], marginBottom: SP[6] }}>
          <div>
            <h1 style={{ fontSize: F['2xl'], fontWeight: F.bold, fontFamily: F.display, color: C.ink, margin: 0 }}>
              Caisse journalière
            </h1>
            <div style={{ fontSize: F.sm, color: C.muted, marginTop: SP[1] }}>
              {companyName} — suivi des encaissements espèces
            </div>
          </div>
          {!isClosed && data && tab === 'today' && (
            <button
              onClick={() => { setDeclaredAmt(String(expected)); setCloseNotes(''); setCloseError(null); setShowClose(true) }}
              style={{
                ...btnPrimary,
                display: 'flex', alignItems: 'center', gap: SP[2],
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5v7M8 1.5l-2.5 3M8 1.5l2.5 3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2.5 9.5v4a1 1 0 001 1h9a1 1 0 001-1v-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Clôturer la caisse
            </button>
          )}
        </div>

        {/* ── Controls bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: SP[3], flexWrap: 'wrap', marginBottom: SP[6] }}>
          {isOwnerOrAdmin && boutiques.length > 0 && (
            <select
              value={activeBoutiqueId}
              onChange={e => handleBoutiqueChange(e.target.value)}
              style={{ ...inputStyle, width: 'auto', minWidth: 160 }}
            >
              {boutiques.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          {!isOwnerOrAdmin && activeBoutique && (
            <div style={{ fontSize: F.sm, fontWeight: F.semibold, color: C.ink }}>
              {activeBoutique.name}
            </div>
          )}
          <input
            type="date"
            value={activeDate}
            max={today}
            onChange={e => handleDateChange(e.target.value)}
            style={{ ...inputStyle, width: 'auto' }}
          />
          {!isToday && (
            <button
              onClick={() => handleDateChange(today)}
              style={{ ...btnSecondary, padding: `${SP[2]} ${SP[3]}`, fontSize: F.xs }}
            >
              Aujourd&apos;hui
            </button>
          )}

          {/* Tabs */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: SP[1], background: C.surfaceSub, borderRadius: R.lg, padding: SP[1] }}>
            <button onClick={() => handleTabChange('today')}   style={tabStyle(tab === 'today')}>Caisse</button>
            <button onClick={() => handleTabChange('history')} style={tabStyle(tab === 'history')}>Historique</button>
          </div>
        </div>

        {/* ── No boutique state ── */}
        {!activeBoutiqueId && (
          <div style={{ ...cardStyle, textAlign: 'center', color: C.muted, padding: SP[10] }}>
            Aucune boutique disponible.
          </div>
        )}

        {/* ══════════════════════════════════════════ TODAY TAB ════════════════ */}
        {tab === 'today' && activeBoutiqueId && (
          <>
            {loading && (
              <div style={{ textAlign: 'center', color: C.muted, padding: SP[10] }}>
                Chargement…
              </div>
            )}

            {!loading && data && (
              <>
                {/* ── Summary cards ── */}
                <div style={{ display: 'flex', gap: SP[3], flexWrap: 'wrap', marginBottom: SP[5] }}>
                  <SummaryCard
                    label="Espèces reçues"
                    value={fmt(especes)}
                    sub={`${data.payments.length} vente${data.payments.length > 1 ? 's' : ''}`}
                    color={C.green} bg={C.greenBg} bd={C.greenBd}
                  />
                  {openings > 0 && (
                    <SummaryCard
                      label="Fonds de caisse"
                      value={fmt(openings)}
                      color={C.blue} bg={C.blueBg} bd={C.blueBd}
                    />
                  )}
                  {outflows > 0 && (
                    <SummaryCard
                      label="Sorties"
                      value={`− ${fmt(outflows)}`}
                      color={C.red} bg={C.redBg} bd={C.redBd}
                    />
                  )}
                  <SummaryCard
                    label="Solde théorique"
                    value={fmt(expected)}
                    color={C.amber} bg={C.amberGlow} bd="rgba(160,83,26,0.18)"
                  />
                </div>

                {/* ── Status row ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: SP[3], marginBottom: SP[5] }}>
                  <StatusBadge
                    closed={isClosed}
                    closedAt={isClosed ? fmtTime(data.closing!.closed_at) : undefined}
                  />
                  {isClosed && (
                    <span style={{ fontSize: F.sm, color: C.muted }}>
                      par {data.closing!.users?.full_name ?? '—'} · déclaré {fmt(data.closing!.declared_amount)}
                      {' '}· écart : <DiffBadge diff={data.closing!.difference} />
                    </span>
                  )}
                  {isClosed && data.closing!.notes && (
                    <span style={{ fontSize: F.sm, color: C.muted, fontStyle: 'italic' }}>
                      « {data.closing!.notes} »
                    </span>
                  )}
                </div>

                {/* ── Movement list ── */}
                <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', marginBottom: SP[5] }}>
                  <div style={{ padding: `${SP[4]} ${SP[5]}`, borderBottom: `1px solid ${C.borderSub}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: F.sm, fontWeight: F.semibold, color: C.ink }}>
                      Mouvements du {fmtDate(activeDate + 'T12:00:00')}
                    </div>
                    {!isClosed && (
                      <button
                        onClick={() => { setAddType('expense'); setAddAmount(''); setAddDesc(''); setAddError(null); setShowAdd(true) }}
                        style={{ ...btnSecondary, fontSize: F.xs, display: 'flex', alignItems: 'center', gap: SP[1] }}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M6 1v10M1 6h10" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                        Nouveau mouvement
                      </button>
                    )}
                  </div>

                  {/* Payments list */}
                  {data.payments.length === 0 && data.entries.length === 0 ? (
                    <div style={{ padding: SP[8], textAlign: 'center', color: C.dim, fontSize: F.sm }}>
                      Aucun mouvement enregistré pour cette journée.
                    </div>
                  ) : (
                    <div>
                      {data.payments.map(p => (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: SP[3],
                            padding: `${SP[3]} ${SP[5]}`,
                            borderBottom: `1px solid ${C.borderSub}`,
                          }}
                        >
                          <div style={{ width: 32, height: 32, borderRadius: R.full, background: C.greenBg, border: `1px solid ${C.greenBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                              <path d="M2 8h12M8 2v12" stroke={C.green} strokeWidth="1.8" strokeLinecap="round"/>
                            </svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: F.sm, fontWeight: F.medium, color: C.ink }}>
                              Espèces — {p.sales?.sale_number ?? '—'}
                              {p.sales?.customer_name ? ` · ${p.sales.customer_name}` : ''}
                            </div>
                            {p.notes && (
                              <div style={{ fontSize: F.xs, color: C.muted }}>{p.notes}</div>
                            )}
                          </div>
                          <div style={{ fontSize: F.sm, color: C.muted, flexShrink: 0 }}>
                            {fmtTime(p.created_at)}
                          </div>
                          <div style={{ fontFamily: F.mono, fontSize: F.sm, fontWeight: F.semibold, color: C.green, flexShrink: 0 }}>
                            +{new Intl.NumberFormat('fr-FR').format(p.amount)}
                          </div>
                        </div>
                      ))}

                      {data.entries.map(e => {
                        const meta = ENTRY_META[e.entry_type]
                        return (
                          <div
                            key={e.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: SP[3],
                              padding: `${SP[3]} ${SP[5]}`,
                              borderBottom: `1px solid ${C.borderSub}`,
                            }}
                          >
                            <div style={{ width: 32, height: 32, borderRadius: R.full, background: meta.bg, border: `1px solid ${meta.bd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                {e.entry_type === 'opening' ? (
                                  <path d="M2 8h12M8 2v12" stroke={meta.color} strokeWidth="1.8" strokeLinecap="round"/>
                                ) : (
                                  <path d="M2 8h12" stroke={meta.color} strokeWidth="1.8" strokeLinecap="round"/>
                                )}
                              </svg>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: F.sm, fontWeight: F.medium, color: C.ink }}>
                                {meta.label} — {e.description}
                              </div>
                              <div style={{ fontSize: F.xs, color: C.muted }}>
                                {e.users?.full_name ?? '—'}
                              </div>
                            </div>
                            <div style={{ fontSize: F.sm, color: C.muted, flexShrink: 0 }}>
                              {fmtTime(e.created_at)}
                            </div>
                            <div style={{ fontFamily: F.mono, fontSize: F.sm, fontWeight: F.semibold, color: meta.color, flexShrink: 0 }}>
                              {meta.sign}{new Intl.NumberFormat('fr-FR').format(e.amount)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {!loading && !data && activeBoutiqueId && (
              <div style={{ ...cardStyle, textAlign: 'center', color: C.muted, padding: SP[10] }}>
                Erreur de chargement. Veuillez réessayer.
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════ HISTORY TAB ════════════════ */}
        {tab === 'history' && activeBoutiqueId && (
          <div style={cardStyle}>
            {histLoading && (
              <div style={{ textAlign: 'center', color: C.muted, padding: SP[8] }}>Chargement…</div>
            )}

            {!histLoading && history.length === 0 && histLoaded && (
              <div style={{ textAlign: 'center', color: C.dim, fontSize: F.sm, padding: SP[8] }}>
                Aucune clôture enregistrée pour cette boutique.
              </div>
            )}

            {!histLoading && history.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Date', 'Solde attendu', 'Déclaré', 'Écart', 'Clôturé par', 'Notes'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: F.xs, color: C.muted, fontWeight: F.semibold, padding: `${SP[2]} ${SP[3]}`, borderBottom: `1px solid ${C.border}`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((c, i) => (
                    <tr key={c.id} style={{ background: i % 2 === 0 ? 'transparent' : C.surfaceSub }}>
                      <td style={{ padding: `${SP[3]} ${SP[3]}`, fontSize: F.sm, fontWeight: F.medium, color: C.ink }}>
                        {fmtDateShort(c.closing_date)}
                      </td>
                      <td style={{ padding: `${SP[3]} ${SP[3]}`, fontFamily: F.mono, fontSize: F.sm, color: C.text }}>
                        {new Intl.NumberFormat('fr-FR').format(c.expected_amount)}
                      </td>
                      <td style={{ padding: `${SP[3]} ${SP[3]}`, fontFamily: F.mono, fontSize: F.sm, color: C.text }}>
                        {new Intl.NumberFormat('fr-FR').format(c.declared_amount)}
                      </td>
                      <td style={{ padding: `${SP[3]} ${SP[3]}` }}>
                        <DiffBadge diff={c.difference} />
                      </td>
                      <td style={{ padding: `${SP[3]} ${SP[3]}`, fontSize: F.sm, color: C.muted }}>
                        {c.users?.full_name ?? '—'}
                        <span style={{ marginLeft: SP[2], color: C.dim, fontSize: F.xs }}>
                          {fmtTime(c.closed_at)}
                        </span>
                      </td>
                      <td style={{ padding: `${SP[3]} ${SP[3]}`, fontSize: F.xs, color: C.muted, fontStyle: c.notes ? 'italic' : 'normal' }}>
                        {c.notes ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════ ADD ENTRY MODAL ═════════════════ */}
      {showAdd && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,6,0.50)', zIndex: Z.modal, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: SP[4] }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}
        >
          <div style={{ background: C.surface, borderRadius: R.xl, padding: SP[6], width: '100%', maxWidth: 440, boxShadow: SH.xl }}>
            <h2 style={{ margin: `0 0 ${SP[5]}`, fontSize: F.lg, fontWeight: F.bold, color: C.ink, fontFamily: F.display }}>
              Nouveau mouvement
            </h2>

            <form onSubmit={handleAddEntry}>
              {/* Type selector */}
              <div style={{ display: 'flex', gap: SP[2], marginBottom: SP[4] }}>
                {(['expense', 'withdrawal', 'opening'] as CashEntryType[]).map(t => {
                  const meta = ENTRY_META[t]
                  const active = addType === t
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAddType(t)}
                      style={{
                        flex: 1, padding: `${SP[2]} ${SP[3]}`,
                        borderRadius: R.md, fontSize: F.xs, fontWeight: F.semibold,
                        border: `1.5px solid ${active ? meta.bd : C.border}`,
                        background: active ? meta.bg : 'transparent',
                        color: active ? meta.color : C.muted,
                        cursor: 'pointer', fontFamily: F.body,
                        transition: TR.fast,
                      }}
                    >
                      {meta.label}
                    </button>
                  )
                })}
              </div>

              <div style={{ marginBottom: SP[3] }}>
                <label style={{ display: 'block', fontSize: F.xs, fontWeight: F.semibold, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: SP[1] }}>
                  Montant ({currency})
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={addAmount}
                  onChange={e => setAddAmount(e.target.value)}
                  autoFocus
                  style={{ ...inputStyle }}
                />
              </div>

              <div style={{ marginBottom: SP[4] }}>
                <label style={{ display: 'block', fontSize: F.xs, fontWeight: F.semibold, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: SP[1] }}>
                  Description
                </label>
                <input
                  type="text"
                  placeholder={addType === 'expense' ? 'ex. Fournitures de bureau' : addType === 'withdrawal' ? 'ex. Retrait patron' : 'Fonds de caisse initial'}
                  value={addDesc}
                  onChange={e => setAddDesc(e.target.value)}
                  style={{ ...inputStyle }}
                />
              </div>

              {addError && (
                <div style={{ marginBottom: SP[3], padding: `${SP[2]} ${SP[3]}`, background: C.redBg, color: C.red, border: `1px solid ${C.redBd}`, borderRadius: R.md, fontSize: F.sm }}>
                  {addError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SP[2] }}>
                <button type="button" onClick={() => setShowAdd(false)} style={btnSecondary}>
                  Annuler
                </button>
                <button type="submit" disabled={addLoading} style={{ ...btnPrimary, opacity: addLoading ? 0.6 : 1 }}>
                  {addLoading ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════ CLÔTURE MODAL ═══════════════════ */}
      {showClose && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,6,0.50)', zIndex: Z.modal, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: SP[4] }}
          onClick={e => { if (e.target === e.currentTarget) setShowClose(false) }}
        >
          <div style={{ background: C.surface, borderRadius: R.xl, padding: SP[6], width: '100%', maxWidth: 460, boxShadow: SH.xl }}>
            <h2 style={{ margin: `0 0 ${SP[2]}`, fontSize: F.lg, fontWeight: F.bold, color: C.ink, fontFamily: F.display }}>
              Clôturer la caisse
            </h2>
            <p style={{ margin: `0 0 ${SP[5]}`, fontSize: F.sm, color: C.muted }}>
              {fmtDate(activeDate + 'T12:00:00')} · {activeBoutique?.name}
            </p>

            {/* Expected vs declared comparison */}
            <div style={{ background: C.amberGlow, border: `1px solid rgba(160,83,26,0.18)`, borderRadius: R.lg, padding: SP[4], marginBottom: SP[5] }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: F.sm }}>
                <span style={{ color: C.muted }}>Solde théorique attendu</span>
                <span style={{ fontFamily: F.mono, fontWeight: F.bold, color: C.amber }}>
                  {new Intl.NumberFormat('fr-FR').format(expected)} {currency}
                </span>
              </div>
              {openings > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: F.xs, marginTop: SP[1] }}>
                  <span style={{ color: C.dim }}>dont fonds de caisse</span>
                  <span style={{ fontFamily: F.mono, color: C.dim }}>+{new Intl.NumberFormat('fr-FR').format(openings)}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleClose}>
              <div style={{ marginBottom: SP[3] }}>
                <label style={{ display: 'block', fontSize: F.xs, fontWeight: F.semibold, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: SP[1] }}>
                  Montant déclaré ({currency})
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={String(expected)}
                  value={declaredAmt}
                  onChange={e => setDeclaredAmt(e.target.value)}
                  autoFocus
                  style={{ ...inputStyle, fontSize: F.lg, fontWeight: F.bold, fontFamily: F.mono }}
                />
                {declaredAmt && (() => {
                  const d = parseFloat(declaredAmt.replace(/\s/g, '').replace(',', '.'))
                  if (!Number.isFinite(d)) return null
                  const diff = d - expected
                  if (diff === 0) return (
                    <div style={{ marginTop: SP[1], fontSize: F.xs, color: C.green }}>Caisse juste</div>
                  )
                  return (
                    <div style={{ marginTop: SP[1], fontSize: F.xs, color: diff > 0 ? C.blue : C.red }}>
                      Écart : {diff > 0 ? '+' : ''}{new Intl.NumberFormat('fr-FR').format(diff)} {currency}
                      {' '}({diff > 0 ? 'excédent' : 'manquant'})
                    </div>
                  )
                })()}
              </div>

              <div style={{ marginBottom: SP[4] }}>
                <label style={{ display: 'block', fontSize: F.xs, fontWeight: F.semibold, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: SP[1] }}>
                  Notes (optionnel)
                </label>
                <textarea
                  placeholder="Explication d'un écart, observations…"
                  value={closeNotes}
                  onChange={e => setCloseNotes(e.target.value)}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }}
                />
              </div>

              {closeError && (
                <div style={{ marginBottom: SP[3], padding: `${SP[2]} ${SP[3]}`, background: C.redBg, color: C.red, border: `1px solid ${C.redBd}`, borderRadius: R.md, fontSize: F.sm }}>
                  {closeError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SP[2] }}>
                <button type="button" onClick={() => setShowClose(false)} style={btnSecondary}>
                  Annuler
                </button>
                <button type="submit" disabled={closeLoading} style={{ ...btnPrimary, opacity: closeLoading ? 0.6 : 1 }}>
                  {closeLoading ? 'Clôture en cours…' : 'Confirmer la clôture'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageLayout>
  )
}

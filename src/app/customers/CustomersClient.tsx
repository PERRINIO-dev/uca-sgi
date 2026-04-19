'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter }        from 'next/navigation'
import { createClient }     from '@/lib/supabase/client'
import { useIsMobile }      from '@/hooks/useIsMobile'
import PageLayout           from '@/components/PageLayout'
import { createCustomer, updateCustomer, deleteCustomer } from './actions'
import { fmtCurrency }      from '@/lib/format'
import type { BadgeCounts } from '@/lib/supabase/badge-counts'
import { C, F, R, SP, SH, TR } from '@/lib/design-system'

const fmtNum  = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

function Initials({ name }: { name: string }) {
  const letters = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
  return <>{letters}</>
}

const PAYMENT_LABELS: Record<string, { label: string; color: string; bg: string; bd: string }> = {
  paid:    { label: 'Payé',     color: C.green,  bg: C.greenBg,  bd: C.greenBd  },
  partial: { label: 'Partiel', color: C.orange, bg: C.orangeBg, bd: C.orangeBd },
  unpaid:  { label: 'Impayé',  color: C.red,    bg: C.redBg,    bd: C.redBd    },
}

export default function CustomersClient({
  profile, currency, customers: initial, badgeCounts,
}: {
  profile:      any
  currency:     string
  customers:    any[]
  badgeCounts?: BadgeCounts
}) {
  const router       = useRouter()
  const isMobile     = useIsMobile()
  const supabase     = useMemo(() => createClient(), [])
  const fmt          = (n: number) => fmtCurrency(n, currency)
  const isAdminOwner = ['owner', 'admin'].includes(profile.role)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── List state ───────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState(initial)
  const [search,    setSearch]    = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return customers
    const q = search.toLowerCase()
    return customers.filter(c =>
      c.full_name.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q)    ||
      c.cni?.toLowerCase().includes(q)
    )
  }, [customers, search])

  const totalSpent       = customers.reduce((s, c) => s + Number(c.total_spent       ?? 0), 0)
  const totalOutstanding = customers.reduce((s, c) => s + Number(c.outstanding_balance ?? 0), 0)

  // ── Drawer state ─────────────────────────────────────────────────────────
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [drawerOpen,   setDrawerOpen]   = useState(false)
  const [editMode,     setEditMode]     = useState(false)
  const [editName,     setEditName]     = useState('')
  const [editPhone,    setEditPhone]    = useState('')
  const [editPhone2,   setEditPhone2]   = useState('')
  const [editCNI,      setEditCNI]      = useState('')
  const [editNotes,    setEditNotes]    = useState('')
  const [editLoading,  setEditLoading]  = useState(false)
  const [editError,    setEditError]    = useState<string | null>(null)
  const [history,         setHistory]         = useState<any[]>([])
  const [historyLoading,  setHistoryLoading]  = useState(false)

  const selected = customers.find(c => c.id === selectedId) ?? null

  const openDrawer = (c: any) => {
    setSelectedId(c.id)
    setEditMode(false)
    setEditName(c.full_name)
    setEditPhone(c.phone   ?? '')
    setEditPhone2(c.phone2 ?? '')
    setEditCNI(c.cni       ?? '')
    setEditNotes(c.notes   ?? '')
    setEditError(null)
    setHistory([])
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setEditMode(false)
    setTimeout(() => setSelectedId(null), 280)
  }

  // Lazy-load purchase history when drawer opens
  useEffect(() => {
    if (!selectedId || !drawerOpen) return
    setHistoryLoading(true)
    supabase
      .from('sales')
      .select('id, created_at, sale_number, total_amount, payment_status, status, boutiques(name)')
      .eq('customer_id', selectedId)
      .not('status', 'in', '(cancelled,draft)')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { setHistory(data ?? []); setHistoryLoading(false) })
  }, [selectedId, drawerOpen, supabase])

  const handleUpdate = async () => {
    if (!selectedId) return
    setEditLoading(true); setEditError(null)
    const res = await updateCustomer(selectedId, {
      full_name: editName,
      phone:  editPhone  || null,
      phone2: editPhone2 || null,
      cni:    editCNI    || null,
      notes:  editNotes  || null,
    })
    setEditLoading(false)
    if (res.error) { setEditError(res.error); return }
    setCustomers(prev => prev.map(c => c.id === selectedId
      ? { ...c, full_name: editName, phone: editPhone || null, phone2: editPhone2 || null, cni: editCNI || null, notes: editNotes || null }
      : c
    ))
    setEditMode(false)
    router.refresh()
  }

  // ── Delete state ─────────────────────────────────────────────────────────
  const [deleteId,      setDeleteId]      = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError,   setDeleteError]   = useState<string | null>(null)

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleteLoading(true); setDeleteError(null)
    const res = await deleteCustomer(deleteId)
    setDeleteLoading(false)
    if (res.error) { setDeleteError(res.error); return }
    if (selectedId === deleteId) closeDrawer()
    setCustomers(prev => prev.filter(c => c.id !== deleteId))
    setDeleteId(null)
    router.refresh()
  }

  // ── Add modal state ───────────────────────────────────────────────────────
  const [addOpen,    setAddOpen]    = useState(false)
  const [addName,    setAddName]    = useState('')
  const [addPhone,   setAddPhone]   = useState('')
  const [addPhone2,  setAddPhone2]  = useState('')
  const [addCNI,     setAddCNI]     = useState('')
  const [addNotes,   setAddNotes]   = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError,   setAddError]   = useState<string | null>(null)

  const openAdd = () => {
    setAddName(''); setAddPhone(''); setAddPhone2(''); setAddCNI(''); setAddNotes('')
    setAddError(null); setAddOpen(true)
  }

  const handleAdd = async () => {
    setAddLoading(true); setAddError(null)
    const res = await createCustomer({
      full_name: addName,
      phone:  addPhone  || null,
      phone2: addPhone2 || null,
      cni:    addCNI    || null,
      notes:  addNotes  || null,
    })
    setAddLoading(false)
    if (res.error) { setAddError(res.error); return }
    setAddOpen(false)
    router.refresh()
  }

  // ── Shared input style ────────────────────────────────────────────────────
  const inp = (invalid = false): React.CSSProperties => ({
    width: '100%', padding: '9px 11px', borderRadius: R.md,
    border: `1.5px solid ${invalid ? C.red : C.border}`,
    fontSize: F.sm, color: C.ink, outline: 'none',
    boxSizing: 'border-box', background: C.surfaceEl, fontFamily: F.body,
  })

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <PageLayout profile={profile} activeRoute="/customers" onLogout={handleLogout} badgeCounts={badgeCounts}>
      <div style={{ padding: isMobile ? '16px 16px 40px' : '32px 32px 48px', maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div className="fade-in-up" style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: F.xs, fontWeight: 700, color: C.amber, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px', fontFamily: F.body }}>
                Relation client
              </p>
              <h1 style={{ fontSize: isMobile ? 26 : 32, fontWeight: 900, color: C.ink, margin: 0, letterSpacing: '-0.03em', fontFamily: F.display }}>
                Clients
              </h1>
              <p style={{ fontSize: F.sm, color: C.muted, margin: '4px 0 0', fontFamily: F.body }}>
                {customers.length} client{customers.length !== 1 ? 's' : ''} enregistré{customers.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={openAdd} className="btn-amber"
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: R.full, border: 'none', cursor: 'pointer', fontSize: F.sm, fontWeight: 700, fontFamily: F.body }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Nouveau client
            </button>
          </div>

          {/* Summary strip — admin/owner only */}
          {isAdminOwner && customers.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, auto)', gap: 10, marginTop: 20 }}>
              {([
                { label: 'Clients',           value: fmtNum(customers.length), color: C.ink    },
                { label: 'Total dépensé',      value: fmt(totalSpent),          color: C.green  },
                { label: 'Solde en attente',   value: fmt(totalOutstanding),    color: totalOutstanding > 0 ? C.orange : C.muted },
              ] as { label: string; value: string; color: string }[]).map(({ label, value, color }) => (
                <div key={label} style={{ background: C.surface, borderRadius: R.lg, border: `1px solid ${C.border}`, padding: '12px 16px', boxShadow: SH.xs }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: F.body, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color, letterSpacing: '-0.03em', fontFamily: F.display }}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke={C.muted} strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, téléphone ou CNI…"
            style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: R.full, border: `1.5px solid ${C.border}`, fontSize: F.sm, color: C.ink, outline: 'none', boxSizing: 'border-box', background: C.surface, fontFamily: F.body }} />
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: C.surface, borderRadius: R.xl, border: `1px solid ${C.border}` }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.bgDeep, border: `1.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="10" cy="7" r="4" stroke={C.muted} strokeWidth="1.5"/>
                <path d="M4 21c0-4 2.5-6.5 6-6.5" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M17 14v6M14 17h6" stroke={C.amber} strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ fontSize: F.base, fontWeight: 700, color: C.ink, fontFamily: F.body, marginBottom: 6 }}>
              {search ? 'Aucun résultat' : 'Aucun client enregistré'}
            </div>
            <div style={{ fontSize: F.sm, color: C.muted, fontFamily: F.body, marginBottom: 20 }}>
              {search
                ? `Aucun client ne correspond à « ${search} »`
                : 'Ajoutez votre premier client pour commencer le suivi.'}
            </div>
            {!search && (
              <button onClick={openAdd} className="btn-amber"
                style={{ padding: '10px 22px', borderRadius: R.full, border: 'none', cursor: 'pointer', fontSize: F.sm, fontWeight: 700, fontFamily: F.body }}>
                Ajouter un client
              </button>
            )}
          </div>
        )}

        {/* Customer list */}
        {filtered.length > 0 && (
          isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(c => (
                <div key={c.id} onClick={() => openDrawer(c)}
                  style={{ background: C.surface, borderRadius: R.lg, border: `1px solid ${C.border}`, padding: '14px 16px', cursor: 'pointer', boxShadow: SH.xs, transition: `background ${TR.fast}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.surfaceHov)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.surface)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.amberGlow, border: `1.5px solid ${C.amber}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.amber, fontFamily: F.body }}><Initials name={c.full_name} /></span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: F.sm, fontWeight: 700, color: C.ink, fontFamily: F.body }}>{c.full_name}</div>
                      {c.phone && <div style={{ fontSize: F.xs, color: C.muted, fontFamily: F.body }}>{c.phone}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: F.sm, fontWeight: 800, color: C.ink, fontFamily: F.display }}>{fmt(Number(c.total_spent ?? 0))}</div>
                      {Number(c.outstanding_balance ?? 0) > 0 && (
                        <div style={{ fontSize: F.xs, color: C.orange, fontWeight: 600, fontFamily: F.body }}>
                          solde {fmt(Number(c.outstanding_balance))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: C.surface, borderRadius: R.xl, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: SH.sm }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                    {['Client', 'Total dépensé', 'Solde restant', 'Ventes', 'Dernière visite', ''].map((h, i) => (
                      <th key={i} style={{ padding: '11px 16px', textAlign: i === 0 ? 'left' : i === 5 ? 'center' : 'right', fontSize: F.xs, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: F.body, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, idx) => (
                    <tr key={c.id} onClick={() => openDrawer(c)}
                      style={{ borderBottom: idx < filtered.length - 1 ? `1px solid ${C.borderSub}` : 'none', cursor: 'pointer', transition: `background ${TR.fast}` }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.surfaceHov)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: C.amberGlow, border: `1.5px solid ${C.amber}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: C.amber, fontFamily: F.body }}><Initials name={c.full_name} /></span>
                          </div>
                          <div>
                            <div style={{ fontSize: F.sm, fontWeight: 700, color: C.ink, fontFamily: F.body }}>{c.full_name}</div>
                            {c.phone && <div style={{ fontSize: F.xs, color: C.muted, fontFamily: F.body }}>{c.phone}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <span style={{ fontSize: F.sm, fontWeight: 700, color: C.ink, fontFamily: F.display }}>{fmt(Number(c.total_spent ?? 0))}</span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        {Number(c.outstanding_balance ?? 0) > 0
                          ? <span style={{ fontSize: F.sm, fontWeight: 700, color: C.orange, fontFamily: F.display }}>{fmt(Number(c.outstanding_balance))}</span>
                          : <span style={{ fontSize: F.sm, color: C.dim, fontFamily: F.body }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <span style={{ fontSize: F.sm, color: C.muted, fontFamily: F.body }}>{fmtNum(Number(c.sale_count ?? 0))}</span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <span style={{ fontSize: F.sm, color: C.muted, fontFamily: F.body }}>{fmtDate(c.last_sale_at)}</span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                          <path d="M5 2l5 5-5 5" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* ── Detail Drawer ─────────────────────────────────────────────────── */}
      {drawerOpen && selected && (
        <>
          <div onClick={closeDrawer}
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(26,15,6,0.35)' }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
            width: isMobile ? '100%' : 420,
            background: C.surface, boxShadow: SH.xl,
            display: 'flex', flexDirection: 'column', overflowY: 'hidden',
          }}>
            {/* Drawer header */}
            <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.amberGlow, border: `2px solid ${C.amber}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: C.amber, fontFamily: F.body }}><Initials name={selected.full_name} /></span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.ink, fontFamily: F.body, lineHeight: 1.2 }}>{selected.full_name}</div>
                {selected.phone && <div style={{ fontSize: F.xs, color: C.muted, fontFamily: F.body, marginTop: 2 }}>{selected.phone}</div>}
              </div>
              <button onClick={closeDrawer}
                style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer', width: 32, height: 32, borderRadius: R.md, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="11" height="11" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Stats strip */}
            <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', flexShrink: 0 }}>
              {([
                { label: 'Total dépensé', value: fmt(Number(selected.total_spent ?? 0)),         color: C.green },
                { label: 'Solde restant', value: fmt(Number(selected.outstanding_balance ?? 0)), color: Number(selected.outstanding_balance ?? 0) > 0 ? C.orange : C.dim },
                { label: 'Ventes',        value: fmtNum(Number(selected.sale_count ?? 0)),       color: C.ink  },
              ] as { label: string; value: string; color: string }[]).map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: F.body }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: F.display, marginTop: 2 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

              {/* Contact info / edit form */}
              {editMode ? (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: F.xs, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: F.body, marginBottom: 12 }}>
                    Modifier le client
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: F.xs, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 4, fontFamily: F.body }}>Nom <span style={{ color: C.red }}>*</span></label>
                      <input value={editName} onChange={e => setEditName(e.target.value)} style={inp(!editName.trim())} placeholder="Nom complet" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: F.xs, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 4, fontFamily: F.body }}>Téléphone</label>
                        <input value={editPhone} onChange={e => setEditPhone(e.target.value)} style={inp()} placeholder="6 XX XX XX" type="tel" />
                      </div>
                      <div>
                        <label style={{ fontSize: F.xs, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 4, fontFamily: F.body }}>Tél. secondaire</label>
                        <input value={editPhone2} onChange={e => setEditPhone2(e.target.value)} style={inp()} placeholder="6 XX XX XX" type="tel" />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: F.xs, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 4, fontFamily: F.body }}>N° CNI</label>
                      <input value={editCNI} onChange={e => setEditCNI(e.target.value)} style={inp()} placeholder="Numéro CNI" />
                    </div>
                    <div>
                      <label style={{ fontSize: F.xs, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 4, fontFamily: F.body }}>Notes</label>
                      <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2}
                        style={{ ...inp(), resize: 'vertical' }} placeholder="Remarques internes…" />
                    </div>
                  </div>
                  {editError && (
                    <div style={{ marginTop: 10, padding: `${SP[2]} ${SP[3]}`, background: C.redBg, borderRadius: R.md, fontSize: F.sm, color: C.red, fontWeight: 600, border: `1px solid ${C.redBd}`, fontFamily: F.body }}>
                      {editError}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => { setEditMode(false); setEditError(null) }}
                      style={{ flex: 1, padding: '9px', borderRadius: R.md, border: `1.5px solid ${C.border}`, background: C.bg, color: C.muted, fontSize: F.sm, fontWeight: 600, cursor: 'pointer', fontFamily: F.body }}>
                      Annuler
                    </button>
                    <button onClick={handleUpdate} disabled={editLoading} className="btn-amber"
                      style={{ flex: 2, padding: '9px', borderRadius: R.md, border: 'none', fontSize: F.sm, fontWeight: 700, cursor: editLoading ? 'not-allowed' : 'pointer', fontFamily: F.body, opacity: editLoading ? 0.7 : 1 }}>
                      {editLoading ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontSize: F.xs, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: F.body }}>
                      Coordonnées
                    </div>
                    {isAdminOwner && (
                      <button onClick={() => setEditMode(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: R.full, background: C.bg, border: `1px solid ${C.border}`, color: C.muted, fontSize: F.xs, fontWeight: 600, cursor: 'pointer', fontFamily: F.body }}>
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M8 2l2 2-6 6H2V8l6-6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                        </svg>
                        Modifier
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {([
                      ['Téléphone',      selected.phone   ?? '—'],
                      ['Tél. secondaire', selected.phone2  ?? '—'],
                      ['CNI',            selected.cni     ?? '—'],
                      ['Client depuis',  fmtDate(selected.created_at)],
                    ] as [string, string][]).map(([label, value]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: F.xs, color: C.muted, fontFamily: F.body, flexShrink: 0 }}>{label}</span>
                        <span style={{ fontSize: F.sm, color: value === '—' ? C.dim : C.ink, fontFamily: F.body, textAlign: 'right' }}>{value}</span>
                      </div>
                    ))}
                    {selected.notes && (
                      <div style={{ marginTop: 4, padding: '8px 10px', background: C.bgDeep, borderRadius: R.md, fontSize: F.xs, color: C.text, fontFamily: F.body, fontStyle: 'italic', lineHeight: 1.5 }}>
                        {selected.notes}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Purchase history */}
              <div>
                <div style={{ fontSize: F.xs, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: F.body, marginBottom: 12 }}>
                  Historique des achats
                </div>
                {historyLoading ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', fontSize: F.sm, color: C.dim, fontFamily: F.body }}>Chargement…</div>
                ) : history.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', fontSize: F.sm, color: C.dim, fontFamily: F.body }}>
                    Aucune vente enregistrée.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {history.map(sale => {
                      const ps = PAYMENT_LABELS[sale.payment_status] ?? PAYMENT_LABELS.unpaid
                      return (
                        <div key={sale.id} style={{ background: C.bg, borderRadius: R.md, border: `1px solid ${C.border}`, padding: '10px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                            <div>
                              <span style={{ fontSize: F.sm, fontWeight: 700, color: C.ink, fontFamily: F.body }}>{sale.sale_number ?? '—'}</span>
                              {sale.boutiques?.name && (
                                <span style={{ fontSize: F.xs, color: C.muted, fontFamily: F.body, marginLeft: 6 }}>{sale.boutiques.name}</span>
                              )}
                            </div>
                            <span style={{ fontSize: F.xs, fontWeight: 700, color: ps.color, background: ps.bg, border: `1px solid ${ps.bd}`, borderRadius: R.full, padding: '2px 8px', fontFamily: F.body, flexShrink: 0 }}>
                              {ps.label}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontSize: F.xs, color: C.muted, fontFamily: F.body }}>{fmtDate(sale.created_at)}</span>
                            <span style={{ fontSize: F.sm, fontWeight: 800, color: C.ink, fontFamily: F.display }}>{fmt(Number(sale.total_amount))}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Delete zone — admin/owner, not in edit mode */}
            {isAdminOwner && !editMode && (
              <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
                <button
                  onClick={() => { setDeleteId(selected.id); setDeleteError(null) }}
                  style={{ width: '100%', padding: '9px', borderRadius: R.md, border: `1.5px solid ${C.redBd}`, background: C.redBg, color: C.red, fontSize: F.sm, fontWeight: 600, cursor: 'pointer', fontFamily: F.body }}>
                  Supprimer ce client
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Add Customer Modal ───────────────────────────────────────────── */}
      {addOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(26,15,6,0.50)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setAddOpen(false) } }}>
          <div style={{ background: C.surface, borderRadius: isMobile ? '20px 20px 0 0' : R.xl, padding: '24px', width: '100%', maxWidth: 480, boxShadow: SH.xl }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.ink, margin: 0, fontFamily: F.display }}>Nouveau client</h2>
              <button onClick={() => setAddOpen(false)}
                style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer', width: 30, height: 30, borderRadius: R.md, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: F.xs, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 4, fontFamily: F.body }}>Nom complet <span style={{ color: C.red }}>*</span></label>
                <input value={addName} onChange={e => setAddName(e.target.value)} style={inp(!addName.trim() && !!addError)} placeholder="ex : Michel Abanda" autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: F.xs, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 4, fontFamily: F.body }}>Téléphone</label>
                  <input value={addPhone} onChange={e => setAddPhone(e.target.value)} style={inp()} placeholder="6 XX XX XX XX" type="tel" />
                </div>
                <div>
                  <label style={{ fontSize: F.xs, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 4, fontFamily: F.body }}>Tél. secondaire</label>
                  <input value={addPhone2} onChange={e => setAddPhone2(e.target.value)} style={inp()} placeholder="6 XX XX XX XX" type="tel" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: F.xs, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 4, fontFamily: F.body }}>N° CNI</label>
                <input value={addCNI} onChange={e => setAddCNI(e.target.value)} style={inp()} placeholder="Numéro CNI" />
              </div>
              <div>
                <label style={{ fontSize: F.xs, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 4, fontFamily: F.body }}>Notes <span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>(optionnel)</span></label>
                <textarea value={addNotes} onChange={e => setAddNotes(e.target.value)} rows={2}
                  style={{ ...inp(), resize: 'vertical' }} placeholder="Remarques internes…" />
              </div>
            </div>
            {addError && (
              <div style={{ marginTop: 12, padding: `${SP[2]} ${SP[3]}`, background: C.redBg, borderRadius: R.md, fontSize: F.sm, color: C.red, fontWeight: 600, border: `1px solid ${C.redBd}`, fontFamily: F.body }}>
                {addError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => setAddOpen(false)}
                style={{ flex: 1, padding: '11px', borderRadius: R.md, border: `1.5px solid ${C.border}`, background: C.bg, color: C.muted, fontSize: F.sm, fontWeight: 600, cursor: 'pointer', fontFamily: F.body }}>
                Annuler
              </button>
              <button onClick={handleAdd} disabled={addLoading} className="btn-amber"
                style={{ flex: 2, padding: '11px', borderRadius: R.md, border: 'none', fontSize: F.sm, fontWeight: 700, cursor: addLoading ? 'not-allowed' : 'pointer', fontFamily: F.body, opacity: addLoading ? 0.7 : 1 }}>
                {addLoading ? 'Enregistrement…' : 'Créer le client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ────────────────────────────────────── */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(26,15,6,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: C.surface, borderRadius: R.xl, padding: '24px', width: '100%', maxWidth: 400, boxShadow: SH.xl }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.redBg, border: `1.5px solid ${C.redBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={C.red} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: C.ink, margin: '0 0 6px', fontFamily: F.display }}>Supprimer ce client ?</h3>
              <p style={{ fontSize: F.sm, color: C.muted, margin: 0, fontFamily: F.body }}>
                Cette action est irréversible. Le client sera définitivement supprimé.
              </p>
            </div>
            {deleteError && (
              <div style={{ marginBottom: 14, padding: `${SP[2]} ${SP[3]}`, background: C.redBg, borderRadius: R.md, fontSize: F.sm, color: C.red, fontWeight: 600, border: `1px solid ${C.redBd}`, fontFamily: F.body }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setDeleteId(null); setDeleteError(null) }}
                style={{ flex: 1, padding: '10px', borderRadius: R.md, border: `1.5px solid ${C.border}`, background: C.bg, color: C.muted, fontSize: F.sm, fontWeight: 600, cursor: 'pointer', fontFamily: F.body }}>
                Annuler
              </button>
              <button onClick={handleDelete} disabled={deleteLoading}
                style={{ flex: 2, padding: '10px', borderRadius: R.md, border: 'none', background: C.red, color: 'white', fontSize: F.sm, fontWeight: 700, cursor: deleteLoading ? 'not-allowed' : 'pointer', fontFamily: F.body, opacity: deleteLoading ? 0.7 : 1 }}>
                {deleteLoading ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}

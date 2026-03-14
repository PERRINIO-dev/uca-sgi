'use client'

import React, { useState, useMemo } from 'react'
import { useRouter }    from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageLayout       from '@/components/PageLayout'
import { cancelSale }   from './actions'

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtCFA = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
const fmtNum = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(n)
const fmtM2 = (n: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' m²'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', surface: '#FFFFFF',
  navy: '#1B3A6B', blue: '#2563EB', blueL: '#EFF6FF',
  green: '#059669', greenL: '#ECFDF5',
  orange: '#D97706', orangeL: '#FFFBEB',
  red: '#DC2626', redL: '#FEF2F2',
}
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif"

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  draft:     { label: 'Brouillon',      bg: C.bg,      color: C.muted,   dot: C.muted },
  confirmed: { label: 'Confirmée',      bg: C.blueL,   color: C.blue,    dot: C.blue },
  preparing: { label: 'En préparation', bg: C.orangeL, color: C.orange,  dot: C.orange },
  ready:     { label: 'Prête',          bg: C.greenL,  color: C.green,   dot: C.green },
  delivered: { label: 'Livrée',         bg: '#F0F0F0', color: C.muted,   dot: C.muted },
  cancelled: { label: 'Annulée',        bg: C.redL,    color: C.red,     dot: C.red },
}

const TH_STYLE: React.CSSProperties = {
  padding: '11px 14px', textAlign: 'left',
  fontSize: 11, fontWeight: 600, color: C.muted,
  textTransform: 'uppercase', letterSpacing: '0.07em',
  borderBottom: `1.5px solid ${C.border}`,
  whiteSpace: 'nowrap', fontFamily: FONT,
}
const TD_STYLE: React.CSSProperties = {
  padding: '13px 14px', fontSize: 13, color: C.ink,
  borderBottom: `1px solid ${C.border}`,
  verticalAlign: 'middle', fontFamily: FONT,
}

function IconChevronDown({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M2 4l4 4 4-4" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconChevronUp({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M2 8l4-4 4 4" stroke={C.blue} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconCart({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="20" fill={C.bg}/>
      <path d="M11 13h2.5l3.5 10h9l2-6H16" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="17" cy="26.5" r="1.5" fill={C.muted}/>
      <circle cx="24" cy="26.5" r="1.5" fill={C.muted}/>
    </svg>
  )
}
function IconSearch({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke={C.muted} strokeWidth="1.4"/>
      <path d="M10 10l2.5 2.5" stroke={C.muted} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
function IconFilter({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none">
      <path d="M1.5 3h10M3 6.5h7M5 10h3" stroke={C.slate} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
function IconX({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 11 11" fill="none">
      <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke={C.slate} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SalesListClient({
  profile,
  sales,
}: {
  profile: any
  sales:   any[]
}) {
  const router   = useRouter()
  const supabase = createClient()
  const [expanded,    setExpanded]   = useState<string | null>(null)
  const [cancelId,    setCancelId]   = useState<string | null>(null)
  const [cancelNum,   setCancelNum]  = useState('')
  const [cancelling,  setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  // ── Filters ──
  const [search,        setSearch]       = useState('')
  const [statusFilter,  setStatusFilter] = useState('')
  const [dateFrom,      setDateFrom]     = useState('')
  const [dateTo,        setDateTo]       = useState('')
  const [boutiqueFilter, setBoutiqueFilter] = useState('')

  // ── Pagination ──
  const PAGE_SIZE = 50
  const [page, setPage] = useState(1)

  // Unique boutiques from loaded data
  const boutiques = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of sales) {
      const name = s.boutiques?.name
      if (name) map.set(name, name)
    }
    return Array.from(map.keys()).sort()
  }, [sales])

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase()
    const from = dateFrom ? new Date(dateFrom) : null
    const to   = dateTo   ? new Date(dateTo + 'T23:59:59') : null
    return sales.filter(s => {
      if (q && !s.sale_number?.toLowerCase().includes(q) && !s.customer_name?.toLowerCase().includes(q)) return false
      if (statusFilter && s.status !== statusFilter) return false
      if (from && new Date(s.created_at) < from) return false
      if (to   && new Date(s.created_at) > to)   return false
      if (boutiqueFilter && s.boutiques?.name !== boutiqueFilter) return false
      return true
    })
  }, [sales, search, statusFilter, dateFrom, dateTo, boutiqueFilter])

  const hasFilters = search || statusFilter || dateFrom || dateTo || boutiqueFilter
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); setBoutiqueFilter(''); setPage(1) }

  // Reset to page 1 whenever any filter changes — derived implicitly since React
  // will re-render; we update page in each setter below via resetPage helper.
  const setSearchPaged       = (v: string)  => { setSearch(v);        setPage(1) }
  const setStatusFilterPaged = (v: string)  => { setStatusFilter(v);  setPage(1) }
  const setDateFromPaged     = (v: string)  => { setDateFrom(v);      setPage(1) }
  const setDateToPaged       = (v: string)  => { setDateTo(v);        setPage(1) }
  const setBoutiqueFilterPaged = (v: string) => { setBoutiqueFilter(v); setPage(1) }

  const totalPages  = Math.max(1, Math.ceil(filteredSales.length / PAGE_SIZE))
  const pagedSales  = filteredSales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleCancelConfirm = async () => {
    if (!cancelId) return
    setCancelling(true)
    setCancelError(null)
    const result = await cancelSale(cancelId)
    setCancelling(false)
    if (result.error) { setCancelError(result.error); return }
    setCancelId(null)
    setCancelNum('')
  }

  return (
    <PageLayout profile={profile} activeRoute="/sales" onLogout={handleLogout}>

      {/* ── Page header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 24,
        flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: '0 0 4px', letterSpacing: '-0.02em', fontFamily: FONT }}>
            Ventes
          </h1>
          <p style={{ fontSize: 13, color: C.slate, margin: 0, fontFamily: FONT }}>
            {sales.length === 0
              ? 'Aucune vente enregistrée'
              : hasFilters
              ? `${filteredSales.length} résultat${filteredSales.length !== 1 ? 's' : ''} sur ${sales.length} vente${sales.length > 1 ? 's' : ''}`
              : `${sales.length} vente${sales.length > 1 ? 's' : ''} · cliquer une ligne pour le détail`}
          </p>
        </div>
        {['owner', 'admin', 'vendor'].includes(profile.role) && (
          <button
            onClick={() => router.push('/sales/new')}
            style={{
              padding: '10px 20px',
              background: C.navy, color: 'white',
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            + Nouvelle vente
          </button>
        )}
      </div>

      {/* ── Filter bar ── */}
      {sales.length > 0 && (
        <div style={{
          background: C.surface, borderRadius: 10,
          border: `1px solid ${C.border}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          padding: '12px 14px', marginBottom: 14,
          display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        }}>
          <IconFilter />
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 140 }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <IconSearch />
            </span>
            <input
              value={search}
              onChange={e => setSearchPaged(e.target.value)}
              placeholder="N° ou client…"
              style={{
                width: '100%', paddingLeft: 28, paddingRight: 8,
                height: 32, border: `1px solid ${C.border}`,
                borderRadius: 6, fontSize: 12, fontFamily: FONT,
                color: C.ink, background: C.bg, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          {/* Status */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilterPaged(e.target.value)}
            style={{
              height: 32, paddingLeft: 8, paddingRight: 24,
              border: `1px solid ${C.border}`, borderRadius: 6,
              fontSize: 12, fontFamily: FONT, color: statusFilter ? C.ink : C.muted,
              background: C.bg, cursor: 'pointer', outline: 'none', flex: '0 0 auto',
            }}
          >
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          {/* Date from */}
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFromPaged(e.target.value)}
            style={{
              height: 32, padding: '0 8px',
              border: `1px solid ${C.border}`, borderRadius: 6,
              fontSize: 12, fontFamily: FONT, color: dateFrom ? C.ink : C.muted,
              background: C.bg, outline: 'none', flex: '0 0 auto',
            }}
          />
          <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>→</span>
          {/* Date to */}
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateToPaged(e.target.value)}
            style={{
              height: 32, padding: '0 8px',
              border: `1px solid ${C.border}`, borderRadius: 6,
              fontSize: 12, fontFamily: FONT, color: dateTo ? C.ink : C.muted,
              background: C.bg, outline: 'none', flex: '0 0 auto',
            }}
          />
          {/* Boutique (only for admin/owner who can see all boutiques) */}
          {['owner', 'admin'].includes(profile.role) && boutiques.length > 1 && (
            <select
              value={boutiqueFilter}
              onChange={e => setBoutiqueFilterPaged(e.target.value)}
              style={{
                height: 32, paddingLeft: 8, paddingRight: 24,
                border: `1px solid ${C.border}`, borderRadius: 6,
                fontSize: 12, fontFamily: FONT, color: boutiqueFilter ? C.ink : C.muted,
                background: C.bg, cursor: 'pointer', outline: 'none', flex: '0 0 auto',
              }}
            >
              <option value="">Toutes les boutiques</option>
              {boutiques.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
          {/* Clear */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                height: 32, padding: '0 10px',
                background: 'transparent', border: `1px solid ${C.border}`,
                borderRadius: 6, fontSize: 11, fontWeight: 600,
                color: C.slate, cursor: 'pointer', fontFamily: FONT,
                flexShrink: 0,
              }}
            >
              <IconX /> Effacer
            </button>
          )}
        </div>
      )}

      {/* ── Sales table ── */}
      <div style={{
        background: C.surface, borderRadius: 12,
        border: `1px solid ${C.border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden',
      }}>
        {sales.length === 0 ? (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <IconCart size={56} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, marginBottom: 6, fontFamily: FONT }}>
              Aucune vente pour le moment
            </div>
            <p style={{ fontSize: 13, color: C.slate, margin: '0 0 20px', fontFamily: FONT }}>
              Les ventes apparaîtront ici une fois créées.
            </p>
            {['owner', 'admin', 'vendor'].includes(profile.role) && (
              <button
                onClick={() => router.push('/sales/new')}
                style={{
                  padding: '10px 24px',
                  background: C.navy, color: 'white',
                  border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  fontFamily: FONT,
                }}
              >
                Créer la première vente
              </button>
            )}
          </div>
        ) : filteredSales.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 6, fontFamily: FONT }}>
              Aucun résultat
            </div>
            <p style={{ fontSize: 13, color: C.slate, margin: '0 0 16px', fontFamily: FONT }}>
              Aucune vente ne correspond aux filtres sélectionnés.
            </p>
            <button
              onClick={clearFilters}
              style={{
                padding: '8px 18px', background: C.bg, color: C.slate,
                border: `1px solid ${C.border}`, borderRadius: 7,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
              }}
            >
              Effacer les filtres
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: C.bg }}>
                <tr>
                  {['N° Vente', 'Date', 'Client', 'Boutique', 'Vendeur', 'Montant', 'Statut', ''].map(h => (
                    <th key={h} style={TH_STYLE}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedSales.map((sale: any) => {
                  const cfg    = STATUS_CONFIG[sale.status] ?? STATUS_CONFIG.draft
                  const isOpen = expanded === sale.id
                  return (
                    <React.Fragment key={sale.id}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : sale.id)}
                        style={{ cursor: 'pointer', background: isOpen ? '#F8FAFC' : C.surface }}
                        onMouseEnter={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = C.bg }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isOpen ? '#F8FAFC' : C.surface }}
                      >
                        <td style={{ ...TD_STYLE, fontWeight: 700, color: C.navy }}>
                          {sale.sale_number}
                        </td>
                        <td style={{ ...TD_STYLE, color: C.slate, fontSize: 12 }}>
                          {new Date(sale.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: 'short',
                          })}
                          <br />
                          <span style={{ color: C.muted, fontSize: 11 }}>
                            {new Date(sale.created_at).toLocaleTimeString('fr-FR', {
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </td>
                        <td style={TD_STYLE}>{sale.customer_name || <span style={{ color: C.muted }}>—</span>}</td>
                        <td style={{ ...TD_STYLE, fontSize: 12, color: C.slate }}>{sale.boutiques?.name ?? '—'}</td>
                        <td style={{ ...TD_STYLE, fontSize: 12, color: C.slate }}>{sale.users?.full_name ?? '—'}</td>
                        <td style={{ ...TD_STYLE, fontWeight: 700 }}>
                          {fmtCFA(sale.total_amount)}
                        </td>
                        <td style={TD_STYLE}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 11, fontWeight: 600,
                            padding: '4px 10px', borderRadius: 100,
                            background: cfg.bg, color: cfg.color,
                            fontFamily: FONT,
                          }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                            {cfg.label}
                          </span>
                        </td>
                        <td
                          style={{ ...TD_STYLE, textAlign: 'right', whiteSpace: 'nowrap' }}
                          onClick={e => e.stopPropagation()}
                        >
                          {['confirmed', 'draft'].includes(sale.status) &&
                           (profile.role !== 'vendor' || sale.vendor_id === profile.id) && (
                            <button
                              onClick={() => { setCancelId(sale.id); setCancelNum(sale.sale_number); setCancelError(null) }}
                              style={{
                                marginRight: 10, padding: '4px 10px',
                                background: 'transparent', color: C.red,
                                border: `1px solid ${C.red}`, borderRadius: 6,
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                fontFamily: FONT,
                              }}
                            >
                              Annuler
                            </button>
                          )}
                          {isOpen ? <IconChevronUp /> : <IconChevronDown />}
                        </td>
                      </tr>

                      {isOpen && (
                        <tr>
                          <td colSpan={8} style={{ padding: '0 14px 14px', background: '#F8FAFC', borderBottom: `1px solid ${C.border}` }}>
                            <SaleDetail sale={sale} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px',
                borderTop: `1px solid ${C.border}`,
                flexWrap: 'wrap', gap: 10,
              }}>
                <span style={{ fontSize: 12, color: C.muted, fontFamily: FONT }}>
                  Page {page} sur {totalPages} · {filteredSales.length} vente{filteredSales.length > 1 ? 's' : ''}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    style={{
                      padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${C.border}`, cursor: page === 1 ? 'default' : 'pointer',
                      background: page === 1 ? C.bg : C.surface, color: page === 1 ? C.muted : C.ink,
                      fontFamily: FONT,
                    }}>
                    ← Précédent
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => p + 1)}
                    style={{
                      padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${C.border}`, cursor: page === totalPages ? 'default' : 'pointer',
                      background: page === totalPages ? C.bg : C.surface, color: page === totalPages ? C.muted : C.ink,
                      fontFamily: FONT,
                    }}>
                    Suivant →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Cancel modal ── */}
      {cancelId && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,23,42,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20,
          backdropFilter: 'blur(3px)',
        }}>
          <div style={{
            background: C.surface, borderRadius: 14,
            width: '100%', maxWidth: 420,
            boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: C.redL,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke={C.red} strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, fontFamily: FONT }}>
                  Annuler la vente {cancelNum}
                </div>
                <div style={{ fontSize: 12, color: C.slate, fontFamily: FONT }}>Cette action est irréversible</div>
              </div>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: C.slate, fontFamily: FONT }}>
                La vente sera marquée comme annulée. Les réservations de stock seront libérées.
              </p>
              {cancelError && (
                <div style={{
                  marginBottom: 14, padding: '10px 12px',
                  background: C.redL, borderRadius: 8,
                  fontSize: 12, color: C.red, fontWeight: 600,
                  border: `1px solid #FECACA`, fontFamily: FONT,
                }}>
                  {cancelError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleCancelConfirm}
                  disabled={cancelling}
                  style={{
                    flex: 1, padding: '11px',
                    background: cancelling ? C.muted : C.red,
                    color: 'white', border: 'none', borderRadius: 8,
                    fontSize: 13, fontWeight: 600, cursor: cancelling ? 'not-allowed' : 'pointer',
                    fontFamily: FONT,
                  }}
                >
                  {cancelling ? 'Annulation…' : "Confirmer l'annulation"}
                </button>
                <button
                  onClick={() => { setCancelId(null); setCancelError(null) }}
                  style={{
                    padding: '11px 18px', background: C.bg,
                    color: C.slate, border: `1px solid ${C.border}`,
                    borderRadius: 8, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  Retour
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}

function IconPrint({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <rect x="2" y="5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4 5V2.5A.5.5 0 0 1 4.5 2h5a.5.5 0 0 1 .5.5V5" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="4.5" y="8" width="5" height="2.5" rx=".5" fill="currentColor"/>
      <circle cx="4" cy="7" r=".6" fill="currentColor"/>
    </svg>
  )
}

function printSaleReceipt(sale: any) {
  const now = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const rows = (sale.sale_items ?? []).map((item: any) => {
    const tileArea    = parseFloat(item.tile_area_m2_snapshot)
    const tpc         = parseInt(item.tiles_per_carton_snapshot)
    const m2          = item.quantity_tiles * tileArea
    const fullCartons = Math.floor(item.quantity_tiles / tpc)
    const loose       = item.quantity_tiles % tpc
    return `
      <tr>
        <td>${item.products?.name ?? '—'}</td>
        <td style="color:#64748B;font-size:11px">${item.products?.reference_code ?? '—'}</td>
        <td style="text-align:center">${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(m2)} m²</td>
        <td style="text-align:center">${fullCartons}${loose > 0 ? ` <span style="color:#D97706">+${loose}</span>` : ''}</td>
        <td style="text-align:right">${new Intl.NumberFormat('fr-FR').format(item.unit_price_per_m2)} FCFA</td>
        <td style="text-align:right;font-weight:700">${new Intl.NumberFormat('fr-FR').format(Math.round(item.total_price))} FCFA</td>
      </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Reçu de vente — ${sale.sale_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0 }
    body { font-family: system-ui,-apple-system,'Segoe UI',sans-serif; color: #0F172A; padding: 32px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #0F172A; }
    .logo { font-size: 24px; font-weight: 800; letter-spacing: -0.03em; font-family: Georgia, serif; }
    .logo span { color: #2563EB; }
    .meta { font-size: 11px; color: #64748B; text-align: right; line-height: 1.8 }
    .sale-id { font-size: 22px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em; margin-bottom: 4px }
    .info-block { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; display: flex; gap: 32px; }
    .info-col { flex: 1 }
    .info-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #94A3B8; margin-bottom: 3px; }
    .info-value { font-size: 13px; font-weight: 600; color: #0F172A; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94A3B8; padding: 0 10px 10px 0; border-bottom: 2px solid #0F172A; }
    td { padding: 10px 10px 10px 0; border-bottom: 1px solid #E2E8F0; vertical-align: middle; }
    .total-row { display: flex; justify-content: flex-end; margin-bottom: 28px; }
    .total-box { background: #0F172A; color: white; padding: 14px 24px; border-radius: 8px; text-align: right; }
    .total-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #94A3B8; margin-bottom: 4px; }
    .total-amount { font-size: 22px; font-weight: 900; letter-spacing: -0.02em; }
    .sig-section { margin-top: 32px; padding-top: 20px; border-top: 1px solid #E2E8F0; }
    .sig-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #94A3B8; margin-bottom: 16px; }
    .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
    .sig-name { font-size: 12px; font-weight: 600; color: #0F172A; margin-bottom: 4px; }
    .sig-role { font-size: 11px; color: #64748B; margin-bottom: 12px; }
    .sig-line { border-bottom: 1px solid #CBD5E1; height: 48px; margin-bottom: 6px; }
    .sig-sub { font-size: 10px; color: #94A3B8; }
    .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #94A3B8; padding-top: 16px; border-top: 1px solid #E2E8F0; }
    @media print { @page { margin: 20mm; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">UC<span>A</span></div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">Reçu de vente officiel</div>
    </div>
    <div class="meta">
      <div>${now}</div>
      <div>${sale.boutiques?.name ?? ''}</div>
    </div>
  </div>

  <div class="sale-id">${sale.sale_number ?? '—'}</div>
  <div style="font-size:12px;color:#64748B;margin-bottom:20px">
    ${new Date(sale.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
  </div>

  <div class="info-block">
    <div class="info-col">
      <div class="info-label">Client</div>
      <div class="info-value">${sale.customer_name || 'Client anonyme'}</div>
      ${sale.customer_phone ? `<div style="font-size:12px;color:#64748B;margin-top:2px">${sale.customer_phone}</div>` : ''}
    </div>
    <div class="info-col">
      <div class="info-label">Vendeur</div>
      <div class="info-value">${sale.users?.full_name ?? '—'}</div>
      <div style="font-size:12px;color:#64748B;margin-top:2px">${sale.boutiques?.name ?? ''}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Produit</th>
        <th>Référence</th>
        <th style="text-align:center">Surface</th>
        <th style="text-align:center">Cartons</th>
        <th style="text-align:right">Prix/m²</th>
        <th style="text-align:right">Sous-total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="total-row">
    <div class="total-box">
      <div class="total-label">Montant total</div>
      <div class="total-amount">${new Intl.NumberFormat('fr-FR').format(Math.round(sale.total_amount))} FCFA</div>
    </div>
  </div>

  <div class="sig-section">
    <div class="sig-title">Signatures</div>
    <div class="sig-grid">
      <div>
        <div class="sig-name">${sale.users?.full_name ?? 'Le vendeur'}</div>
        <div class="sig-role">Vendeur — ${sale.boutiques?.name ?? ''}</div>
        <div class="sig-line"></div>
        <div class="sig-sub">Signature du vendeur</div>
      </div>
      <div>
        <div class="sig-name">Direction</div>
        <div class="sig-role">Responsable / Propriétaire</div>
        <div class="sig-line"></div>
        <div class="sig-sub">Signature direction</div>
      </div>
    </div>
  </div>

  <div class="footer">Document officiel UCA · ${sale.sale_number}</div>
</body>
</html>`

  const w = window.open('', '_blank', 'width=800,height=900')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 400)
}

// ── Sale detail panel ─────────────────────────────────────────────────────────
function SaleDetail({ sale }: { sale: any }) {
  return (
    <div style={{
      background: C.bg, borderRadius: 8,
      padding: '14px 16px', border: `1px solid ${C.border}`,
      marginTop: 2,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: C.muted,
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12,
        fontFamily: FONT,
      }}>
        Détail des articles
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Produit', 'Référence', 'Surface', 'Cartons', 'Carreaux', 'Prix/m²', 'Sous-total'].map(h => (
                <th key={h} style={{
                  textAlign: 'left', fontSize: 10, fontWeight: 600, color: C.muted,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  padding: '0 12px 8px 0', borderBottom: `1px solid ${C.border}`,
                  fontFamily: FONT,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(sale.sale_items ?? []).map((item: any) => {
              const tileArea    = parseFloat(item.tile_area_m2_snapshot)
              const tpc         = parseInt(item.tiles_per_carton_snapshot)
              const m2          = item.quantity_tiles * tileArea
              const fullCartons = Math.floor(item.quantity_tiles / tpc)
              const loose       = item.quantity_tiles % tpc
              return (
                <tr key={item.id}>
                  <td style={{ padding: '8px 12px 8px 0', fontSize: 13, fontWeight: 600, color: C.ink, fontFamily: FONT }}>
                    {item.products?.name ?? '—'}
                  </td>
                  <td style={{ padding: '8px 12px 8px 0', fontSize: 11, color: C.muted, fontFamily: FONT }}>
                    {item.products?.reference_code ?? '—'}
                  </td>
                  <td style={{ padding: '8px 12px 8px 0', fontSize: 13, color: C.slate, fontFamily: FONT }}>
                    {fmtM2(m2)}
                  </td>
                  <td style={{ padding: '8px 12px 8px 0', fontSize: 13, color: C.slate, fontFamily: FONT }}>
                    {fullCartons}
                    {loose > 0 && <span style={{ color: C.orange, fontSize: 11 }}> +{loose}</span>}
                  </td>
                  <td style={{ padding: '8px 12px 8px 0', fontSize: 13, color: C.slate, fontFamily: FONT }}>
                    {fmtNum(item.quantity_tiles)}
                  </td>
                  <td style={{ padding: '8px 12px 8px 0', fontSize: 13, color: C.slate, fontFamily: FONT }}>
                    {fmtNum(item.unit_price_per_m2)} FCFA
                  </td>
                  <td style={{ padding: '8px 0', fontSize: 13, fontWeight: 700, color: C.ink, fontFamily: FONT }}>
                    {fmtCFA(item.total_price)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 4,
        flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ fontSize: 12, color: C.slate, display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: FONT }}>
          {sale.customer_phone && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2.5c0-.28.22-.5.5-.5h2l.75 2L4 5.5s.5 1.5 2.5 2.5l1.5-1.25 2 .75V9.5c0 .28-.22.5-.5.5C4.07 10 2 4.93 2 2.5Z" stroke={C.muted} strokeWidth="1.1"/>
              </svg>
              {sale.customer_phone}
            </span>
          )}
          {sale.notes && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke={C.muted} strokeWidth="1.1"/>
                <path d="M3.5 4h5M3.5 6h5M3.5 8h3" stroke={C.muted} strokeWidth="1" strokeLinecap="round"/>
              </svg>
              {sale.notes}
            </span>
          )}
          {!sale.customer_phone && !sale.notes && <span style={{ color: C.muted }}>Aucune note</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => printSaleReceipt(sale)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px',
              background: 'transparent', color: C.slate,
              border: `1px solid ${C.border}`, borderRadius: 6,
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            <IconPrint /> Imprimer le reçu
          </button>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, fontFamily: FONT }}>
            Total : {fmtCFA(sale.total_amount)}
          </div>
        </div>
      </div>
    </div>
  )
}

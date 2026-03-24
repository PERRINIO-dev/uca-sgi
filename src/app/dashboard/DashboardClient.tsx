'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter }                    from 'next/navigation'
import { createClient }   from '@/lib/supabase/client'
import { approveStockRequest, rejectStockRequest } from './actions'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import PageLayout from '@/components/PageLayout'
import type { BadgeCounts } from '@/lib/supabase/badge-counts'

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtCFA = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
const fmtNum = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(n)

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  ink:     '#0F172A', slate:  '#475569', muted:  '#94A3B8',
  border:  '#E2E8F0', bg:     '#F8FAFC', surface: '#FFFFFF',
  navy:    '#1B3A6B', navyDark: '#0C1A35',
  blue:    '#2563EB', blueL:  '#EFF6FF',
  green:   '#059669', greenL: '#ECFDF5',
  orange:  '#D97706', orangeL: '#FFFBEB',
  red:     '#DC2626', redL:   '#FEF2F2',
  gold:    '#B45309', goldL:  '#FFFBEB',
}
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif"

// ── KPI icons ─────────────────────────────────────────────────────────────────
function IconRevenue() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M10 2v2m0 12v2M6 6.5h5.5a2 2 0 010 4H8a2 2 0 000 4H14" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}
function IconCount() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="4" width="14" height="13" rx="2" stroke="#fff" strokeWidth="1.5"/>
      <path d="M7 9h6M7 12h4" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M7 3v2M13 3v2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function IconBasket() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M4 6h12l-1.5 8H5.5L4 6Z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M7 6L9 3M13 6l-2-3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M8 10v3M12 10v3" stroke="#fff" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}
function IconCheck() {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
      <path d="M5 10.5l4 4 6-7" stroke={C.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Panel({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.surface, borderRadius: 12,
      border: `1px solid ${C.border}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      padding: '20px 22px',
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: C.muted,
      textTransform: 'uppercase', letterSpacing: '0.08em',
      marginBottom: 14, fontFamily: FONT,
    }}>
      {children}
    </div>
  )
}

function ModalOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15,23,42,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
      backdropFilter: 'blur(3px)',
    }}>
      {children}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DashboardClient({
  profile,
  todayRevenue,
  todayCount,
  pendingRequests,
  stockAlerts,
  boutiqueStats,
  dailyChart,
  badgeCounts,
}: {
  profile:         any
  todayRevenue:    number
  todayCount:      number
  pendingRequests: any[]
  stockAlerts:     any[]
  boutiqueStats:   any[]
  dailyChart:      any[]
  badgeCounts?:    BadgeCounts
}) {
  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // ── Real-time: refresh when sales or stock_requests change ────────────────
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_requests' }, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [rejectId,  setRejectId]  = useState<string | null>(null)
  const [rejectMsg, setRejectMsg] = useState('')
  const [loading,   setLoading]   = useState<string | null>(null)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleApprove = async (id: string) => {
    setLoading(id)
    await approveStockRequest(id)
    setLoading(null)
  }

  const handleReject = async () => {
    if (!rejectId || !rejectMsg.trim()) return
    setLoading(rejectId)
    await rejectStockRequest(rejectId, rejectMsg)
    setRejectId(null)
    setRejectMsg('')
    setLoading(null)
  }

  const avgBasket = todayCount > 0 ? todayRevenue / todayCount : 0

  const kpis = [
    {
      label:  "Chiffre d'affaires",
      sub:    "Aujourd'hui · ventes livrées",
      value:  fmtCFA(todayRevenue),
      color:  C.blue,
      colorL: C.blueL,
      Icon:   IconRevenue,
    },
    {
      label:  'Ventes du jour',
      sub:    'Ventes livrées aujourd\'hui',
      value:  String(todayCount),
      color:  C.green,
      colorL: C.greenL,
      Icon:   IconCount,
    },
    {
      label:  'Panier moyen',
      sub:    'Par transaction',
      value:  fmtCFA(avgBasket),
      color:  C.orange,
      colorL: C.orangeL,
      Icon:   IconBasket,
    },
  ]

  return (
    <PageLayout profile={profile} activeRoute="/dashboard" onLogout={handleLogout} badgeCounts={badgeCounts}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontSize: 22, fontWeight: 700, color: C.ink,
          margin: '0 0 6px', letterSpacing: '-0.02em', fontFamily: FONT,
        }}>
          Tableau de bord
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 13, color: C.slate, margin: 0, fontFamily: FONT }}>
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
          {pendingRequests.length > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: C.goldL, color: C.gold,
              border: `1px solid #FDE68A`,
              borderRadius: 100, padding: '3px 10px',
              fontSize: 11, fontWeight: 600, fontFamily: FONT,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.gold, flexShrink: 0 }} />
              {pendingRequests.length} approbation{pendingRequests.length > 1 ? 's' : ''} en attente
            </span>
          )}
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16, marginBottom: 24,
      }}>
        {kpis.map(({ label, sub, value, color, Icon }) => (
          <div key={label} style={{
            background: C.surface, borderRadius: 12,
            border: `1px solid ${C.border}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            padding: '18px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted,
                textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FONT }}>
                {label}
              </div>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon />
              </div>
            </div>
            <div style={{
              fontSize: 26, fontWeight: 800, color: C.ink,
              letterSpacing: '-0.02em', lineHeight: 1.1, fontFamily: FONT,
              marginBottom: 6,
            }}>
              {value}
            </div>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16, marginBottom: 24,
      }}>
        <Panel>
          <SectionTitle>Ventes des 7 derniers jours</SectionTitle>
          {dailyChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={dailyChart} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.blue} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} tickFormatter={v => (v / 1000) + 'k'} />
                <Tooltip
                  formatter={(v) => [fmtCFA(Number(v)), 'CA']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}`, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontFamily: FONT }}
                />
                <Area type="monotone" dataKey="ca" stroke={C.blue} strokeWidth={2} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 13, fontFamily: FONT }}>
              Aucune vente sur la période
            </div>
          )}
        </Panel>

        <Panel>
          <SectionTitle>CA par boutique (semaine)</SectionTitle>
          {boutiqueStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={boutiqueStats} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} tickFormatter={v => (v / 1000) + 'k'} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: C.ink, fontWeight: 600 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={(v) => [fmtCFA(Number(v)), 'CA']} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}`, fontFamily: FONT }} />
                <Bar dataKey="ca" fill={C.blue} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 13, fontFamily: FONT }}>
              Aucune vente cette semaine
            </div>
          )}
        </Panel>
      </div>

      {/* ── Bottom panels ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
      }}>

        {/* Pending approvals */}
        <Panel>
          <SectionTitle>Approbations en attente</SectionTitle>
          {pendingRequests.length === 0 ? (
            <div style={{
              padding: '28px 0', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: C.greenL,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconCheck />
              </div>
              <span style={{ color: C.muted, fontSize: 13, fontFamily: FONT }}>
                Aucune demande en attente
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendingRequests.map((req: any) => (
                <div key={req.id} style={{
                  padding: '12px 14px',
                  background: C.bg,
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, fontFamily: FONT }}>
                      {req.products?.name ?? 'Produit inconnu'}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, flexShrink: 0, marginLeft: 8,
                      color: req.request_type === 'stock_in' ? C.blue : C.orange,
                      background: req.request_type === 'stock_in' ? C.blueL : C.orangeL,
                      padding: '2px 8px', borderRadius: 100, fontFamily: FONT,
                    }}>
                      {req.request_type === 'stock_in' ? 'Entrée stock' : 'Correction'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: C.slate, marginBottom: 6, fontFamily: FONT }}>
                    {req.users?.full_name} ·{' '}
                    <span style={{
                      fontWeight: 700,
                      color: req.quantity_tiles_delta > 0 ? C.green : C.red,
                    }}>
                      {req.quantity_tiles_delta > 0 ? '+' : ''}
                      {fmtNum(req.quantity_tiles_delta)} carreaux
                    </span>
                  </div>
                  {req.justification && (
                    <div style={{
                      fontSize: 11, color: C.muted,
                      marginBottom: 10, fontStyle: 'italic',
                      borderLeft: `2px solid ${C.border}`, paddingLeft: 8,
                      fontFamily: FONT,
                    }}>
                      "{req.justification}"
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleApprove(req.id)}
                      disabled={loading === req.id}
                      style={{
                        flex: 1, padding: '8px', background: C.green,
                        color: 'white', border: 'none', borderRadius: 7,
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        opacity: loading === req.id ? 0.6 : 1,
                        fontFamily: FONT,
                      }}
                    >
                      {loading === req.id ? '…' : 'Approuver'}
                    </button>
                    <button
                      onClick={() => setRejectId(req.id)}
                      disabled={loading === req.id}
                      style={{
                        flex: 1, padding: '8px',
                        background: 'transparent',
                        color: C.red, border: `1px solid ${C.red}`,
                        borderRadius: 7, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: FONT,
                      }}
                    >
                      Rejeter
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Stock alerts */}
        <Panel>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONT,
            }}>
              Alertes stock critique
            </div>
            {stockAlerts.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: C.orange,
                background: C.orangeL, border: '1px solid #FDE68A',
                borderRadius: 100, padding: '2px 10px', fontFamily: FONT,
              }}>
                {stockAlerts.length} produit{stockAlerts.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {stockAlerts.length === 0 ? (
            <div style={{
              padding: '28px 0', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: C.greenL,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconCheck />
              </div>
              <span style={{ color: C.muted, fontSize: 13, fontFamily: FONT }}>
                Tous les stocks sont suffisants
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(stockAlerts.length > 6 ? stockAlerts.slice(0, 6) : stockAlerts).map((item: any) => {
                const avail  = Number(item.available_full_cartons)
                const isCrit = avail < 20
                const bg     = isCrit ? C.redL    : C.orangeL
                const clr    = isCrit ? C.red     : C.orange
                const bdr    = isCrit ? '#FECACA' : '#FDE68A'
                return (
                  <div key={item.product_id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px',
                    background: bg, borderRadius: 8,
                    border: `1px solid ${bdr}`,
                  }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: clr, flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: C.ink,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        fontFamily: FONT,
                      }}>
                        {item.product_name}
                      </div>
                      <div style={{ fontSize: 11, color: C.slate, fontFamily: FONT }}>
                        {item.reference_code}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: clr, lineHeight: 1, fontFamily: FONT }}>
                        {fmtNum(avail)}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 1, fontFamily: FONT }}>cartons</div>
                    </div>
                  </div>
                )
              })}
              {stockAlerts.length > 6 && (
                <div style={{
                  textAlign: 'center', fontSize: 12, color: C.muted,
                  padding: '8px 0 2px', fontFamily: FONT,
                }}>
                  + {stockAlerts.length - 6} autre{stockAlerts.length - 6 > 1 ? 's' : ''} produit{stockAlerts.length - 6 > 1 ? 's' : ''} en alerte — consultez le <a href="/products" style={{ color: C.blue, textDecoration: 'none' }}>catalogue</a>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Reject modal ── */}
      {rejectId && (
        <ModalOverlay>
          <div style={{
            background: C.surface, borderRadius: 14,
            width: '100%', maxWidth: 440,
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
                background: C.redL, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke={C.red} strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, fontFamily: FONT }}>Rejeter la demande</div>
                <div style={{ fontSize: 12, color: C.slate, fontFamily: FONT }}>Un motif est obligatoire</div>
              </div>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <textarea
                value={rejectMsg}
                onChange={e => setRejectMsg(e.target.value)}
                rows={3}
                placeholder="Expliquez pourquoi cette demande est rejetée…"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: `1.5px solid ${C.border}`, fontSize: 13,
                  color: C.ink, outline: 'none', resize: 'vertical',
                  boxSizing: 'border-box', fontFamily: FONT,
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button
                  onClick={handleReject}
                  disabled={!rejectMsg.trim() || loading === rejectId}
                  style={{
                    flex: 1, padding: '11px', background: C.red,
                    color: 'white', border: 'none', borderRadius: 8,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    opacity: !rejectMsg.trim() ? 0.5 : 1, fontFamily: FONT,
                  }}
                >
                  Confirmer le rejet
                </button>
                <button
                  onClick={() => { setRejectId(null); setRejectMsg('') }}
                  style={{
                    padding: '11px 18px', background: C.bg,
                    color: C.slate, border: `1px solid ${C.border}`,
                    borderRadius: 8, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}
    </PageLayout>
  )
}

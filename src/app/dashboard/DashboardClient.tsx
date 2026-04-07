'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter }                    from 'next/navigation'
import useSWR, { useSWRConfig }         from 'swr'
import { createClient }   from '@/lib/supabase/client'
import { approveStockRequest, rejectStockRequest } from './actions'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import PageLayout       from '@/components/PageLayout'
import type { BadgeCounts } from '@/lib/supabase/badge-counts'
import { CRITICAL_STOCK_CARTONS, CRITICAL_STOCK_UNITS } from '@/lib/constants'
import { fmtCurrency } from '@/lib/format'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtNum = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(n)

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  ink:     '#1C1917', slate:  '#44403C', muted:  '#78716C',
  border:  '#E7E5E4', bg:     '#F5F2ED', surface: '#FDFCF9',
  blue:    '#2563EB', blueL:  '#EFF6FF',
  green:   '#059669', greenL: '#ECFDF5',
  orange:  '#D97706', orangeL: '#FFFBEB',
  red:     '#DC2626', redL:   '#FEF2F2',
  gold:    '#B45309', goldL:  '#FFFBEB',
  purple:  '#8B5CF6', purpleL: '#F5F3FF',
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
// Icon for "Créances" (receivables) — clock with currency symbol
function IconCreances() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.5" stroke="#fff" strokeWidth="1.5"/>
      <path d="M10 6.5v4l2.5 2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconMargin() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M3 17l4-5 4 2 6-8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="16" cy="5" r="1.5" fill="#fff"/>
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
function Panel({ children, style = {}, tourId }: { children: React.ReactNode; style?: React.CSSProperties; tourId?: string }) {
  return (
    <div
      className="card-premium"
      style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.05)', padding: '20px 22px', ...style }}
      {...(tourId ? { 'data-tour': tourId } : {})}
    >
      {children}
    </div>
  )
}

function SectionTitle({ children, accent = C.blue }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16, fontFamily: FONT }}>
      <div style={{ width: 3, height: 14, borderRadius: 2, background: accent, flexShrink: 0 }} />
      <span style={{ fontSize: 11.5, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: '0.10em' }}>
        {children}
      </span>
    </div>
  )
}

function ModalOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="modal-overlay" style={{
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
  currency,
  todayCount,
  mtdRevenue,
  mtdCreances,
  mtdAvgBasket,
  mtdTrend,
  mtdMargin,
  mtdMarginPct,
  allTimeCreances,
  activeOrdersCount,
  pendingRequests,
  stockAlerts,
  boutiqueStats,
  dailyChart,
  badgeCounts,
}: {
  profile:           any
  currency:          string
  todayCount:        number
  mtdRevenue:        number
  mtdCreances:       number
  mtdAvgBasket:      number
  mtdTrend:          number | null
  mtdMargin:         number
  mtdMarginPct:      number | null
  allTimeCreances:   number
  activeOrdersCount: number
  pendingRequests:   any[]
  stockAlerts:       any[]
  boutiqueStats:     any[]
  dailyChart:        any[]
  badgeCounts?:      BadgeCounts
}) {
  const router        = useRouter()
  const supabase      = useMemo(() => createClient(), [])
  const { mutate }    = useSWRConfig()

  // ── SWR: client-side cache — server props are fallback (instant on return visits) ──
  const { data } = useSWR('/api/dashboard', fetcher, {
    fallbackData: {
      currency, todayCount,
      mtdRevenue, mtdCreances, mtdAvgBasket, mtdTrend,
      mtdMargin, mtdMarginPct, allTimeCreances,
      activeOrdersCount, pendingRequests, stockAlerts,
      boutiqueStats, dailyChart, badgeCounts,
    },
    revalidateOnFocus: false,
    dedupingInterval:  60_000,  // don't re-fetch more than once per minute
  })

  const d = data as any
  const fmt = (n: number) => fmtCurrency(Number(n), d.currency ?? currency)

  // ── Real-time: revalidate SWR cache when sales or stock_requests change ───
  useEffect(() => {
    const refresh = () => { mutate('/api/dashboard'); router.refresh() }
    const channel = supabase
      .channel('dashboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_requests' }, refresh)
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
    const result = await approveStockRequest(id)
    setLoading(null)
    if (result?.error) { alert(result.error); return }
    mutate('/api/dashboard')
    router.refresh()
  }

  const handleReject = async () => {
    if (!rejectId || !rejectMsg.trim()) return
    setLoading(rejectId)
    const result = await rejectStockRequest(rejectId, rejectMsg)
    setLoading(null)
    if (result?.error) { alert(result.error); return }
    setRejectId(null)
    setRejectMsg('')
    mutate('/api/dashboard')
    router.refresh()
  }

  const kpis = [
    {
      label:  "CA du mois",
      sub:    new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      value:  fmt(d.mtdRevenue),
      color:  C.blue,
      Icon:   IconRevenue,
      trend:  d.mtdTrend,
    },
    {
      label:  'Créances clients',
      sub:    `Ce mois : ${fmt(d.mtdCreances)}`,
      value:  fmt(d.allTimeCreances),
      color:  d.allTimeCreances > 0 ? C.orange : C.green,
      Icon:   IconCreances,
      trend:  null,
    },
    {
      label:  'Commandes actives',
      sub:    'Confirmées · en préparation · prêtes',
      value:  String(d.activeOrdersCount),
      color:  C.purple,
      Icon:   IconCount,
      trend:  null,
    },
    {
      label:  'Panier moyen (mois)',
      sub:    `${d.todayCount} vente${d.todayCount !== 1 ? 's' : ''} aujourd'hui`,
      value:  fmt(d.mtdAvgBasket),
      color:  C.green,
      Icon:   IconBasket,
      trend:  null,
    },
    ...(profile.role === 'owner' ? [{
      label:  'Marge brute (mois)',
      sub:    d.mtdMarginPct !== null
        ? `${d.mtdMarginPct >= 0 ? '+' : ''}${d.mtdMarginPct.toFixed(1)} % du CA`
        : 'Aucune vente ce mois',
      value:  fmt(d.mtdMargin),
      color:  d.mtdMargin >= 0 ? C.green : C.red,
      Icon:   IconMargin,
      trend:  null,
    }] : []),
  ]

  return (
    <PageLayout profile={profile} activeRoute="/dashboard" onLogout={handleLogout} badgeCounts={d.badgeCounts}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{
            fontSize: 24, fontWeight: 800, color: C.ink,
            margin: '0 0 5px', letterSpacing: '-0.03em', fontFamily: FONT,
          }}>
            Tableau de bord
          </h1>
          <p style={{ fontSize: 13, color: C.muted, margin: 0, fontFamily: FONT }}>
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
        {d.pendingRequests.length > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: C.goldL, color: C.gold,
            border: `1px solid #FDE68A`,
            borderRadius: 100, padding: '5px 14px',
            fontSize: 11.5, fontWeight: 700, fontFamily: FONT,
            boxShadow: '0 1px 4px rgba(217,119,6,0.15)',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.gold, flexShrink: 0 }} />
            {d.pendingRequests.length} approbation{d.pendingRequests.length > 1 ? 's' : ''} en attente
          </span>
        )}
      </div>

      {/* ── KPI cards ── */}
      <div data-tour="tour-kpis" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 14, marginBottom: 24,
      }}>
        {kpis.map(({ label, sub, value, color, Icon, trend }) => (
          <div key={label} className="kpi-card" style={{
            background: C.surface, borderRadius: 14,
            border: `1px solid ${C.border}`,
            borderLeft: `4px solid ${color}`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)',
            padding: '18px 20px 20px',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            {/* Label + icon row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: C.muted,
                textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: FONT,
                lineHeight: 1.4, paddingTop: 2,
              }}>
                {label}
              </div>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: `0 4px 12px ${color}55`,
              }}>
                <Icon />
              </div>
            </div>
            {/* Value + sub */}
            <div>
              <div className="num" style={{
                fontSize: 30, fontWeight: 800, color: C.ink,
                letterSpacing: '-0.04em', lineHeight: 1, fontFamily: FONT,
              }}>
                {value}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, color: C.muted, fontFamily: FONT }}>{sub}</span>
                {trend !== null && trend !== undefined && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 8px',
                    borderRadius: 100, fontFamily: FONT,
                    background: trend >= 0 ? C.greenL : C.redL,
                    color: trend >= 0 ? C.green : C.red,
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    border: `1px solid ${trend >= 0 ? '#A7F3D0' : '#FECACA'}`,
                  }}>
                    {trend >= 0
                      ? <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M4 7V1M1 4l3-3 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      : <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M4 1v6M1 4l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    }
                    {trend >= 0 ? '+' : ''}{trend.toFixed(0)} %
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16, marginBottom: 24,
      }}>
        <Panel tourId="tour-chart">
          <SectionTitle>Ventes des 30 derniers jours</SectionTitle>
          {d.dailyChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={d.dailyChart} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={C.blue} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#EDE9E3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.muted, fontFamily: FONT }} axisLine={false} tickLine={false} dy={6} />
                <YAxis tick={{ fontSize: 10, fill: C.muted, fontFamily: FONT }} axisLine={false} tickLine={false} tickFormatter={v => (v / 1000) + 'k'} width={36} />
                <Tooltip
                  formatter={(v) => [fmt(Number(v)), 'CA']}
                  contentStyle={{
                    fontSize: 12.5, borderRadius: 10,
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                    fontFamily: FONT, padding: '8px 14px',
                  }}
                  labelStyle={{ fontWeight: 700, color: C.ink, marginBottom: 4 }}
                  cursor={{ stroke: C.blue, strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area
                  type="monotone" dataKey="ca"
                  stroke={C.blue} strokeWidth={2.5}
                  fill="url(#gradBlue)"
                  dot={false}
                  activeDot={{ r: 5, fill: C.blue, strokeWidth: 2, stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 13, fontFamily: FONT }}>
              Aucune vente sur la période
            </div>
          )}
        </Panel>

        <Panel>
          <SectionTitle>CA par boutique (mois en cours)</SectionTitle>
          {d.boutiqueStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={d.boutiqueStats} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#EDE9E3" vertical={true} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: C.muted, fontFamily: FONT }} tickFormatter={v => (v / 1000) + 'k'} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12.5, fill: C.ink, fontWeight: 600, fontFamily: FONT }} axisLine={false} tickLine={false} width={85} />
                <Tooltip
                  formatter={(v) => [fmt(Number(v)), 'CA']}
                  contentStyle={{
                    fontSize: 12.5, borderRadius: 10,
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                    fontFamily: FONT, padding: '8px 14px',
                  }}
                  cursor={{ fill: 'rgba(37,99,235,0.04)' }}
                />
                <Bar dataKey="ca" fill={C.blue} radius={[0, 8, 8, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 13, fontFamily: FONT }}>
              Aucune vente ce mois
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
          {d.pendingRequests.length === 0 ? (
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
              {d.pendingRequests.map((req: any) => (
                <div key={req.id} style={{
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: C.surface,
                  overflow: 'hidden',
                }}>
                  {/* Card header */}
                  <div style={{ padding: '11px 14px', background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, fontFamily: FONT, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {req.products?.name ?? 'Produit inconnu'}
                      </span>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, flexShrink: 0,
                        color: req.request_type === 'stock_in' ? C.blue : C.orange,
                        background: req.request_type === 'stock_in' ? C.blueL : C.orangeL,
                        padding: '2px 8px', borderRadius: 100, fontFamily: FONT,
                        border: `1px solid ${req.request_type === 'stock_in' ? '#BFDBFE' : '#FDE68A'}`,
                      }}>
                        {req.request_type === 'stock_in' ? 'Entrée stock' : 'Correction'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                      <span style={{ fontSize: 12, color: C.muted, fontFamily: FONT }}>{req.users?.full_name}</span>
                      <span style={{ color: C.border, fontSize: 14 }}>·</span>
                      <span style={{
                        fontSize: 12, fontWeight: 700, fontFamily: FONT,
                        color: req.quantity_tiles_delta > 0 ? C.green : C.red,
                      }}>
                        {req.quantity_tiles_delta > 0 ? '+' : ''}
                        {fmtNum(req.quantity_tiles_delta)}{' '}
                        {(req.products?.product_type ?? 'tile') === 'tile' ? 'carreaux' : (req.products?.unit_label ?? 'unités')}
                      </span>
                    </div>
                  </div>
                  {/* Justification */}
                  {req.justification && (
                    <div style={{ padding: '8px 14px', borderBottom: `1px solid ${C.border}`, background: C.surface }}>
                      <span style={{ fontSize: 11.5, color: C.muted, fontStyle: 'italic', fontFamily: FONT }}>
                        « {req.justification} »
                      </span>
                    </div>
                  )}
                  {/* Actions */}
                  <div style={{ display: 'flex' }}>
                    <button
                      onClick={() => handleApprove(req.id)}
                      disabled={loading === req.id}
                      style={{
                        flex: 1, padding: '10px 12px', background: 'transparent',
                        color: C.green, border: 'none', borderRight: `1px solid ${C.border}`,
                        fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                        fontFamily: FONT,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.greenL)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {loading === req.id
                        ? <><span className="spinner" style={{ width: 12, height: 12, borderTopColor: C.green }} />En cours…</>
                        : <>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 6.5l3 3 6-6" stroke={C.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            Approuver
                          </>
                      }
                    </button>
                    <button
                      onClick={() => setRejectId(req.id)}
                      disabled={loading === req.id}
                      style={{
                        flex: 1, padding: '10px 12px', background: 'transparent',
                        color: C.red, border: 'none',
                        fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                        fontFamily: FONT,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.redL)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
              fontSize: 12, fontWeight: 700, color: C.slate,
              textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONT,
            }}>
              Alertes stock critique
            </div>
            {d.stockAlerts.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: C.orange,
                background: C.orangeL, border: '1px solid #FDE68A',
                borderRadius: 100, padding: '2px 10px', fontFamily: FONT,
              }}>
                {d.stockAlerts.length} produit{d.stockAlerts.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {d.stockAlerts.length === 0 ? (
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {(d.stockAlerts.length > 6 ? d.stockAlerts.slice(0, 6) : d.stockAlerts).map((item: any) => {
                const isTile = (item.product_type ?? 'tile') === 'tile'
                const avail  = isTile ? Number(item.available_full_cartons) : Number(item.available_tiles)
                const isCrit = isTile ? avail < CRITICAL_STOCK_CARTONS : avail < CRITICAL_STOCK_UNITS
                const clr    = isCrit ? C.red : C.orange
                const bdr    = isCrit ? '#FECACA' : '#FDE68A'
                const unit   = isTile ? 'cartons' : 'unités'
                return (
                  <div key={item.product_id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px',
                    background: C.surface, borderRadius: 8,
                    border: `1px solid ${bdr}`,
                    borderLeft: `3px solid ${clr}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12.5, fontWeight: 600, color: C.ink,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        fontFamily: FONT,
                      }}>
                        {item.product_name}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 1, fontFamily: FONT }}>
                        {item.reference_code}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="num" style={{ fontSize: 20, fontWeight: 800, color: clr, lineHeight: 1, fontFamily: FONT }}>
                        {fmtNum(avail)}
                      </div>
                      <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2, fontFamily: FONT }}>{unit}</div>
                    </div>
                  </div>
                )
              })}
              {d.stockAlerts.length > 6 && (
                <div style={{
                  textAlign: 'center', fontSize: 12, color: C.muted,
                  padding: '8px 0 2px', fontFamily: FONT,
                }}>
                  + {d.stockAlerts.length - 6} autre{d.stockAlerts.length - 6 > 1 ? 's' : ''} produit{d.stockAlerts.length - 6 > 1 ? 's' : ''} en alerte — consultez le <a href="/products" style={{ color: C.blue, textDecoration: 'none' }}>catalogue</a>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Reject modal ── */}
      {rejectId && (
        <ModalOverlay>
          <div className="modal-panel" style={{
            background: C.surface, borderRadius: 14,
            width: '100%', maxWidth: 440,
            boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
            overflow: 'hidden',
          }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg,#DC2626,#EF4444)' }} />
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
                  className="btn-red"
                  onClick={handleReject}
                  disabled={!rejectMsg.trim() || loading === rejectId}
                  style={{
                    flex: 1, padding: '11px', background: C.red,
                    color: 'white', border: 'none', borderRadius: 8,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    fontFamily: FONT,
                  }}
                >
                  {loading === rejectId
                    ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><span className="spinner" style={{ width: 12, height: 12 }} />En cours…</span>
                    : 'Confirmer le rejet'}
                </button>
                <button
                  className="btn-ghost"
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

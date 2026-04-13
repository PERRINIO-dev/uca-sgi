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
import { C, F, R, SP, SH, TR, Z } from '@/lib/design-system'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtNum = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(n)

// ── KPI icons ─────────────────────────────────────────────────────────────────
function IconRevenue() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M10 2v2m0 12v2M6 6.5h5.5a2 2 0 010 4H8a2 2 0 000 4H14" stroke={C.bg} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}
function IconCount() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="4" width="14" height="13" rx="2" stroke={C.bg} strokeWidth="1.5"/>
      <path d="M7 9h6M7 12h4" stroke={C.bg} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M7 3v2M13 3v2" stroke={C.bg} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function IconBasket() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M4 6h12l-1.5 8H5.5L4 6Z" stroke={C.bg} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M7 6L9 3M13 6l-2-3" stroke={C.bg} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M8 10v3M12 10v3" stroke={C.bg} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}
function IconCreances() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.5" stroke={C.bg} strokeWidth="1.5"/>
      <path d="M10 6.5v4l2.5 2.5" stroke={C.bg} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconMargin() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M3 17l4-5 4 2 6-8" stroke={C.bg} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="16" cy="5" r="1.5" fill={C.bg}/>
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
      style={{
        background: C.surface, borderRadius: R.xl,
        border: `1px solid ${C.border}`, boxShadow: SH.sm,
        padding: `${SP[5]} ${SP[6]}`,
        ...style,
      }}
      {...(tourId ? { 'data-tour': tourId } : {})}
    >
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SP[2], marginBottom: SP[4], fontFamily: F.body }}>
      <div style={{ width: 3, height: 14, borderRadius: 2, background: C.amber, flexShrink: 0 }} />
      <span style={{ fontSize: F.xs, fontWeight: F.bold, color: C.dim, textTransform: 'uppercase', letterSpacing: F.lsWider }}>
        {children}
      </span>
    </div>
  )
}

function ModalOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: Z.modal, padding: SP[5],
      backdropFilter: 'blur(4px)',
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

  const { data } = useSWR('/api/dashboard', fetcher, {
    fallbackData: {
      currency, todayCount,
      mtdRevenue, mtdCreances, mtdAvgBasket, mtdTrend,
      mtdMargin, mtdMarginPct, allTimeCreances,
      activeOrdersCount, pendingRequests, stockAlerts,
      boutiqueStats, dailyChart, badgeCounts,
    },
    revalidateOnFocus: false,
    dedupingInterval:  60_000,
  })

  const d = data as any
  const fmt = (n: number) => fmtCurrency(Number(n), d.currency ?? currency)

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
      label:  'CA du mois',
      sub:    new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      value:  fmt(d.mtdRevenue),
      color:  C.amber,
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
      color:  C.blue,
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
      <div className="fade-in-up" style={{
        marginBottom: SP[7],
        display: 'flex', alignItems: 'flex-end',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: SP[3],
      }}>
        <div>
          <h1 style={{
            fontSize: F['2xl'], fontWeight: F.xbold, color: C.ink,
            margin: `0 0 ${SP[1]}`, letterSpacing: F.lsTighter,
            fontFamily: F.display,
          }}>
            Tableau de bord
          </h1>
          <p style={{ fontSize: F.sm, color: C.dim, margin: 0, fontFamily: F.body }}>
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
        {d.pendingRequests.length > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: SP[1.5],
            background: C.goldBg, color: C.gold,
            border: `1px solid ${C.goldBd}`,
            borderRadius: R.full, padding: `${SP[1]} ${SP[3]}`,
            fontSize: F.xs, fontWeight: F.bold, fontFamily: F.body,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.gold, flexShrink: 0 }} />
            {d.pendingRequests.length} approbation{d.pendingRequests.length > 1 ? 's' : ''} en attente
          </span>
        )}
      </div>

      {/* ── KPI cards ── */}
      <div data-tour="tour-kpis" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: SP[3], marginBottom: SP[6],
      }}>
        {kpis.map(({ label, sub, value, color, Icon, trend }) => (
          <div key={label} style={{
            background: C.surface, borderRadius: R.xl,
            border: `1px solid ${C.border}`,
            borderLeft: `4px solid ${color}`,
            boxShadow: SH.sm,
            padding: `${SP[4]} ${SP[5]} ${SP[5]}`,
            display: 'flex', flexDirection: 'column', gap: SP[3],
          }}>
            {/* Label + icon row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{
                fontSize: F.xs, fontWeight: F.bold, color: C.dim,
                textTransform: 'uppercase', letterSpacing: F.lsWider,
                fontFamily: F.body, lineHeight: F.lhNormal, paddingTop: 2,
              }}>
                {label}
              </div>
              <div style={{
                width: 36, height: 36, borderRadius: R.md,
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
              <div style={{
                fontSize: F['3xl'], fontWeight: F.xbold, color: C.ink,
                letterSpacing: F.lsTightest, lineHeight: F.lhNone,
                fontFamily: F.display,
              }}>
                {value}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: SP[2], marginTop: SP[2], flexWrap: 'wrap' }}>
                <span style={{ fontSize: F.sm, color: C.muted, fontFamily: F.body }}>{sub}</span>
                {trend !== null && trend !== undefined && (
                  <span style={{
                    fontSize: F.xs, fontWeight: F.bold,
                    padding: `${SP[0.5]} ${SP[2]}`,
                    borderRadius: R.full, fontFamily: F.body,
                    background: trend >= 0 ? C.greenBg : C.redBg,
                    color:      trend >= 0 ? C.green    : C.red,
                    border:    `1px solid ${trend >= 0 ? C.greenBd : C.redBd}`,
                    display: 'inline-flex', alignItems: 'center', gap: SP[1],
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
        gap: SP[4], marginBottom: SP[6],
      }}>
        <Panel tourId="tour-chart">
          <SectionTitle>Ventes des 30 derniers jours</SectionTitle>
          {d.dailyChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={d.dailyChart} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradAmber" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={C.amber} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={C.amber} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke={C.borderSub} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.dim, fontFamily: F.body }} axisLine={false} tickLine={false} dy={6} />
                <YAxis tick={{ fontSize: 10, fill: C.dim, fontFamily: F.body }} axisLine={false} tickLine={false} tickFormatter={v => (v / 1000) + 'k'} width={36} />
                <Tooltip
                  formatter={(v) => [fmt(Number(v)), 'CA']}
                  contentStyle={{
                    fontSize: 12, borderRadius: R.md,
                    background: C.surfaceEl,
                    border: `1px solid ${C.border}`,
                    boxShadow: SH.lg,
                    fontFamily: F.body, padding: `${SP[2]} ${SP[3]}`,
                    color: C.text,
                  }}
                  labelStyle={{ fontWeight: F.bold, color: C.ink, marginBottom: 4 }}
                  cursor={{ stroke: C.amber, strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area
                  type="monotone" dataKey="ca"
                  stroke={C.amber} strokeWidth={2.5}
                  fill="url(#gradAmber)"
                  dot={false}
                  activeDot={{ r: 5, fill: C.amber, strokeWidth: 2, stroke: C.surfaceEl }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{
              height: 200, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: C.dim,
              fontSize: F.sm, fontFamily: F.body,
            }}>
              Aucune vente sur la période
            </div>
          )}
        </Panel>

        <Panel>
          <SectionTitle>CA par boutique (mois en cours)</SectionTitle>
          {d.boutiqueStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={d.boutiqueStats} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke={C.borderSub} vertical={true} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: C.dim, fontFamily: F.body }} tickFormatter={v => (v / 1000) + 'k'} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: C.text, fontWeight: F.semibold, fontFamily: F.body }} axisLine={false} tickLine={false} width={85} />
                <Tooltip
                  formatter={(v) => [fmt(Number(v)), 'CA']}
                  contentStyle={{
                    fontSize: 12, borderRadius: R.md,
                    background: C.surfaceEl,
                    border: `1px solid ${C.border}`,
                    boxShadow: SH.lg,
                    fontFamily: F.body, padding: `${SP[2]} ${SP[3]}`,
                    color: C.text,
                  }}
                  cursor={{ fill: C.amberGlow }}
                />
                <Bar dataKey="ca" fill={C.amber} radius={[0, 8, 8, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{
              height: 200, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: C.dim,
              fontSize: F.sm, fontFamily: F.body,
            }}>
              Aucune vente ce mois
            </div>
          )}
        </Panel>
      </div>

      {/* ── Bottom panels ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: SP[4],
      }}>

        {/* Pending approvals */}
        <Panel>
          <SectionTitle>Approbations en attente</SectionTitle>
          {d.pendingRequests.length === 0 ? (
            <div style={{
              padding: `${SP[7]} 0`, textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SP[2],
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: C.greenBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconCheck />
              </div>
              <span style={{ color: C.dim, fontSize: F.sm, fontFamily: F.body }}>
                Aucune demande en attente
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: SP[2] }}>
              {d.pendingRequests.map((req: any) => (
                <div key={req.id} style={{
                  borderRadius: R.lg,
                  border: `1px solid ${C.border}`,
                  background: C.surfaceEl,
                  overflow: 'hidden',
                }}>
                  {/* Card header */}
                  <div style={{
                    padding: `${SP[3]} ${SP[3]}`,
                    background: C.surfaceSub,
                    borderBottom: `1px solid ${C.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP[2] }}>
                      <span style={{
                        fontSize: F.base, fontWeight: F.semibold, color: C.ink,
                        fontFamily: F.body, minWidth: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {req.products?.name ?? 'Produit inconnu'}
                      </span>
                      <span style={{
                        fontSize: F.xs, fontWeight: F.bold, flexShrink: 0,
                        color:      req.request_type === 'stock_in' ? C.blue   : C.orange,
                        background: req.request_type === 'stock_in' ? C.blueBg : C.orangeBg,
                        border:    `1px solid ${req.request_type === 'stock_in' ? C.blueBd : C.orangeBd}`,
                        padding: `${SP[0.5]} ${SP[2]}`, borderRadius: R.full,
                        fontFamily: F.body,
                      }}>
                        {req.request_type === 'stock_in' ? 'Entrée stock' : 'Correction'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: SP[1.5], marginTop: SP[1] }}>
                      <span style={{ fontSize: F.sm, color: C.muted, fontFamily: F.body }}>
                        {req.users?.full_name}
                      </span>
                      <span style={{ color: C.border }}>·</span>
                      <span style={{
                        fontSize: F.sm, fontWeight: F.bold, fontFamily: F.body,
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
                    <div style={{
                      padding: `${SP[2]} ${SP[3]}`,
                      borderBottom: `1px solid ${C.borderSub}`,
                      background: C.surfaceEl,
                    }}>
                      <span style={{ fontSize: F.xs, color: C.muted, fontFamily: F.body }}>
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
                        flex: 1, padding: `${SP[2]} ${SP[3]}`, background: 'transparent',
                        color: C.green, border: 'none', borderRight: `1px solid ${C.border}`,
                        fontSize: F.sm, fontWeight: F.bold, cursor: 'pointer',
                        fontFamily: F.body, transition: `background ${TR.fast}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SP[1.5],
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.greenBg)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {loading === req.id
                        ? <><span className="spinner" style={{ width: 12, height: 12, borderTopColor: C.green }} />En cours…</>
                        : <>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M1.5 6.5l3 3 6-6" stroke={C.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Approuver
                          </>
                      }
                    </button>
                    <button
                      onClick={() => setRejectId(req.id)}
                      disabled={loading === req.id}
                      style={{
                        flex: 1, padding: `${SP[2]} ${SP[3]}`, background: 'transparent',
                        color: C.red, border: 'none',
                        fontSize: F.sm, fontWeight: F.semibold, cursor: 'pointer',
                        fontFamily: F.body, transition: `background ${TR.fast}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SP[1.5],
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.redBg)}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP[4] }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: SP[2],
            }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: C.amber, flexShrink: 0 }} />
              <span style={{
                fontSize: F.xs, fontWeight: F.bold, color: C.dim,
                textTransform: 'uppercase', letterSpacing: F.lsWider, fontFamily: F.body,
              }}>
                Alertes stock critique
              </span>
            </div>
            {d.stockAlerts.length > 0 && (
              <span style={{
                fontSize: F.xs, fontWeight: F.semibold, color: C.orange,
                background: C.orangeBg, border: `1px solid ${C.orangeBd}`,
                borderRadius: R.full, padding: `${SP[0.5]} ${SP[2]}`, fontFamily: F.body,
              }}>
                {d.stockAlerts.length} produit{d.stockAlerts.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {d.stockAlerts.length === 0 ? (
            <div style={{
              padding: `${SP[7]} 0`, textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SP[2],
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: C.greenBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconCheck />
              </div>
              <span style={{ color: C.dim, fontSize: F.sm, fontFamily: F.body }}>
                Tous les stocks sont suffisants
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: SP[1.5] }}>
              {(d.stockAlerts.length > 6 ? d.stockAlerts.slice(0, 6) : d.stockAlerts).map((item: any) => {
                const isTile = (item.product_type ?? 'tile') === 'tile'
                const avail  = isTile ? Number(item.available_full_cartons) : Number(item.available_tiles)
                const isCrit = isTile ? avail < CRITICAL_STOCK_CARTONS : avail < CRITICAL_STOCK_UNITS
                const clr    = isCrit ? C.red    : C.orange
                const bd     = isCrit ? C.redBd  : C.orangeBd
                const unit   = isTile ? 'cartons' : 'unités'
                return (
                  <div key={item.product_id} style={{
                    display: 'flex', alignItems: 'center', gap: SP[3],
                    padding: `${SP[2]} ${SP[3]}`,
                    background: C.surfaceEl, borderRadius: R.md,
                    border: `1px solid ${bd}`,
                    borderLeft: `3px solid ${clr}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: F.sm, fontWeight: F.semibold, color: C.ink,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        fontFamily: F.body,
                      }}>
                        {item.product_name}
                      </div>
                      <div style={{ fontSize: F.xs, color: C.muted, marginTop: 1, fontFamily: F.mono }}>
                        {item.reference_code}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{
                        fontSize: F['2xl'], fontWeight: F.xbold, color: clr,
                        lineHeight: F.lhNone, fontFamily: F.display,
                        letterSpacing: F.lsTightest,
                      }}>
                        {fmtNum(avail)}
                      </div>
                      <div style={{ fontSize: F.xs, color: C.muted, marginTop: 2, fontFamily: F.body }}>
                        {unit}
                      </div>
                    </div>
                  </div>
                )
              })}
              {d.stockAlerts.length > 6 && (
                <div style={{
                  textAlign: 'center', fontSize: F.sm, color: C.dim,
                  padding: `${SP[2]} 0 ${SP[0.5]}`, fontFamily: F.body,
                }}>
                  + {d.stockAlerts.length - 6} autre{d.stockAlerts.length - 6 > 1 ? 's' : ''} produit{d.stockAlerts.length - 6 > 1 ? 's' : ''} en alerte — consultez le{' '}
                  <a href="/products" style={{ color: C.amber, textDecoration: 'none' }}>catalogue</a>
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
            background: C.surfaceEl,
            borderRadius: R.xl,
            border: `1px solid ${C.border}`,
            width: '100%', maxWidth: 440,
            boxShadow: SH.xl,
            overflow: 'hidden',
          }}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${C.red}, #EF4444)` }} />
            <div style={{
              padding: `${SP[4]} ${SP[5]}`,
              borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: SP[3],
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: R.md,
                background: C.redBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke={C.red} strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: F.md, fontWeight: F.bold, color: C.ink, fontFamily: F.body }}>
                  Rejeter la demande
                </div>
                <div style={{ fontSize: F.sm, color: C.muted, fontFamily: F.body }}>
                  Un motif est obligatoire
                </div>
              </div>
            </div>
            <div style={{ padding: `${SP[5]} ${SP[6]}` }}>
              <textarea
                value={rejectMsg}
                onChange={e => setRejectMsg(e.target.value)}
                rows={3}
                placeholder="Expliquez pourquoi cette demande est rejetée…"
                style={{
                  width: '100%', padding: `${SP[2]} ${SP[3]}`,
                  borderRadius: R.md,
                  border: `1.5px solid ${C.border}`,
                  fontSize: F.sm, color: C.text,
                  background: C.bg, outline: 'none',
                  resize: 'vertical', boxSizing: 'border-box',
                  fontFamily: F.body,
                }}
              />
              <div style={{ display: 'flex', gap: SP[2], marginTop: SP[3] }}>
                <button
                  className="btn-red"
                  onClick={handleReject}
                  disabled={!rejectMsg.trim() || loading === rejectId}
                  style={{
                    flex: 1, padding: SP[3],
                    borderRadius: R.md,
                    fontSize: F.sm, fontWeight: F.semibold,
                    cursor: 'pointer', fontFamily: F.body,
                  }}
                >
                  {loading === rejectId
                    ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SP[1.5] }}>
                        <span className="spinner" style={{ width: 12, height: 12 }} />
                        En cours…
                      </span>
                    : 'Confirmer le rejet'}
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => { setRejectId(null); setRejectMsg('') }}
                  style={{
                    padding: `${SP[3]} ${SP[4]}`,
                    borderRadius: R.md,
                    fontSize: F.sm, fontWeight: F.medium,
                    cursor: 'pointer', fontFamily: F.body,
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

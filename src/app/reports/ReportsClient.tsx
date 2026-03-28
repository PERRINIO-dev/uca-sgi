'use client'

import React, { useState, useMemo } from 'react'
import { useRouter }         from 'next/navigation'
import { createClient }      from '@/lib/supabase/client'
import PageLayout            from '@/components/PageLayout'
import type { BadgeCounts } from '@/lib/supabase/badge-counts'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

const C = {
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', surface: '#FFFFFF',
  navy: '#1B3A6B', navyDark: '#0C1A35', blue: '#2563EB', blueL: '#EFF6FF',
  green: '#059669', greenL: '#ECFDF5',
  orange: '#D97706', orangeL: '#FFFBEB',
  red: '#DC2626', redL: '#FEF2F2',
  gold: '#B45309', goldL: '#FFFBEB',
}
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif"

const fmtCFA = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
const fmtNum = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(n)
const fmtM2 = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n) + ' m²'

const STATUS_LABELS: Record<string, string> = {
  confirmed:  'Confirmée',
  preparing:  'En préparation',
  ready:      'Prête',
  delivered:  'Livrée',
  cancelled:  'Annulée',
  draft:      'Brouillon',
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  delivered:  { bg: C.greenL,  color: C.green },
  cancelled:  { bg: C.redL,    color: C.red },
  confirmed:  { bg: C.blueL,   color: C.blue },
  preparing:  { bg: C.orangeL, color: C.orange },
  ready:      { bg: C.greenL,  color: C.green },
}

type Tab = 'overview' | 'sales' | 'products' | 'vendors' | 'audit'

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8,
  border: `1.5px solid ${C.border}`, fontSize: 13,
  color: C.ink, outline: 'none',
  background: C.surface, fontFamily: FONT,
}

export default function ReportsClient({
  profile, sales, boutiques, vendors, auditLogs, badgeCounts,
}: {
  profile:      any
  sales:        any[]
  boutiques:    any[]
  vendors:      any[]
  auditLogs:    any[]
  badgeCounts?: BadgeCounts
}) {
  const router   = useRouter()
  const supabase = createClient()

  const [activeTab,      setTab]      = useState<Tab>('overview')
  const [filterBoutique, setBoutique] = useState('all')
  const [filterVendor,   setVendor]   = useState('all')
  const [filterStatus,   setStatus]   = useState('all')
  const [filterDays,     setDays]     = useState('0')
  const [search,         setSearch]   = useState('')
  const [expandedSale,   setExpanded] = useState<string | null>(null)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Apply filters ──────────────────────────────────────────────────────
  const cutoff = useMemo(() => {
    if (filterDays === '0') return null
    const d = new Date()
    d.setDate(d.getDate() - parseInt(filterDays))
    return d
  }, [filterDays])

  const filtered = useMemo(() => sales.filter(s => {
    if (cutoff && new Date(s.created_at) < cutoff)                     return false
    if (filterBoutique !== 'all' && s.boutiques?.id !== filterBoutique) return false
    if (filterVendor   !== 'all' && s.users?.id    !== filterVendor)    return false
    if (filterStatus   !== 'all' && s.status       !== filterStatus)    return false
    if (search) {
      const q = search.toLowerCase()
      if (!s.sale_number.toLowerCase().includes(q) &&
          !(s.customer_name ?? '').toLowerCase().includes(q)) return false
    }
    return true
  }), [sales, cutoff, filterBoutique, filterVendor, filterStatus, search])

  // ── KPIs ───────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const confirmed = filtered.filter(s => s.status !== 'cancelled')
    const totalCA   = confirmed.reduce((sum, s) => sum + s.total_amount, 0)
    const delivered = filtered.filter(s => s.status === 'delivered')
    const totalM2   = confirmed.reduce((sum, s) =>
      sum + s.sale_items.reduce((a: number, i: any) =>
        a + i.quantity_tiles * i.tile_area_m2_snapshot, 0
      ), 0
    )
    const avgBasket      = confirmed.length > 0 ? totalCA / confirmed.length : 0
    const cancelRate     = filtered.length > 0
      ? (filtered.filter(s => s.status === 'cancelled').length / filtered.length) * 100
      : 0
    const totalEncaisse  = confirmed.reduce((sum, s) => sum + (s.amount_paid ?? 0), 0)
    const totalEnAttente = totalCA - totalEncaisse
    return {
      totalCA, confirmed: confirmed.length,
      delivered: delivered.length,
      totalM2, avgBasket, cancelRate,
      totalEncaisse, totalEnAttente,
    }
  }, [filtered])

  // ── Daily chart data ───────────────────────────────────────────────────
  const dailyData = useMemo(() => {
    const map: Record<string, { date: string; ca: number; ventes: number }> = {}
    filtered
      .filter(s => s.status !== 'cancelled')
      .forEach(s => {
        const date = new Date(s.created_at).toLocaleDateString('fr-FR', {
          day: '2-digit', month: 'short',
        })
        if (!map[date]) map[date] = { date, ca: 0, ventes: 0 }
        map[date].ca     += s.total_amount
        map[date].ventes += 1
      })
    return Object.values(map)
  }, [filtered])

  // ── Boutique breakdown ─────────────────────────────────────────────────
  const boutiqueData = useMemo(() => {
    const map: Record<string, { name: string; ca: number; ventes: number }> = {}
    filtered
      .filter(s => s.status !== 'cancelled')
      .forEach(s => {
        const name = s.boutiques?.name ?? 'Inconnue'
        if (!map[name]) map[name] = { name, ca: 0, ventes: 0 }
        map[name].ca     += s.total_amount
        map[name].ventes += 1
      })
    return Object.values(map).sort((a, b) => b.ca - a.ca)
  }, [filtered])

  // ── Top products ───────────────────────────────────────────────────────
  const productData = useMemo(() => {
    const map: Record<string, {
      name: string; ref: string; category: string
      ca: number; m2: number; units: number; cost: number
    }> = {}
    filtered
      .filter(s => s.status !== 'cancelled')
      .forEach(s => s.sale_items.forEach((item: any) => {
        const id = item.products?.id ?? 'unknown'
        if (!map[id]) map[id] = {
          name:     item.products?.name ?? '—',
          ref:      item.products?.reference_code ?? '—',
          category: item.products?.category ?? '—',
          ca: 0, m2: 0, units: 0, cost: 0,
        }
        const itemM2        = item.quantity_tiles * item.tile_area_m2_snapshot
        const purchasePrice = parseFloat(item.purchase_price_snapshot ?? '0') || 0
        map[id].ca    += item.total_price
        map[id].m2    += itemM2
        map[id].units += item.quantity_tiles
        map[id].cost  += purchasePrice * itemM2
      }))
    return Object.values(map).sort((a, b) => b.ca - a.ca)
  }, [filtered])

  // ── Vendor performance ─────────────────────────────────────────────────
  const vendorData = useMemo(() => {
    const map: Record<string, {
      name: string; ca: number; ventes: number; avgBasket: number
    }> = {}
    filtered
      .filter(s => s.status !== 'cancelled')
      .forEach(s => {
        const name = s.users?.full_name ?? 'Inconnu'
        if (!map[name]) map[name] = { name, ca: 0, ventes: 0, avgBasket: 0 }
        map[name].ca     += s.total_amount
        map[name].ventes += 1
      })
    Object.values(map).forEach(v => {
      v.avgBasket = v.ventes > 0 ? v.ca / v.ventes : 0
    })
    return Object.values(map).sort((a, b) => b.ca - a.ca)
  }, [filtered])

  // ── CSV Export ─────────────────────────────────────────────────────────
  const exportCSV = () => {
    const paymentLabels: Record<string, string> = {
      paid: 'Payé', partial: 'Acompte versé', unpaid: 'Impayé',
    }
    const headers = [
      'N° Vente', 'Date', 'Statut', 'Client', 'Téléphone',
      'Boutique', 'Vendeur', 'Notes',
      'Produit', 'Référence', 'Catégorie',
      'Carreaux', 'Cartons', 'Surface (m²)',
      'Prix/m² (FCFA)', 'Sous-total (FCFA)', 'Total vente (FCFA)',
      'Encaissé (FCFA)', 'Statut paiement',
    ]
    const rows: (string | number)[][] = []
    for (const s of filtered) {
      const items: any[] = s.sale_items ?? []
      if (items.length === 0) {
        rows.push([
          s.sale_number,
          new Date(s.created_at).toLocaleDateString('fr-FR'),
          STATUS_LABELS[s.status] ?? s.status,
          s.customer_name ?? '',
          s.customer_phone ?? '',
          s.boutiques?.name ?? '',
          s.users?.full_name ?? '',
          s.notes ?? '',
          '', '', '', '', '', '', '', '',
          Math.round(s.total_amount),
          Math.round(s.amount_paid ?? 0),
          paymentLabels[s.payment_status] ?? s.payment_status ?? '',
        ])
      } else {
        for (const item of items) {
          const tileArea    = parseFloat(item.tile_area_m2_snapshot)
          const tpc         = parseInt(item.tiles_per_carton_snapshot)
          const m2          = item.quantity_tiles * tileArea
          const fullCartons = Math.floor(item.quantity_tiles / tpc)
          const loose       = item.quantity_tiles % tpc
          const cartonsStr  = loose > 0 ? `${fullCartons}+${loose}` : String(fullCartons)
          rows.push([
            s.sale_number,
            new Date(s.created_at).toLocaleDateString('fr-FR'),
            STATUS_LABELS[s.status] ?? s.status,
            s.customer_name ?? '',
            s.customer_phone ?? '',
            s.boutiques?.name ?? '',
            s.users?.full_name ?? '',
            s.notes ?? '',
            item.products?.name ?? '',
            item.products?.reference_code ?? '',
            item.products?.category ?? '',
            item.quantity_tiles,
            cartonsStr,
            m2.toFixed(2),
            Math.round(item.unit_price_per_m2),
            Math.round(item.total_price),
            Math.round(s.total_amount),
            Math.round(s.amount_paid ?? 0),
            paymentLabels[s.payment_status] ?? s.payment_status ?? '',
          ])
        }
      }
    }
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href     = url
    link.download = `uca-ventes-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // ── Table heading style ────────────────────────────────────────────────
  const TH: React.CSSProperties = {
    padding: '13px 14px', textAlign: 'left',
    fontSize: 11, fontWeight: 700, color: C.muted,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    fontFamily: FONT, background: C.bg,
  }
  const TD: React.CSSProperties = {
    padding: '12px 14px', fontFamily: FONT,
  }

  // ────────────────────────────────────────────────────────────────────────
  return (
    <PageLayout profile={profile} activeRoute="/reports" onLogout={handleLogout} badgeCounts={badgeCounts}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.ink,
            margin: '0 0 4px', letterSpacing: '-0.02em', fontFamily: FONT }}>
            Rapports
          </h1>
          <p style={{ fontSize: 13, color: C.slate, margin: 0, fontFamily: FONT }}>
            {filtered.length} vente{filtered.length !== 1 ? 's' : ''} sur les{' '}
            {filterDays} derniers jours
          </p>
        </div>
        <button
          className="btn-navy"
          onClick={exportCSV}
          style={{ padding: '10px 18px', background: C.navy,
            color: C.surface, border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: FONT, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v7.5M3.5 6l3 3 3-3M1.5 10v1.5h10V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Exporter CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24,
        flexWrap: 'wrap', background: C.surface, padding: '14px 16px',
        borderRadius: 12, border: `1px solid ${C.border}` }}>
        {([['0', 'Tout le temps'], ['30', '30 jours'],
          ['90', '90 jours'], ['365', '1 an'], ['730', '2 ans']] as [string, string][])
          .map(([val, label]) => (
            <button key={val} onClick={() => setDays(val)}
              style={{ padding: '7px 14px', borderRadius: 100,
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: filterDays === val ? C.navy : C.bg,
                color:      filterDays === val ? C.surface : C.slate,
                border: `1.5px solid ${filterDays === val ? C.navy : C.border}`,
                fontFamily: FONT }}>
              {label}
            </button>
          ))}
        <select value={filterBoutique} onChange={e => setBoutique(e.target.value)}
          style={inputStyle}>
          <option value="all">Toutes les boutiques</option>
          {boutiques.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select value={filterVendor} onChange={e => setVendor(e.target.value)}
          style={inputStyle}>
          <option value="all">Tous les vendeurs</option>
          {vendors.map(v => (
            <option key={v.id} value={v.id}>{v.full_name}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={e => setStatus(e.target.value)}
          style={inputStyle}>
          <option value="all">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="N° vente ou client…"
          style={{ ...inputStyle, minWidth: 180 }} />
      </div>

      {/* Tabs — pill segment */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any,
        marginBottom: 24, paddingBottom: 2 }}>
      <div style={{ display: 'flex', gap: 2,
        background: C.bg, padding: 4, borderRadius: 100,
        width: 'fit-content', minWidth: 'max-content' }}>
        {([
          ['overview', 'Vue globale'],
          ['sales',    'Ventes'],
          ['products', 'Produits'],
          ['vendors',  'Vendeurs'],
          ['audit',    'Audit'],
        ] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: '8px 18px', borderRadius: 100,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: activeTab === id ? C.navy : 'transparent',
              color:      activeTab === id ? C.surface : C.slate,
              border: 'none', fontFamily: FONT,
              transition: 'all 0.15s ease' }}>
            {label}
          </button>
        ))}
      </div>
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Hero KPI: CA total + barre d'encaissement ── */}
          {(() => {
            const encRate = kpis.totalCA > 0
              ? (kpis.totalEncaisse / kpis.totalCA) * 100 : 0
            return (
              <div style={{
                background: C.surface, borderRadius: 14,
                border: `1px solid ${C.border}`,
                borderLeft: `5px solid ${C.blue}`,
                padding: '22px 24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: 8, fontFamily: FONT }}>
                  Chiffre d'affaires — {filterDays} derniers jours
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, color: C.ink,
                  letterSpacing: '-0.03em', lineHeight: 1, fontFamily: FONT,
                  marginBottom: 14 }}>
                  {fmtCFA(kpis.totalCA)}
                </div>
                {/* Encaissement progress bar */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: C.slate, fontFamily: FONT }}>
                      Encaissé : <strong style={{ color: C.green }}>{fmtCFA(kpis.totalEncaisse)}</strong>
                    </span>
                    <span style={{ fontSize: 12, color: C.slate, fontFamily: FONT }}>
                      Créances : <strong style={{
                        color: kpis.totalEnAttente > 0 ? C.orange : C.muted
                      }}>{fmtCFA(kpis.totalEnAttente)}</strong>
                    </span>
                  </div>
                  <div style={{ height: 8, background: C.bg, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      width: `${Math.min(100, encRate)}%`,
                      background: encRate >= 100 ? C.green : encRate >= 70 ? C.blue : C.orange,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontFamily: FONT }}>
                    {encRate.toFixed(0)} % encaissé
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── Secondary KPIs ── */}
          <div style={{ display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {([
              ['Créances clients',
                fmtCFA(kpis.totalEnAttente),
                kpis.totalEnAttente > 0 ? C.orange : C.muted,
                kpis.totalEnAttente > 0 ? C.orange : C.muted,
                'Montant non encore réglé'],
              ['Commandes',
                String(kpis.confirmed),
                C.blue, C.blue,
                `dont ${kpis.delivered} livrée${kpis.delivered !== 1 ? 's' : ''}`],
              ['Panier moyen',
                fmtCFA(kpis.avgBasket),
                C.ink, C.slate,
                'Par transaction'],
              ['Taux annulation',
                kpis.cancelRate.toFixed(1) + ' %',
                kpis.cancelRate > 10 ? C.red : C.muted,
                kpis.cancelRate > 10 ? C.red : C.muted,
                kpis.cancelRate > 10 ? 'Taux élevé — à surveiller' : 'Dans les normes'],
            ] as [string, string, string, string, string][])
              .map(([label, value, color, accent, hint]) => (
                <div key={label} style={{
                  background: C.surface, borderRadius: 10,
                  border: `1px solid ${C.border}`, padding: '14px 16px',
                  borderLeft: `3px solid ${accent}`,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.muted,
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                    marginBottom: 6, fontFamily: FONT }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color,
                    letterSpacing: '-0.02em', fontFamily: FONT, marginBottom: 3 }}>
                    {value}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>
                    {hint}
                  </div>
                </div>
              ))}
          </div>

          {/* Daily CA chart */}
          <div style={{ background: C.surface, borderRadius: 12,
            border: `1px solid ${C.border}`, padding: '20px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: 16, fontFamily: FONT }}>
              Chiffre d'affaires journalier
            </div>
            {dailyData.length === 0 ? (
              <div style={{ height: 180, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: C.muted, fontSize: 13, fontFamily: FONT }}>
                Aucune donnée sur la période
              </div>
            ) : (
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
              <div style={{ minWidth: 320 }}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.blue} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.muted }} />
                  <YAxis tick={{ fontSize: 11, fill: C.muted }}
                    tickFormatter={v =>
                      new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(v)
                    } />
                  <Tooltip
                    formatter={(v) => [fmtCFA(Number(v)), 'CA']}
                    contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`,
                      fontFamily: FONT, fontSize: 12 }} />
                  <Area type="monotone" dataKey="ca"
                    stroke={C.blue} strokeWidth={2} fill="url(#caGrad)" />
                </AreaChart>
              </ResponsiveContainer>
              </div>
              </div>
            )}
          </div>

          {/* Boutique bar chart */}
          <div style={{ background: C.surface, borderRadius: 12,
            border: `1px solid ${C.border}`, padding: '20px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: 16, fontFamily: FONT }}>
              CA par boutique
            </div>
            {boutiqueData.length === 0 ? (
              <div style={{ height: 140, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: C.muted, fontSize: 13, fontFamily: FONT }}>
                Aucune donnée
              </div>
            ) : (
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
              <div style={{ minWidth: 320 }}>
              <ResponsiveContainer width="100%" height={Math.max(120, boutiqueData.length * 50)}>
                <BarChart data={boutiqueData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: C.muted }}
                    tickFormatter={v =>
                      new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(v)
                    } />
                  <YAxis type="category" dataKey="name" width={90}
                    tick={{ fontSize: 11, fill: C.muted }} />
                  <Tooltip
                    formatter={(v) => [fmtCFA(Number(v)), 'CA']}
                    contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`,
                      fontFamily: FONT, fontSize: 12 }} />
                  <Bar dataKey="ca" fill={C.navy} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SALES TAB ── */}
      {activeTab === 'sales' && (
        <div style={{ background: C.surface, borderRadius: 12,
          border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center',
              color: C.muted, fontSize: 14, fontFamily: FONT }}>
              Aucune vente sur la période sélectionnée.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                    {['N° Vente', 'Date', 'Client', 'Boutique',
                      'Vendeur', 'Montant', 'Statut', '']
                      .map(h => <th key={h} style={TH}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s: any) => {
                    const isOpen = expandedSale === s.id
                    const ss = STATUS_STYLE[s.status] ?? { bg: C.bg, color: C.muted }
                    return (
                      <React.Fragment key={s.id}>
                        <tr
                          onClick={() => setExpanded(isOpen ? null : s.id)}
                          style={{
                            borderBottom: isOpen ? 'none' : `1px solid ${C.border}`,
                            cursor: 'pointer',
                          }}>
                          <td style={{ ...TD, fontSize: 13, fontWeight: 700, color: C.ink }}>
                            {s.sale_number}
                          </td>
                          <td style={{ ...TD, fontSize: 12, color: C.muted }}>
                            <div>{new Date(s.created_at).toLocaleDateString('fr-FR', {
                              day: '2-digit', month: 'short',
                            })}</div>
                            <div style={{ fontSize: 11 }}>
                              {new Date(s.created_at).toLocaleTimeString('fr-FR', {
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </div>
                          </td>
                          <td style={{ ...TD, fontSize: 13, color: C.ink }}>
                            {s.customer_name ?? '—'}
                          </td>
                          <td style={{ ...TD, fontSize: 13, color: C.ink }}>
                            {s.boutiques?.name ?? '—'}
                          </td>
                          <td style={{ ...TD, fontSize: 13, color: C.ink }}>
                            {s.users?.full_name ?? '—'}
                          </td>
                          <td style={{ ...TD, fontSize: 13, fontWeight: 700, color: C.ink }}>
                            {fmtCFA(s.total_amount)}
                          </td>
                          <td style={TD}>
                            <span style={{ display: 'inline-flex', alignItems: 'center',
                              gap: 5, fontSize: 11, fontWeight: 600,
                              padding: '3px 10px', borderRadius: 100,
                              background: ss.bg, color: ss.color, fontFamily: FONT }}>
                              <span style={{ width: 5, height: 5, borderRadius: '50%',
                                background: ss.color, flexShrink: 0 }} />
                              {STATUS_LABELS[s.status] ?? s.status}
                            </span>
                          </td>
                          <td style={{ ...TD, color: C.muted, fontSize: 13,
                            textAlign: 'center' }}>
                            {isOpen
                              ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 8l4-4 4 4" stroke={C.blue} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              : <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            }
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={s.id + '-detail'}
                            style={{ borderBottom: `1px solid ${C.border}` }}>
                            <td colSpan={8} style={{ padding: '0 14px 14px' }}>
                              <ReportSaleDetail sale={s} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: C.navyDark }}>
                    <td colSpan={5} style={{ padding: '13px 14px',
                      fontSize: 12, fontWeight: 700,
                      color: 'rgba(255,255,255,0.55)', fontFamily: FONT }}>
                      Total ({filtered.filter(s => s.status !== 'cancelled').length} ventes)
                    </td>
                    <td style={{ padding: '13px 14px', fontSize: 15,
                      fontWeight: 900, color: C.surface, fontFamily: FONT }}>
                      {fmtCFA(kpis.totalCA)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── PRODUCTS TAB ── */}
      {activeTab === 'products' && (
        <div style={{ background: C.surface, borderRadius: 12,
          border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          {productData.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center',
              color: C.muted, fontSize: 14, fontFamily: FONT }}>
              Aucune donnée produit sur la période.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                    {[
                      'Rang', 'Produit', 'Référence', 'Catégorie',
                      'Surface vendue', 'Carreaux', 'CA généré',
                      ...(profile.role === 'owner' ? ['Marge brute', 'Marge %'] : []),
                    ].map(h => <th key={h} style={TH}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {productData.map((p, idx) => {
                    const margin    = p.ca - p.cost
                    const marginPct = p.ca > 0 ? (margin / p.ca) * 100 : 0
                    return (
                    <tr key={p.ref} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ ...TD, fontSize: 16, fontWeight: 900,
                        color: idx === 0 ? C.gold : idx === 1 ? C.muted : C.border }}>
                        #{idx + 1}
                      </td>
                      <td style={{ ...TD, fontSize: 13, fontWeight: 700, color: C.ink }}>
                        {p.name}
                      </td>
                      <td style={{ ...TD, fontSize: 11, color: C.muted }}>
                        {p.ref}
                      </td>
                      <td style={{ ...TD, fontSize: 12, color: C.muted }}>
                        {p.category}
                      </td>
                      <td style={{ ...TD, fontSize: 13, color: C.ink }}>
                        {fmtM2(p.m2)}
                      </td>
                      <td style={{ ...TD, fontSize: 13, color: C.ink }}>
                        {fmtNum(p.units)}
                      </td>
                      <td style={{ ...TD, fontSize: 13, fontWeight: 700, color: C.ink }}>
                        {fmtCFA(p.ca)}
                      </td>
                      {profile.role === 'owner' && (
                        <>
                          <td style={{ ...TD, fontSize: 13, fontWeight: 700,
                            color: margin >= 0 ? C.green : C.red }}>
                            {fmtCFA(margin)}
                          </td>
                          <td style={{ ...TD, fontSize: 12,
                            color: marginPct >= 0 ? C.green : C.red }}>
                            {p.cost > 0 ? marginPct.toFixed(1) + ' %' : '—'}
                          </td>
                        </>
                      )}
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── VENDORS TAB ── */}
      {activeTab === 'vendors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {vendorData.length === 0 ? (
            <div style={{ background: C.surface, borderRadius: 12,
              border: `1px solid ${C.border}`, padding: 48,
              textAlign: 'center', color: C.muted, fontSize: 14, fontFamily: FONT }}>
              Aucune donnée vendeur sur la période.
            </div>
          ) : vendorData.map((v, idx) => {
            const share = kpis.totalCA > 0 ? (v.ca / kpis.totalCA) * 100 : 0
            const accent = idx === 0 ? C.gold : idx === 1 ? C.muted : C.border
            return (
              <div key={v.name} style={{
                background: C.surface, borderRadius: 12,
                border: `1px solid ${C.border}`,
                padding: '18px 20px',
                borderLeft: `4px solid ${accent}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 20, fontWeight: 900, minWidth: 32,
                      color: accent, fontFamily: FONT }}>
                      #{idx + 1}
                    </span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700,
                        color: C.ink, fontFamily: FONT }}>
                        {v.name}
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, fontFamily: FONT }}>
                        {v.ventes} vente{v.ventes !== 1 ? 's' : ''} ·{' '}
                        panier moy. {fmtCFA(v.avgBasket)}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: C.ink,
                      letterSpacing: '-0.02em', fontFamily: FONT }}>
                      {fmtCFA(v.ca)}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, fontFamily: FONT }}>
                      {share.toFixed(1)} % du CA total
                    </div>
                  </div>
                </div>
                <div style={{ height: 6, background: C.bg,
                  borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: `${share}%`,
                    background: idx === 0 ? C.gold : C.navy,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── AUDIT TAB ── */}
      {activeTab === 'audit' && (
        <AuditLogTab logs={auditLogs} />
      )}
    </PageLayout>
  )
}

function ReportSaleDetail({ sale }: { sale: any }) {
  const FONT2 = "system-ui, -apple-system, 'Segoe UI', sans-serif"
  return (
    <div style={{ background: C.bg, borderRadius: 8,
      padding: '14px 16px', border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted,
        textTransform: 'uppercase', letterSpacing: '0.07em',
        marginBottom: 10, fontFamily: FONT2 }}>
        Détail de la vente
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse',
          marginBottom: 10 }}>
          <thead>
            <tr>
              {['Produit', 'Référence', 'Surface', 'Cartons',
                'Carreaux', 'Prix/m²', 'Sous-total'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: 10,
                  fontWeight: 700, color: C.muted,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  padding: '0 10px 8px 0', fontFamily: FONT2 }}>
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
                  <td style={{ padding: '7px 10px 7px 0', fontSize: 13,
                    fontWeight: 600, color: C.ink, fontFamily: FONT2 }}>
                    {item.products?.name ?? '—'}
                  </td>
                  <td style={{ padding: '7px 10px 7px 0', fontSize: 11,
                    color: C.muted, fontFamily: FONT2 }}>
                    {item.products?.reference_code ?? '—'}
                  </td>
                  <td style={{ padding: '7px 10px 7px 0', fontSize: 13,
                    color: C.ink, fontFamily: FONT2 }}>
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2, maximumFractionDigits: 2,
                    }).format(m2)} m²
                  </td>
                  <td style={{ padding: '7px 10px 7px 0', fontSize: 13,
                    color: C.ink, fontFamily: FONT2 }}>
                    {fullCartons}
                    {loose > 0 && (
                      <span style={{ color: C.orange, fontSize: 11 }}>
                        {' '}+ {loose}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '7px 10px 7px 0', fontSize: 13,
                    color: C.ink, fontFamily: FONT2 }}>
                    {new Intl.NumberFormat('fr-FR').format(item.quantity_tiles)}
                  </td>
                  <td style={{ padding: '7px 10px 7px 0', fontSize: 13,
                    color: C.muted, fontFamily: FONT2 }}>
                    {new Intl.NumberFormat('fr-FR').format(item.unit_price_per_m2)} FCFA
                  </td>
                  <td style={{ padding: '7px 0', fontSize: 13,
                    fontWeight: 700, color: C.ink, fontFamily: FONT2 }}>
                    {new Intl.NumberFormat('fr-FR').format(
                      Math.round(item.total_price)
                    )} FCFA
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', borderTop: `1px solid ${C.border}`,
        paddingTop: 10 }}>
        <div style={{ fontSize: 12, color: C.muted, fontFamily: FONT2 }}>
          {sale.customer_phone && <span>{sale.customer_phone}</span>}
          {sale.notes && (
            <span style={{ marginLeft: sale.customer_phone ? 16 : 0 }}>
              {sale.notes}
            </span>
          )}
          {!sale.customer_phone && !sale.notes && <span>Aucune note</span>}
        </div>
        <div style={{ fontSize: 15, fontWeight: 900, color: C.ink, fontFamily: FONT2 }}>
          Total : {new Intl.NumberFormat('fr-FR').format(
            Math.round(sale.total_amount)
          )} FCFA
        </div>
      </div>
    </div>
  )
}

// ── Audit Log Tab ─────────────────────────────────────────────────────────────
const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  SALE_CREATED:              { label: 'Vente créée',             color: C.green,  bg: C.greenL },
  SALE_CANCELLED:            { label: 'Vente annulée',           color: C.red,    bg: C.redL },
  ORDER_PREPARING:           { label: 'Préparation commencée',   color: C.orange, bg: C.orangeL },
  ORDER_READY:               { label: 'Commande prête',          color: C.green,  bg: C.greenL },
  ORDER_DELIVERED:           { label: 'Livraison confirmée',     color: C.navy,   bg: C.blueL },
  STOCK_REQUEST_SUBMITTED:   { label: 'Demande stock soumise',   color: C.gold,   bg: C.goldL },
  STOCK_REQUEST_APPROVED:    { label: 'Demande stock approuvée', color: C.green,  bg: C.greenL },
  STOCK_REQUEST_REJECTED:    { label: 'Demande stock rejetée',   color: C.red,    bg: C.redL },
  PRODUCT_CREATED:           { label: 'Produit créé',            color: C.blue,   bg: C.blueL },
  PRODUCT_UPDATED:           { label: 'Produit modifié',         color: C.blue,   bg: C.blueL },
  USER_CREATED:              { label: 'Utilisateur créé',        color: C.navy,   bg: C.blueL },
  USER_ACTIVATED:            { label: 'Utilisateur activé',      color: C.green,  bg: C.greenL },
  USER_DEACTIVATED:          { label: 'Utilisateur désactivé',   color: C.red,    bg: C.redL },
  USER_UPDATED:              { label: 'Utilisateur modifié',     color: C.slate,  bg: '#F1F5F9' },
  PASSWORD_RESET:            { label: 'Mot de passe réinitialisé', color: C.orange, bg: C.orangeL },
  BOUTIQUE_ACTIVATED:        { label: 'Boutique activée',        color: C.green,  bg: C.greenL },
  BOUTIQUE_DEACTIVATED:      { label: 'Boutique désactivée',     color: C.red,    bg: C.redL },
  FLOOR_PRICE_VIOLATION_ATTEMPT: { label: 'Tentative prix plancher', color: C.red, bg: C.redL },
  BOUTIQUE_CREATED:              { label: 'Boutique créée',          color: C.navy,   bg: C.blueL },
  PAYMENT_RECORDED:              { label: 'Paiement enregistré',     color: C.green,  bg: C.greenL },
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire', admin: 'Admin', vendor: 'Vendeur', warehouse: 'Entrepôt',
}

// ── Human-readable audit detail formatter ─────────────────────────────────
function formatAuditDetails(actionType: string, data: Record<string, unknown> | null): string {
  const fmtCFA = (n: unknown) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(Number(n))) + ' FCFA'
  const str = (v: unknown): string | null =>
    v != null && v !== '' && v !== 'null' ? String(v) : null

  switch (actionType) {
    case 'SALE_CREATED':
      if (!data) return '—'
      return [
        data.sale_number  ? `N° ${data.sale_number}`         : null,
        data.total_amount ? fmtCFA(data.total_amount)        : null,
        data.item_count   ? `${data.item_count} article(s)`  : null,
      ].filter(Boolean).join('  ·  ')

    case 'PAYMENT_RECORDED': {
      if (!data) return '—'
      const note = str(data.notes)
      return [
        data.amount ? fmtCFA(data.amount) : null,
        note        ? note                 : null,
      ].filter(Boolean).join(' — ')
    }

    case 'FLOOR_PRICE_VIOLATION_ATTEMPT':
      if (!data) return '—'
      return `Prix tenté : ${fmtCFA(data.attempted_price)}/m²  ·  Plancher : ${fmtCFA(data.floor_price)}/m²`

    case 'STOCK_REQUEST_REJECTED':
      return str(data?.comment) ?? '—'

    case 'PRODUCT_CREATED':
    case 'PRODUCT_UPDATED':
      if (!data) return '—'
      return [str(data.name), str(data.referenceCode)].filter(Boolean).join('  ·  ')

    case 'USER_CREATED': {
      if (!data) return '—'
      const role = ROLE_LABELS[String(data.role)] ?? str(data.role)
      return [str(data.email), role].filter(Boolean).join('  ·  ')
    }

    case 'USER_UPDATED': {
      if (!data) return '—'
      const role = ROLE_LABELS[String(data.role)] ?? str(data.role)
      return [str(data.full_name), role].filter(Boolean).join('  ·  ')
    }

    case 'BOUTIQUE_CREATED':
      if (!data) return '—'
      return [str(data.name), str(data.address)].filter(Boolean).join(' — ')

    default:
      return '—'
  }
}

function AuditLogTab({ logs }: { logs: any[] }) {
  const [search, setSearch]     = useState('')
  const [typeFilter, setType]   = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

  const uniqueTypes = useMemo(() => {
    const s = new Set(logs.map(l => l.action_type))
    return Array.from(s).sort()
  }, [logs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const from = dateFrom ? new Date(dateFrom) : null
    const to   = dateTo   ? new Date(dateTo + 'T23:59:59') : null
    return logs.filter(l => {
      if (typeFilter && l.action_type !== typeFilter) return false
      if (from && new Date(l.created_at) < from) return false
      if (to   && new Date(l.created_at) > to)   return false
      if (q) {
        const user = l.users?.full_name?.toLowerCase() ?? ''
        const action = (ACTION_CONFIG[l.action_type]?.label ?? l.action_type).toLowerCase()
        const extra = JSON.stringify(l.data_after ?? '').toLowerCase()
        if (!user.includes(q) && !action.includes(q) && !extra.includes(q)) return false
      }
      return true
    })
  }, [logs, search, typeFilter, dateFrom, dateTo])

  const inputS: React.CSSProperties = {
    height: 32, padding: '0 10px', border: `1px solid ${C.border}`,
    borderRadius: 6, fontSize: 12, fontFamily: FONT,
    color: C.ink, background: C.bg, outline: 'none',
  }

  return (
    <div>
      {/* Filter bar */}
      <div style={{
        background: C.surface, borderRadius: 10,
        border: `1px solid ${C.border}`,
        padding: '12px 14px', marginBottom: 14,
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
      }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher…"
          style={{ ...inputS, flex: '1 1 160px', paddingLeft: 10 }}
        />
        <select
          value={typeFilter}
          onChange={e => setType(e.target.value)}
          style={{ ...inputS, flex: '0 0 auto' }}
        >
          <option value="">Tous les types</option>
          {uniqueTypes.map(t => (
            <option key={t} value={t}>{ACTION_CONFIG[t]?.label ?? t}</option>
          ))}
        </select>
        <input
          type="date" value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          style={{ ...inputS, flex: '0 0 auto' }}
        />
        <span style={{ fontSize: 11, color: C.muted }}>→</span>
        <input
          type="date" value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          style={{ ...inputS, flex: '0 0 auto' }}
        />
        <span style={{ fontSize: 12, color: C.muted, fontFamily: FONT, marginLeft: 4 }}>
          {filtered.length} entrée{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Log table */}
      <div style={{
        background: C.surface, borderRadius: 12,
        border: `1px solid ${C.border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden',
      }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', fontSize: 14, color: C.muted, fontFamily: FONT }}>
            Aucune entrée trouvée.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: C.bg }}>
                <tr>
                  {['Date', 'Action', 'Utilisateur', 'Rôle', 'Détails'].map(h => (
                    <th key={h} style={{
                      padding: '11px 14px', textAlign: 'left',
                      fontSize: 11, fontWeight: 600, color: C.muted,
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                      borderBottom: `1.5px solid ${C.border}`,
                      whiteSpace: 'nowrap', fontFamily: FONT,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((log: any) => {
                  const cfg = ACTION_CONFIG[log.action_type] ?? { label: log.action_type, color: C.slate, bg: C.bg }
                  const ts = new Date(log.created_at)
                  return (
                    <tr key={log.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: C.slate, whiteSpace: 'nowrap', fontFamily: FONT, verticalAlign: 'middle' }}>
                        {ts.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        <br />
                        <span style={{ fontSize: 11, color: C.muted }}>
                          {ts.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', verticalAlign: 'middle' }}>
                        <span style={{
                          display: 'inline-block', fontSize: 11, fontWeight: 600,
                          padding: '3px 10px', borderRadius: 100,
                          background: cfg.bg, color: cfg.color, fontFamily: FONT,
                        }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: C.ink, fontWeight: 600, fontFamily: FONT, verticalAlign: 'middle' }}>
                        {log.users?.full_name ?? '—'}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: C.muted, fontFamily: FONT, verticalAlign: 'middle' }}>
                        {ROLE_LABELS[log.user_role_snapshot] ?? log.user_role_snapshot ?? '—'}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: C.slate, fontFamily: FONT, verticalAlign: 'middle', maxWidth: 260 }}>
                        {formatAuditDetails(log.action_type, log.data_after as Record<string, unknown> | null)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

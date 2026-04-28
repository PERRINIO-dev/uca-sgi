'use client'

import React, { useState, useMemo } from 'react'
import { useRouter }         from 'next/navigation'
import { createClient }      from '@/lib/supabase/client'
import PageLayout            from '@/components/PageLayout'
import type { BadgeCounts } from '@/lib/supabase/badge-counts'
import { fmtCurrency }       from '@/lib/format'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

import { C, F, R, SP, SH, TR, Z } from '@/lib/design-system'

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
}

const STATUS_STYLE: Record<string, { bg: string; color: string; bd: string }> = {
  delivered:  { bg: C.greenBg,  color: C.green,  bd: C.greenBd  },
  cancelled:  { bg: C.redBg,    color: C.red,    bd: C.redBd    },
  confirmed:  { bg: C.blueBg,   color: C.blue,   bd: C.blueBd   },
  preparing:  { bg: C.orangeBg, color: C.orange, bd: C.orangeBd },
  ready:      { bg: C.greenBg,  color: C.green,  bd: C.greenBd  },
}

type Tab = 'overview' | 'sales' | 'products' | 'rotation' | 'vendors' | 'devis' | 'audit'

const inputStyle: React.CSSProperties = {
  padding: `${SP[2]} ${SP[3]}`, borderRadius: R.md,
  border: `1.5px solid ${C.border}`, fontSize: F.sm,
  color: C.text, outline: 'none',
  background: C.bg, fontFamily: F.body,
}

export default function ReportsClient({
  profile, currency, companyName = 'meram', sales, boutiques, vendors, auditLogs, quotes, badgeCounts,
}: {
  profile:      any
  currency:     string
  companyName?: string
  sales:        any[]
  boutiques:    any[]
  vendors:      any[]
  auditLogs:    any[]
  quotes:       any[]
  badgeCounts?: BadgeCounts
}) {
  const router   = useRouter()
  const supabase = createClient()
  const fmt = (n: number) => fmtCurrency(n, currency)

  const [activeTab,      setTab]      = useState<Tab>('overview')
  const [filterBoutique, setBoutique] = useState('all')
  const [filterVendor,   setVendor]   = useState('all')
  const [filterStatus,   setStatus]   = useState('all')
  const [filterDays,     setDays]     = useState('90')
  const [dateFrom,       setDateFrom] = useState('')
  const [dateTo,         setDateTo]   = useState('')
  const [search,         setSearch]   = useState('')
  const [expandedSale,   setExpanded] = useState<string | null>(null)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Apply filters ──────────────────────────────────────────────────────
  const { cutoffStart, cutoffEnd } = useMemo(() => {
    if (dateFrom || dateTo) {
      return {
        cutoffStart: dateFrom ? new Date(dateFrom) : null,
        cutoffEnd:   dateTo   ? new Date(dateTo + 'T23:59:59') : null,
      }
    }
    if (filterDays === '0') return { cutoffStart: null, cutoffEnd: null }
    const d = new Date()
    d.setDate(d.getDate() - parseInt(filterDays))
    return { cutoffStart: d, cutoffEnd: null }
  }, [filterDays, dateFrom, dateTo])

  const filtered = useMemo(() => sales.filter(s => {
    if (cutoffStart && new Date(s.created_at) < cutoffStart)            return false
    if (cutoffEnd   && new Date(s.created_at) > cutoffEnd)              return false
    if (filterBoutique !== 'all' && s.boutiques?.id !== filterBoutique) return false
    if (filterVendor   !== 'all' && s.users?.id    !== filterVendor)    return false
    if (filterStatus   !== 'all' && s.status       !== filterStatus)    return false
    if (search) {
      const q = search.toLowerCase()
      if (!s.sale_number.toLowerCase().includes(q) &&
          !(s.customer_name ?? '').toLowerCase().includes(q)) return false
    }
    return true
  }), [sales, cutoffStart, cutoffEnd, filterBoutique, filterVendor, filterStatus, search])

  const filteredQuotes = useMemo(() => quotes.filter((q: any) => {
    if (cutoffStart && new Date(q.created_at) < cutoffStart)            return false
    if (cutoffEnd   && new Date(q.created_at) > cutoffEnd)              return false
    if (filterBoutique !== 'all' && q.boutiques?.id !== filterBoutique) return false
    if (filterVendor   !== 'all' && q.users?.id    !== filterVendor)    return false
    return true
  }), [quotes, cutoffStart, cutoffEnd, filterBoutique, filterVendor])

  // ── KPIs ───────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const confirmed = filtered.filter(s => s.status !== 'cancelled' && s.status !== 'draft')
    const totalCA   = confirmed.reduce((sum, s) => sum + s.total_amount, 0)
    const delivered = filtered.filter(s => s.status === 'delivered')
    const totalM2   = confirmed.reduce((sum, s) =>
      sum + s.sale_items.reduce((a: number, i: any) =>
        i.products?.product_type === 'tile' && i.tile_area_m2_snapshot
          ? a + i.quantity_tiles * parseFloat(i.tile_area_m2_snapshot)
          : a
      , 0), 0
    )
    const avgBasket      = confirmed.length > 0 ? totalCA / confirmed.length : 0
    const cancelRate     = filtered.length > 0
      ? (filtered.filter(s => s.status === 'cancelled').length / filtered.length) * 100
      : 0
    const totalEncaisse  = confirmed.reduce((sum, s) => sum + (s.amount_paid ?? 0), 0)
    const totalEnAttente = totalCA - totalEncaisse
    const totalCost = confirmed.reduce((sum, s) =>
      sum + s.sale_items.reduce((a: number, i: any) => {
        const isTile        = i.products?.product_type === 'tile'
        const purchasePrice = parseFloat(i.purchase_price_snapshot ?? '0') || 0
        const m2            = isTile ? i.quantity_tiles * parseFloat(i.tile_area_m2_snapshot ?? '0') : 0
        return a + (isTile ? purchasePrice * m2 : purchasePrice * i.quantity_tiles)
      }, 0)
    , 0)
    const totalMargin = totalCA - totalCost
    const marginPct   = totalCA > 0 ? (totalMargin / totalCA) * 100 : 0
    return {
      totalCA, confirmed: confirmed.length,
      delivered: delivered.length,
      totalM2, avgBasket, cancelRate,
      totalEncaisse, totalEnAttente,
      totalMargin, marginPct,
    }
  }, [filtered])

  // ── Daily chart data ───────────────────────────────────────────────────
  const dailyData = useMemo(() => {
    const map: Record<string, { date: string; ca: number; ventes: number; _iso: string }> = {}
    filtered
      .filter(s => s.status !== 'cancelled')
      .forEach(s => {
        const iso = (s.created_at as string).slice(0, 10)
        if (!map[iso]) map[iso] = {
          _iso: iso,
          date: new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
          ca: 0, ventes: 0,
        }
        map[iso].ca     += s.total_amount
        map[iso].ventes += 1
      })
    return Object.values(map).sort((a, b) => a._iso.localeCompare(b._iso))
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
      isTile: boolean; unitLabel: string
    }> = {}
    filtered
      .filter(s => s.status !== 'cancelled')
      .forEach(s => s.sale_items.forEach((item: any) => {
        const id     = item.products?.id ?? 'unknown'
        const isTile = item.products?.product_type === 'tile'
        if (!map[id]) map[id] = {
          name:      item.products?.name ?? '—',
          ref:       item.products?.reference_code ?? '—',
          category:  item.products?.category ?? '—',
          ca: 0, m2: 0, units: 0, cost: 0,
          isTile,
          unitLabel: item.products?.unit_label ?? 'unités',
        }
        const itemM2        = isTile ? item.quantity_tiles * parseFloat(item.tile_area_m2_snapshot) : 0
        const purchasePrice = parseFloat(item.purchase_price_snapshot ?? '0') || 0
        map[id].ca    += item.total_price
        map[id].m2    += itemM2
        map[id].units += item.quantity_tiles
        map[id].cost  += isTile ? purchasePrice * itemM2 : purchasePrice * item.quantity_tiles
      }))
    return Object.values(map).sort((a, b) => b.ca - a.ca)
  }, [filtered])

  // ── Vendor performance — with margin, créances, cancellations ─────────────
  const vendorData = useMemo(() => {
    const map: Record<string, {
      id: string; name: string
      ca: number; ventes: number; avgBasket: number
      cost: number; creances: number; cancelCount: number
    }> = {}
    filtered.forEach(s => {
      const id   = s.users?.id   ?? 'unknown'
      const name = s.users?.full_name ?? 'Inconnu'
      if (!map[id]) map[id] = { id, name, ca: 0, ventes: 0, avgBasket: 0, cost: 0, creances: 0, cancelCount: 0 }
      if (s.status === 'cancelled') { map[id].cancelCount++; return }
      map[id].ca     += Number(s.total_amount)
      map[id].ventes += 1
      const balance   = Number(s.total_amount) - Number(s.amount_paid ?? 0)
      if (balance > 0) map[id].creances += balance
      map[id].cost += (s.sale_items ?? []).reduce((a: number, i: any) => {
        const isTile = i.products?.product_type === 'tile'
        const pp     = parseFloat(i.purchase_price_snapshot ?? '0') || 0
        const m2     = isTile ? i.quantity_tiles * parseFloat(i.tile_area_m2_snapshot ?? '0') : 0
        return a + (isTile ? pp * m2 : pp * i.quantity_tiles)
      }, 0)
    })
    return Object.values(map).map(v => ({
      ...v,
      avgBasket:  v.ventes > 0 ? v.ca / v.ventes : 0,
      margin:     v.ca - v.cost,
      marginPct:  v.ca > 0 ? ((v.ca - v.cost) / v.ca) * 100 : 0,
    })).sort((a, b) => b.ca - a.ca)
  }, [filtered])

  // ── Rotation analysis — product velocity + dormant detection ─────────────
  const rotationData = useMemo(() => {
    const windowDays = filterDays === '0' ? 90 : (parseInt(filterDays) || 90)
    const map: Record<string, {
      id: string; name: string; ref: string; category: string
      unitLabel: string; isTile: boolean
      unitsSold: number; lastSaleDate: string | null
    }> = {}
    filtered
      .filter(s => s.status !== 'cancelled')
      .forEach(s => {
        ;(s.sale_items ?? []).forEach((i: any) => {
          const pid = i.products?.id ?? 'unknown'
          if (!map[pid]) map[pid] = {
            id: pid,
            name:      i.products?.name          ?? '—',
            ref:       i.products?.reference_code ?? '—',
            category:  i.products?.category       ?? '—',
            unitLabel: i.products?.unit_label      ?? 'unité',
            isTile:    i.products?.product_type === 'tile',
            unitsSold: 0, lastSaleDate: null,
          }
          map[pid].unitsSold += Number(i.quantity_tiles)
          if (!map[pid].lastSaleDate || s.created_at > map[pid].lastSaleDate!)
            map[pid].lastSaleDate = s.created_at
        })
      })
    return Object.values(map).map(p => ({
      ...p,
      velocityPerDay: windowDays > 0 ? p.unitsSold / windowDays : 0,
      daysSinceLastSale: p.lastSaleDate
        ? Math.floor((Date.now() - new Date(p.lastSaleDate).getTime()) / 86_400_000)
        : null,
    })).sort((a, b) => {
      if (!a.lastSaleDate && !b.lastSaleDate) return 0
      if (!a.lastSaleDate) return -1
      if (!b.lastSaleDate) return 1
      return a.lastSaleDate.localeCompare(b.lastSaleDate)
    })
  }, [filtered, filterDays])

  // ── Fraud signals — floor violations, cancel rates, high créances ─────────
  const fraudSignals = useMemo(() => {
    const signals: { type: string; severity: 'high' | 'medium'; desc: string }[] = []

    // 1. Floor price violation attempts (from audit log)
    const violations = auditLogs.filter((l: any) => l.action_type === 'FLOOR_PRICE_VIOLATION_ATTEMPT')
    if (violations.length > 0) {
      const byVendor: Record<string, number> = {}
      violations.forEach((v: any) => {
        const n = v.users?.full_name ?? 'Inconnu'
        byVendor[n] = (byVendor[n] ?? 0) + 1
      })
      Object.entries(byVendor).forEach(([name, count]) =>
        signals.push({ type: 'floor_price', severity: count >= 3 ? 'high' : 'medium',
          desc: `${name} — ${count} tentative${count > 1 ? 's' : ''} de vente sous-plancher` })
      )
    }

    // 2. High cancellation rate per vendor (threshold: ≥ 5 sales, ≥ 25% cancelled)
    const vendorTotals: Record<string, { name: string; total: number; cancelled: number }> = {}
    sales.forEach((s: any) => {
      const id   = s.users?.id ?? 'unknown'
      const name = s.users?.full_name ?? 'Inconnu'
      if (!vendorTotals[id]) vendorTotals[id] = { name, total: 0, cancelled: 0 }
      vendorTotals[id].total++
      if (s.status === 'cancelled') vendorTotals[id].cancelled++
    })
    Object.values(vendorTotals).forEach(v => {
      if (v.total < 5) return
      const rate = v.cancelled / v.total
      if (rate >= 0.25)
        signals.push({ type: 'cancel_rate', severity: rate >= 0.4 ? 'high' : 'medium',
          desc: `${v.name} — ${Math.round(rate * 100)} % d'annulations (${v.cancelled} / ${v.total} ventes)` })
    })

    // 3. Vendor with disproportionate outstanding créances (> 40% of their CA unpaid)
    vendorData.forEach(v => {
      if (v.ca < 10_000) return
      const rate = v.creances / v.ca
      if (rate >= 0.4)
        signals.push({ type: 'creances', severity: rate >= 0.6 ? 'high' : 'medium',
          desc: `${v.name} — ${Math.round(rate * 100)} % du CA en créances non encaissées` })
    })

    return signals
  }, [auditLogs, sales, vendorData])

  // ── CSV Export ─────────────────────────────────────────────────────────
  const exportCSV = () => {
    const paymentLabels: Record<string, string> = {
      paid: 'Payé', partial: 'Acompte versé', unpaid: 'Impayé',
    }
    const headers = [
      'N° Vente', 'Date', 'Statut', 'Client', 'Téléphone',
      'Boutique', 'Vendeur', 'Notes',
      'Produit', 'Référence', 'Catégorie',
      'Quantité', 'Cartons', 'Surface (m²)',
      `Prix unitaire (${currency})`, `Sous-total (${currency})`, `Total vente (${currency})`,
      `Encaissé (${currency})`, 'Statut paiement',
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
          const isTile = !!item.tile_area_m2_snapshot && !!item.tiles_per_carton_snapshot
          let cartons: string, surface: string
          if (isTile) {
            const tpc         = parseInt(item.tiles_per_carton_snapshot)
            const m2          = item.quantity_tiles * parseFloat(item.tile_area_m2_snapshot)
            const fullCartons = Math.floor(item.quantity_tiles / tpc)
            const loose       = item.quantity_tiles % tpc
            cartons = loose > 0 ? `${fullCartons}+${loose}` : String(fullCartons)
            surface = m2.toFixed(2)
          } else {
            cartons = '—'
            surface = '—'
          }
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
            cartons,
            surface,
            Math.round(item.unit_price_per_m2),
            Math.round(item.total_price),
            Math.round(s.total_amount),
            Math.round(s.amount_paid ?? 0),
            paymentLabels[s.payment_status] ?? s.payment_status ?? '',
          ])
        }
      }
    }
    const escCsv = (v: string | number) =>
      `"${String(v).replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`
    const csv = [headers, ...rows]
      .map(r => r.map(escCsv).join(','))
      .join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href     = url
    const slug = companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    link.download = `${slug}-ventes-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // ── Table heading style ────────────────────────────────────────────────
  const TH: React.CSSProperties = {
    padding: '13px 14px', textAlign: 'left',
    fontSize: 12, fontWeight: 700, color: C.muted,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    fontFamily: F.body, background: C.bg,
  }
  const TD: React.CSSProperties = {
    padding: '12px 14px', fontFamily: F.body,
  }

  // ────────────────────────────────────────────────────────────────────────
  return (
    <PageLayout profile={profile} activeRoute="/reports" onLogout={handleLogout} badgeCounts={badgeCounts}>

      {/* Header */}
      <div className="fade-in-up page-header">
        <div>
          <p className="page-kicker">Analyse &amp; performance</p>
          <h1 className="page-title">Rapports</h1>
          <p className="page-subtitle">
            {filtered.length} vente{filtered.length !== 1 ? 's' : ''}{' '}
            {dateFrom || dateTo
              ? '— période personnalisée'
              : filterDays === '0'
                ? '— toute la période'
                : `sur les ${filterDays} derniers jours`}
          </p>
        </div>
        <button
          className="btn-amber"
          onClick={exportCSV}
          style={{ height: 40, padding: `0 ${SP[4]}`, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v7.5M3.5 6l3 3 3-3M1.5 10v1.5h10V10" stroke="#FAF5EE" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
          .map(([val, label]) => {
            const isActive = filterDays === val && !dateFrom && !dateTo
            return (
              <button key={val} onClick={() => { setDays(val); setDateFrom(''); setDateTo('') }}
                style={{ padding: '7px 14px', borderRadius: 100,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: isActive ? C.amber : C.bg,
                  color:      isActive ? '#FAF5EE' : C.muted,
                  border: `1.5px solid ${isActive ? C.amber : C.border}`,
                  fontFamily: F.body }}>
                {label}
              </button>
            )
          })}
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
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ ...inputStyle, width: 148 }} />
        <span style={{ fontSize: 11, color: C.muted, alignSelf: 'center' }}>→</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ ...inputStyle, width: 148 }} />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo('') }}
            style={{ padding: '7px 12px', borderRadius: 100, fontSize: 11,
              fontWeight: 700, cursor: 'pointer', fontFamily: F.body,
              background: C.redBg, color: C.red, border: `1.5px solid ${C.redBd}` }}>
            Effacer
          </button>
        )}
      </div>

      {/* Tabs — pill segment */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any,
        marginBottom: 24, paddingBottom: 2 }}>
      <div style={{ display: 'flex', gap: 2,
        background: C.bg, padding: 4, borderRadius: 100,
        width: 'fit-content', minWidth: 'max-content' }}>
        {([
          ['overview',  'Vue globale'],
          ['sales',     'Ventes'],
          ['products',  'Produits'],
          ['rotation',  'Rotation'],
          ['vendors',   'Vendeurs'],
          ['devis',     'Pipeline devis'],
          ['audit',     'Audit'],
        ] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: '8px 18px', borderRadius: 100,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: activeTab === id ? C.amber : 'transparent',
              color:      activeTab === id ? '#FAF5EE' : C.muted,
              border: 'none', fontFamily: F.body,
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
                borderLeft: `5px solid ${C.amber}`,
                padding: '22px 24px',
                boxShadow: '0 1px 3px rgba(60,30,10,0.05)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.muted,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: 8, fontFamily: F.body }}>
                  Chiffre d'affaires — {filterDays} derniers jours
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, color: C.ink,
                  letterSpacing: '-0.04em', lineHeight: 1, fontFamily: F.display,
                  marginBottom: 14 }}>
                  {fmt(kpis.totalCA)}
                </div>
                {/* Encaissement progress bar */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: C.muted, fontFamily: F.body }}>
                      Encaissé : <strong style={{ color: C.green }}>{fmt(kpis.totalEncaisse)}</strong>
                    </span>
                    <span style={{ fontSize: 12, color: C.muted, fontFamily: F.body }}>
                      Créances : <strong style={{
                        color: kpis.totalEnAttente > 0 ? C.orange : C.muted
                      }}>{fmt(kpis.totalEnAttente)}</strong>
                    </span>
                  </div>
                  <div style={{ height: 8, background: C.bg, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      width: `${Math.min(100, encRate)}%`,
                      background: encRate >= 100 ? C.green : encRate >= 70 ? C.amber : C.orange,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontFamily: F.body }}>
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
                fmt(kpis.totalEnAttente),
                kpis.totalEnAttente > 0 ? C.orange : C.muted,
                kpis.totalEnAttente > 0 ? C.orange : C.muted,
                'Montant non encore réglé'],
              ['Commandes',
                String(kpis.confirmed),
                C.amber, C.amber,
                `dont ${kpis.delivered} livrée${kpis.delivered !== 1 ? 's' : ''}`],
              ['Panier moyen',
                fmt(kpis.avgBasket),
                C.ink, C.muted,
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
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.muted,
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                    marginBottom: 6, fontFamily: F.body }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color,
                    letterSpacing: '-0.02em', fontFamily: F.body, marginBottom: 3 }}>
                    {value}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>
                    {hint}
                  </div>
                </div>
              ))}
          </div>

          {/* Margin KPI — owner only */}
          {profile.role === 'owner' && kpis.totalCA > 0 && (
            <div style={{
              background: C.surface, borderRadius: 10,
              border: `1px solid ${C.border}`, padding: '18px 20px',
              borderLeft: `3px solid ${kpis.totalMargin >= 0 ? C.green : C.red}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    marginBottom: 4, fontFamily: F.body }}>
                    Marge brute (ventes confirmées)
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900,
                    color: kpis.totalMargin >= 0 ? C.green : C.red,
                    letterSpacing: '-0.03em', fontFamily: F.body }}>
                    {fmt(kpis.totalMargin)}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 3, fontFamily: F.body }}>
                    Sur un CA de {fmt(kpis.totalCA)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em',
                    fontFamily: F.body,
                    color: kpis.marginPct >= 30 ? C.green : kpis.marginPct >= 15 ? C.amber : C.red }}>
                    {kpis.marginPct.toFixed(1)} %
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>
                    taux de marge
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Daily CA chart */}
          <div style={{ background: C.surface, borderRadius: 12,
            border: `1px solid ${C.border}`, padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: 16, fontFamily: F.body }}>
              Chiffre d'affaires journalier
            </div>
            {dailyData.length === 0 ? (
              <div style={{ height: 180, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: C.muted, fontSize: 13, fontFamily: F.body }}>
                Aucune donnée sur la période
              </div>
            ) : (
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
              <div style={{ minWidth: 320 }}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.amber} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={C.amber} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.muted }} />
                  <YAxis tick={{ fontSize: 11, fill: C.muted }}
                    tickFormatter={v =>
                      new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(v)
                    } />
                  <Tooltip
                    formatter={(v) => [fmt(Number(v)), 'CA']}
                    contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`,
                      fontFamily: F.body, fontSize: 12 }} />
                  <Area type="monotone" dataKey="ca"
                    stroke={C.amber} strokeWidth={2} fill="url(#caGrad)" />
                </AreaChart>
              </ResponsiveContainer>
              </div>
              </div>
            )}
          </div>

          {/* Boutique bar chart */}
          <div style={{ background: C.surface, borderRadius: 12,
            border: `1px solid ${C.border}`, padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: 16, fontFamily: F.body }}>
              CA par boutique
            </div>
            {boutiqueData.length === 0 ? (
              <div style={{ height: 140, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: C.muted, fontSize: 13, fontFamily: F.body }}>
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
                    formatter={(v) => [fmt(Number(v)), 'CA']}
                    contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`,
                      fontFamily: F.body, fontSize: 12 }} />
                  <Bar dataKey="ca" fill={C.amber} radius={[0, 4, 4, 0]} />
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
              color: C.muted, fontSize: 14, fontFamily: F.body }}>
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
                            {fmt(s.total_amount)}
                          </td>
                          <td style={TD}>
                            <span style={{ display: 'inline-flex', alignItems: 'center',
                              gap: 5, fontSize: 11, fontWeight: 600,
                              padding: '3px 10px', borderRadius: 100,
                              background: ss.bg, color: ss.color, fontFamily: F.body }}>
                              <span style={{ width: 5, height: 5, borderRadius: '50%',
                                background: ss.color, flexShrink: 0 }} />
                              {STATUS_LABELS[s.status] ?? s.status}
                            </span>
                          </td>
                          <td style={{ ...TD, color: C.muted, fontSize: 13,
                            textAlign: 'center' }}>
                            {isOpen
                              ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 8l4-4 4 4" stroke={C.amber} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              : <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            }
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={s.id + '-detail'}
                            style={{ borderBottom: `1px solid ${C.border}` }}>
                            <td colSpan={8} style={{ padding: '0 14px 14px' }}>
                              <ReportSaleDetail sale={s} currency={currency} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: C.amberDim }}>
                    <td colSpan={5} style={{ padding: '13px 14px',
                      fontSize: 12, fontWeight: 700,
                      color: 'rgba(255,255,255,0.55)', fontFamily: F.body }}>
                      Total ({filtered.filter(s => s.status !== 'cancelled').length} ventes)
                    </td>
                    <td style={{ padding: '13px 14px', fontSize: 15,
                      fontWeight: 900, color: C.surface, fontFamily: F.body }}>
                      {fmt(kpis.totalCA)}
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
              color: C.muted, fontSize: 14, fontFamily: F.body }}>
              Aucune donnée produit sur la période.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                    {[
                      'Rang', 'Produit', 'Référence', 'Catégorie',
                      'Surface vendue', 'Quantité', 'CA généré',
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
                        {p.isTile && p.m2 > 0 ? fmtM2(p.m2) : '—'}
                      </td>
                      <td style={{ ...TD, fontSize: 13, color: C.ink }}>
                        {fmtNum(p.units)}{!p.isTile && ` ${p.unitLabel}`}
                      </td>
                      <td style={{ ...TD, fontSize: 13, fontWeight: 700, color: C.ink }}>
                        {fmt(p.ca)}
                      </td>
                      {profile.role === 'owner' && (
                        <>
                          <td style={{ ...TD, fontSize: 13, fontWeight: 700,
                            color: margin >= 0 ? C.green : C.red }}>
                            {fmt(margin)}
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

      {/* ── ROTATION TAB ── */}
      {activeTab === 'rotation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SP[2] }}>
          <div style={{ fontSize: F.sm, color: C.muted, fontFamily: F.body, marginBottom: SP[1] }}>
            Produits triés du plus dormant au plus actif sur la période sélectionnée.
          </div>
          {rotationData.length === 0 ? (
            <div style={{ background: C.surface, borderRadius: R.lg, border: `1px solid ${C.border}`, padding: SP[12], textAlign: 'center', color: C.muted, fontSize: F.base, fontFamily: F.body }}>
              Aucune donnée sur la période.
            </div>
          ) : (
            <div style={{ background: C.surface, borderRadius: R.lg, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: F.sm, fontFamily: F.body }}>
                <thead>
                  <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                    {['Produit', 'Réf.', 'Catégorie', 'Dernière vente', 'Vendus', 'Vélocité /j', 'Statut'].map(h => (
                      <th key={h} style={{ padding: `${SP[2]} ${SP[3]}`, textAlign: 'left', fontSize: F.xs, fontWeight: F.bold, color: C.dim, textTransform: 'uppercase', letterSpacing: F.lsWider, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rotationData.map((p, i) => {
                    const days = p.daysSinceLastSale
                    const isDead = days === null || days > 60
                    const isSlow = days !== null && days > 30 && days <= 60
                    const statusColor = isDead ? C.red : isSlow ? C.orange : C.green
                    const statusBg    = isDead ? C.redBg : isSlow ? C.orangeBg : C.greenBg
                    const statusBd    = isDead ? C.redBd : isSlow ? C.orangeBd : C.greenBd
                    const statusLabel = isDead ? (days === null ? 'Aucune vente' : 'Dormant') : isSlow ? 'Ralenti' : 'Actif'
                    return (
                      <tr key={p.id} style={{ borderBottom: i < rotationData.length - 1 ? `1px solid ${C.borderSub}` : 'none', background: i % 2 === 0 ? C.surfaceEl : C.surface }}>
                        <td style={{ padding: `${SP[2]} ${SP[3]}`, fontWeight: F.semibold, color: C.ink, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                        <td style={{ padding: `${SP[2]} ${SP[3]}`, color: C.muted, fontFamily: F.mono, fontSize: F.xs }}>{p.ref}</td>
                        <td style={{ padding: `${SP[2]} ${SP[3]}`, color: C.muted }}>{p.category}</td>
                        <td style={{ padding: `${SP[2]} ${SP[3]}`, color: isDead ? C.red : C.text, fontWeight: isDead ? F.semibold : F.regular }}>
                          {p.lastSaleDate
                            ? `${new Date(p.lastSaleDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} (${days}j)`
                            : '—'}
                        </td>
                        <td style={{ padding: `${SP[2]} ${SP[3]}`, color: C.text, textAlign: 'right' }}>
                          {fmtNum(Math.round(p.unitsSold))} {p.isTile ? 'car.' : p.unitLabel.slice(0, 3)}
                        </td>
                        <td style={{ padding: `${SP[2]} ${SP[3]}`, color: C.muted, textAlign: 'right' }}>
                          {p.velocityPerDay >= 0.1 ? fmtNum(Math.round(p.velocityPerDay * 10) / 10) : '< 0,1'}
                        </td>
                        <td style={{ padding: `${SP[2]} ${SP[3]}` }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: SP[1], fontSize: F.xs, fontWeight: F.bold, padding: `${SP[0.5]} ${SP[2]}`, borderRadius: R.full, background: statusBg, color: statusColor, border: `1px solid ${statusBd}` }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor }} />
                            {statusLabel}
                          </span>
                        </td>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: SP[3] }}>
          {vendorData.length === 0 ? (
            <div style={{ background: C.surface, borderRadius: R.lg, border: `1px solid ${C.border}`, padding: SP[12], textAlign: 'center', color: C.muted, fontSize: F.base, fontFamily: F.body }}>
              Aucune donnée vendeur sur la période.
            </div>
          ) : vendorData.map((v, idx) => {
            const share  = kpis.totalCA > 0 ? (v.ca / kpis.totalCA) * 100 : 0
            const accent = idx === 0 ? C.gold : idx === 1 ? C.muted : C.border
            const marginColor = v.marginPct >= 20 ? C.green : v.marginPct >= 10 ? C.orange : C.red
            return (
              <div key={v.id} style={{ background: C.surface, borderRadius: R.lg, border: `1px solid ${C.border}`, padding: `${SP[4]} ${SP[5]}`, borderLeft: `4px solid ${accent}` }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SP[3] }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: SP[3] }}>
                    <span style={{ fontSize: F.xl, fontWeight: F.black, minWidth: 32, color: accent, fontFamily: F.display }}>{idx + 1}</span>
                    <div>
                      <div style={{ fontSize: F.md, fontWeight: F.bold, color: C.ink, fontFamily: F.body }}>{v.name}</div>
                      <div style={{ fontSize: F.xs, color: C.muted, fontFamily: F.body, marginTop: 2 }}>
                        {v.ventes} vente{v.ventes !== 1 ? 's' : ''} · panier moy. {fmt(v.avgBasket)}
                        {v.cancelCount > 0 && (
                          <span style={{ marginLeft: SP[2], padding: `1px ${SP[1.5]}`, borderRadius: R.full, background: C.redBg, color: C.red, border: `1px solid ${C.redBd}`, fontSize: F.xs }}>
                            {v.cancelCount} annulation{v.cancelCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: F.lg, fontWeight: F.black, color: C.ink, letterSpacing: F.lsTight, fontFamily: F.display }}>{fmt(v.ca)}</div>
                    <div style={{ fontSize: F.xs, color: C.muted, fontFamily: F.body }}>{share.toFixed(1)} % du CA total</div>
                  </div>
                </div>

                {/* CA share bar */}
                <div style={{ height: 5, background: C.bg, borderRadius: R.full, overflow: 'hidden', marginBottom: SP[3] }}>
                  <div style={{ height: '100%', borderRadius: R.full, width: `${share}%`, background: idx === 0 ? C.amber : C.muted, transition: 'width 0.5s ease' }} />
                </div>

                {/* Metrics row */}
                <div style={{ display: 'flex', gap: SP[2], flexWrap: 'wrap' }}>
                  {profile.role === 'owner' && (
                    <div style={{ flex: '1 1 120px', padding: `${SP[2]} ${SP[3]}`, background: C.bg, borderRadius: R.md, border: `1px solid ${C.borderSub}` }}>
                      <div style={{ fontSize: F.xs, color: C.muted, fontFamily: F.body, marginBottom: 2 }}>Marge brute</div>
                      <div style={{ fontSize: F.sm, fontWeight: F.bold, color: marginColor, fontFamily: F.body }}>
                        {fmt(v.margin)} <span style={{ fontWeight: F.regular, fontSize: F.xs }}>({v.marginPct.toFixed(1)} %)</span>
                      </div>
                    </div>
                  )}
                  {v.creances > 0 && (
                    <div style={{ flex: '1 1 120px', padding: `${SP[2]} ${SP[3]}`, background: C.orangeBg, borderRadius: R.md, border: `1px solid ${C.orangeBd}` }}>
                      <div style={{ fontSize: F.xs, color: C.orange, fontFamily: F.body, marginBottom: 2 }}>Créances</div>
                      <div style={{ fontSize: F.sm, fontWeight: F.bold, color: C.orange, fontFamily: F.body }}>{fmt(v.creances)}</div>
                    </div>
                  )}
                  <div style={{ flex: '1 1 120px', padding: `${SP[2]} ${SP[3]}`, background: C.bg, borderRadius: R.md, border: `1px solid ${C.borderSub}` }}>
                    <div style={{ fontSize: F.xs, color: C.muted, fontFamily: F.body, marginBottom: 2 }}>Encaissé</div>
                    <div style={{ fontSize: F.sm, fontWeight: F.bold, color: C.green, fontFamily: F.body }}>{fmt(v.ca - v.creances)}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── DEVIS TAB ── */}
      {activeTab === 'devis' && (
        <DevisTab quotes={filteredQuotes} currency={currency} fmt={fmt} />
      )}

      {/* ── AUDIT TAB ── */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Fraud signals panel — only when signals exist */}
          {fraudSignals.length > 0 && (
            <div style={{
              background: C.redBg, borderRadius: 12,
              border: `1.5px solid ${C.redBd}`,
              padding: '16px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1.5L14.5 13.5H1.5L8 1.5Z" stroke={C.red} strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M8 6.5v3M8 11h.01" stroke={C.red} strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.red,
                  textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: F.body }}>
                  Signaux d'alerte — {fraudSignals.length} détecté{fraudSignals.length > 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {fraudSignals.map((sig, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    background: sig.severity === 'high' ? 'rgba(153,27,27,0.08)' : 'rgba(154,52,18,0.06)',
                    borderRadius: 8, padding: '10px 14px',
                    border: `1px solid ${sig.severity === 'high' ? C.redBd : C.orangeBd}`,
                  }}>
                    <span style={{
                      flexShrink: 0, fontSize: 10, fontWeight: 700,
                      padding: '2px 7px', borderRadius: 100,
                      background: sig.severity === 'high' ? C.red : C.orange,
                      color: '#fff', fontFamily: F.body, marginTop: 1,
                    }}>
                      {sig.severity === 'high' ? 'CRITIQUE' : 'ATTENTION'}
                    </span>
                    <div>
                      <div style={{ fontSize: 12, color: sig.severity === 'high' ? C.red : C.orange,
                        fontWeight: 600, fontFamily: F.body, marginBottom: 2 }}>
                        {sig.type === 'floor_price' ? 'Tentatives prix plancher'
                          : sig.type === 'cancel_rate' ? 'Taux d\'annulation élevé'
                          : 'Créances disproportionnées'}
                      </div>
                      <div style={{ fontSize: 12, color: C.text, fontFamily: F.body }}>
                        {sig.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <AuditLogTab logs={auditLogs} currency={currency} />
        </div>
      )}
    </PageLayout>
  )
}

function ReportSaleDetail({ sale, currency }: { sale: any; currency: string }) {
  const fmt = (n: number) => fmtCurrency(n, currency)
  // font alias removed — use F.body directly
  return (
    <div style={{ background: C.bg, borderRadius: 8,
      padding: '14px 16px', border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.muted,
        textTransform: 'uppercase', letterSpacing: '0.07em',
        marginBottom: 10, fontFamily: F.body }}>
        Détail de la vente
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse',
          marginBottom: 10 }}>
          <thead>
            <tr>
              {['Produit', 'Référence', 'Quantité', 'Prix unitaire', 'Sous-total'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: 12,
                  fontWeight: 700, color: C.muted,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  padding: '0 10px 8px 0', fontFamily: F.body }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(sale.sale_items ?? []).map((item: any) => {
              const isTile = !!item.tile_area_m2_snapshot && !!item.tiles_per_carton_snapshot
              let qtyCell: React.ReactNode
              let priceLabel: string
              if (isTile) {
                const tileArea    = parseFloat(item.tile_area_m2_snapshot)
                const tpc         = parseInt(item.tiles_per_carton_snapshot)
                const m2          = item.quantity_tiles * tileArea
                const fullCartons = Math.floor(item.quantity_tiles / tpc)
                const loose       = item.quantity_tiles % tpc
                qtyCell = (
                  <>
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2, maximumFractionDigits: 2,
                    }).format(m2)} m²
                    <span style={{ color: C.muted, fontSize: 11 }}>
                      {' '}· {fullCartons} ctn{loose > 0 && <span style={{ color: C.orange }}> +{loose}</span>}
                    </span>
                  </>
                )
                priceLabel = `${currency}/m²`
              } else {
                qtyCell    = `${new Intl.NumberFormat('fr-FR').format(item.quantity_tiles)} ${item.products?.unit_label ?? 'unités'}`
                priceLabel = `${currency}/${item.products?.unit_label ?? 'unité'}`
              }
              return (
                <tr key={item.id}>
                  <td style={{ padding: '7px 10px 7px 0', fontSize: 13,
                    fontWeight: 600, color: C.ink, fontFamily: F.body }}>
                    {item.products?.name ?? '—'}
                  </td>
                  <td style={{ padding: '7px 10px 7px 0', fontSize: 11,
                    color: C.muted, fontFamily: F.body }}>
                    {item.products?.reference_code ?? '—'}
                  </td>
                  <td style={{ padding: '7px 10px 7px 0', fontSize: 13,
                    color: C.ink, fontFamily: F.body }}>
                    {qtyCell}
                  </td>
                  <td style={{ padding: '7px 10px 7px 0', fontSize: 13,
                    color: C.muted, fontFamily: F.body }}>
                    {new Intl.NumberFormat('fr-FR').format(item.unit_price_per_m2)} {priceLabel}
                  </td>
                  <td style={{ padding: '7px 0', fontSize: 13,
                    fontWeight: 700, color: C.ink, fontFamily: F.body }}>
                    {fmt(item.total_price)}
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
        <div style={{ fontSize: 12, color: C.muted, fontFamily: F.body }}>
          {sale.customer_phone && <span>{sale.customer_phone}</span>}
          {sale.notes && (
            <span style={{ marginLeft: sale.customer_phone ? 16 : 0 }}>
              {sale.notes}
            </span>
          )}
          {!sale.customer_phone && !sale.notes && <span>Aucune note</span>}
        </div>
        <div style={{ fontSize: 15, fontWeight: 900, color: C.ink, fontFamily: F.body }}>
          Total : {fmt(sale.total_amount)}
        </div>
      </div>
    </div>
  )
}

// ── Audit Log Tab ─────────────────────────────────────────────────────────────
const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  SALE_CREATED:              { label: 'Vente créée',             color: C.green,  bg: C.greenBg },
  SALE_CANCELLED:            { label: 'Vente annulée',           color: C.red,    bg: C.redBg },
  ORDER_PREPARING:           { label: 'Préparation commencée',   color: C.orange, bg: C.orangeBg },
  ORDER_READY:               { label: 'Commande prête',          color: C.green,  bg: C.greenBg },
  ORDER_DELIVERED:           { label: 'Livraison confirmée',     color: C.blue,   bg: C.blueBg },
  STOCK_REQUEST_SUBMITTED:   { label: 'Demande stock soumise',   color: C.gold,   bg: C.goldBg },
  STOCK_REQUEST_APPROVED:    { label: 'Demande stock approuvée', color: C.green,  bg: C.greenBg },
  STOCK_REQUEST_REJECTED:    { label: 'Demande stock rejetée',   color: C.red,    bg: C.redBg },
  PRODUCT_CREATED:           { label: 'Produit créé',            color: C.blue,   bg: C.blueBg },
  PRODUCT_UPDATED:           { label: 'Produit modifié',         color: C.blue,   bg: C.blueBg },
  USER_CREATED:              { label: 'Utilisateur créé',        color: C.blue,   bg: C.blueBg },
  USER_ACTIVATED:            { label: 'Utilisateur activé',      color: C.green,  bg: C.greenBg },
  USER_DEACTIVATED:          { label: 'Utilisateur désactivé',   color: C.red,    bg: C.redBg },
  USER_UPDATED:              { label: 'Utilisateur modifié',     color: C.muted,  bg: C.bg },
  PASSWORD_RESET:            { label: 'Mot de passe réinitialisé', color: C.orange, bg: C.orangeBg },
  BOUTIQUE_ACTIVATED:        { label: 'Boutique activée',        color: C.green,  bg: C.greenBg },
  BOUTIQUE_DEACTIVATED:      { label: 'Boutique désactivée',     color: C.red,    bg: C.redBg },
  FLOOR_PRICE_VIOLATION_ATTEMPT: { label: 'Tentative prix plancher', color: C.red, bg: C.redBg },
  BOUTIQUE_CREATED:              { label: 'Boutique créée',          color: C.blue,   bg: C.blueBg },
  PAYMENT_RECORDED:              { label: 'Paiement enregistré',     color: C.green,  bg: C.greenBg },
  QUOTE_CREATED:                 { label: 'Devis créé',              color: C.blue,   bg: C.blueBg },
  QUOTE_CONVERTED:               { label: 'Devis converti',          color: C.green,  bg: C.greenBg },
  QUOTE_CANCELLED:               { label: 'Devis annulé',            color: C.red,    bg: C.redBg },
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire', admin: 'Admin', vendor: 'Vendeur', warehouse: 'Entrepôt',
}

// ── Human-readable audit detail formatter ─────────────────────────────────
function formatAuditDetails(actionType: string, data: Record<string, unknown> | null, currency: string): string {
  const fmt = (n: unknown) => fmtCurrency(Math.round(Number(n)), currency)
  const str = (v: unknown): string | null =>
    v != null && v !== '' && v !== 'null' ? String(v) : null

  switch (actionType) {
    case 'SALE_CREATED':
      if (!data) return '—'
      return [
        data.sale_number  ? `N° ${data.sale_number}`         : null,
        data.total_amount ? fmt(data.total_amount)        : null,
        data.item_count   ? `${data.item_count} article(s)`  : null,
      ].filter(Boolean).join('  ·  ')

    case 'PAYMENT_RECORDED': {
      if (!data) return '—'
      const note = str(data.notes)
      return [
        data.amount ? fmt(data.amount) : null,
        note        ? note                 : null,
      ].filter(Boolean).join(' — ')
    }

    case 'FLOOR_PRICE_VIOLATION_ATTEMPT':
      if (!data) return '—'
      return `Prix tenté : ${fmt(data.attempted_price)}/m²  ·  Plancher : ${fmt(data.floor_price)}/m²`

    case 'SALE_CANCELLED': {
      if (!data) return '—'
      return [
        data.sale_number   ? `N° ${data.sale_number}`                    : null,
        data.customer_name ? `Client : ${str(data.customer_name)}`       : null,
      ].filter(Boolean).join('  ·  ')
    }

    case 'ORDER_PREPARING':
    case 'ORDER_READY':
    case 'ORDER_DELIVERED': {
      if (!data) return '—'
      const statusLabel: Record<string, string> = {
        preparing: 'En préparation', ready: 'Prête', delivered: 'Livrée',
      }
      return [
        data.order_number ? `${str(data.order_number)}`                              : null,
        data.new_status   ? `→ ${statusLabel[str(data.new_status) ?? ''] ?? str(data.new_status)}` : null,
      ].filter(Boolean).join('  ')
    }

    case 'STOCK_REQUEST_SUBMITTED': {
      if (!data) return '—'
      const typeLabel: Record<string, string> = { stock_in: 'Entrée', correction: 'Correction' }
      return [
        data.product_name ? str(data.product_name)                                  : null,
        data.request_type ? typeLabel[str(data.request_type) ?? ''] ?? ''           : null,
        data.quantity_delta !== undefined ? `Δ ${data.quantity_delta}`               : null,
      ].filter(Boolean).join('  ·  ')
    }

    case 'STOCK_REQUEST_APPROVED': {
      if (!data) return '—'
      return [
        data.product_name   ? str(data.product_name)                                : null,
        data.quantity_delta !== undefined ? `Δ ${data.quantity_delta}`              : null,
        data.comment        ? `Note : ${str(data.comment)}`                         : null,
      ].filter(Boolean).join('  ·  ')
    }

    case 'STOCK_REQUEST_REJECTED':
      if (!data) return '—'
      return [
        data.product_name ? str(data.product_name) : null,
        data.comment      ? str(data.comment)       : null,
      ].filter(Boolean).join(' — ')

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

    case 'QUOTE_CREATED':
      if (!data) return '—'
      return [
        data.quote_number ? `N° ${data.quote_number}`        : null,
        data.total_amount ? fmt(data.total_amount)            : null,
        data.item_count   ? `${data.item_count} article(s)`  : null,
      ].filter(Boolean).join('  ·  ')

    case 'QUOTE_CONVERTED':
      if (!data) return '—'
      return data.sale_number ? `→ ${data.sale_number}` : '—'

    case 'QUOTE_CANCELLED':
      if (!data) return '—'
      return data.quote_number ? `N° ${data.quote_number}` : '—'

    default:
      return '—'
  }
}

// ── Devis Pipeline Tab ────────────────────────────────────────────────────────
const QUOTE_STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  draft:      { bg: C.blueBg,  color: C.blue,  label: 'En attente' },
  confirmed:  { bg: C.greenBg, color: C.green, label: 'Converti'   },
  preparing:  { bg: C.greenBg, color: C.green, label: 'Converti'   },
  ready:      { bg: C.greenBg, color: C.green, label: 'Converti'   },
  delivered:  { bg: C.greenBg, color: C.green, label: 'Converti'   },
  cancelled:  { bg: C.redBg,   color: C.red,   label: 'Annulé'     },
}

function DevisTab({ quotes, currency, fmt }: {
  quotes: any[]; currency: string; fmt: (n: number) => string
}) {
  const open      = quotes.filter(q => q.status === 'draft')
  const converted = quotes.filter(q => q.status !== 'draft' && q.status !== 'cancelled')
  const cancelled = quotes.filter(q => q.status === 'cancelled')
  const total     = quotes.length
  const convRate  = total > 0 ? (converted.length / total) * 100 : 0
  const pipelineCA = open.reduce((sum: number, q: any) => sum + (q.total_amount ?? 0), 0)

  const TH: React.CSSProperties = {
    padding: '13px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700,
    color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em',
    fontFamily: F.body, background: C.bg,
  }
  const TD: React.CSSProperties = { padding: '12px 14px', fontFamily: F.body }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {([
          ['Total créés',     String(total),                          C.amber, C.amber,       'Sur la période'],
          ['En attente',      String(open.length),                    C.blue,  C.blue,        open.length > 0 ? `${fmt(pipelineCA)} en pipeline` : 'Aucun devis ouvert'],
          ['Convertis',       String(converted.length),               C.green, C.green,       `Taux : ${convRate.toFixed(1)} %`],
          ['Annulés',         String(cancelled.length),               cancelled.length > 0 ? C.red : C.muted, cancelled.length > 0 ? C.red : C.muted, cancelled.length > 0 ? 'Non concrétisés' : 'Aucun'],
        ] as [string, string, string, string, string][]).map(([label, value, color, accent, hint]) => (
          <div key={label} style={{
            background: C.surface, borderRadius: 10,
            border: `1px solid ${C.border}`, padding: '14px 16px',
            borderLeft: `3px solid ${accent}`,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.07em',
              marginBottom: 6, fontFamily: F.body }}>
              {label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: '-0.02em', fontFamily: F.body, marginBottom: 3 }}>
              {value}
            </div>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>{hint}</div>
          </div>
        ))}
      </div>

      {/* Pipeline CA banner — only when there are open quotes */}
      {open.length > 0 && (
        <div style={{
          background: C.surface, borderRadius: 10, padding: '16px 20px',
          border: `1px solid ${C.blueBd}`, borderLeft: `4px solid ${C.blue}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontSize: 13, color: C.blue, fontWeight: 600, fontFamily: F.body }}>
            Pipeline devis ouverts ({open.length})
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.blue, fontFamily: F.body, letterSpacing: '-0.02em' }}>
            {fmt(pipelineCA)}
          </div>
        </div>
      )}

      {/* Quote list */}
      {quotes.length === 0 ? (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
          padding: 48, textAlign: 'center', color: C.muted, fontSize: 14, fontFamily: F.body }}>
          Aucun devis sur la période sélectionnée.
        </div>
      ) : (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                  {['N° Devis', 'Date', 'Client', 'Boutique', 'Vendeur', 'Montant', 'Statut', 'N° Vente'].map(h => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotes.map((q: any) => {
                  const ss = QUOTE_STATUS_STYLE[q.status] ?? { bg: C.bg, color: C.muted, label: q.status }
                  const isConverted = q.status !== 'draft' && q.status !== 'cancelled'
                  return (
                    <tr key={q.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ ...TD, fontSize: 13, fontWeight: 700, color: C.ink }}>
                        {q.quote_number}
                      </td>
                      <td style={{ ...TD, fontSize: 12, color: C.muted }}>
                        <div>{new Date(q.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</div>
                        <div style={{ fontSize: 11 }}>{new Date(q.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td style={{ ...TD, fontSize: 13, color: C.ink }}>{q.customer_name ?? '—'}</td>
                      <td style={{ ...TD, fontSize: 13, color: C.ink }}>{q.boutiques?.name ?? '—'}</td>
                      <td style={{ ...TD, fontSize: 13, color: C.ink }}>{q.users?.full_name ?? '—'}</td>
                      <td style={{ ...TD, fontSize: 13, fontWeight: 700, color: C.ink }}>{fmt(q.total_amount)}</td>
                      <td style={TD}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 11, fontWeight: 600, padding: '3px 10px',
                          borderRadius: 100, background: ss.bg, color: ss.color, fontFamily: F.body,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: ss.color, flexShrink: 0 }} />
                          {ss.label}
                        </span>
                      </td>
                      <td style={{ ...TD, fontSize: 12, color: isConverted ? C.amber : C.muted, fontWeight: isConverted ? 700 : 400 }}>
                        {isConverted && q.sale_number ? q.sale_number : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function AuditLogTab({ logs, currency }: { logs: any[]; currency: string }) {
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
    borderRadius: 6, fontSize: 12, fontFamily: F.body,
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
        <span style={{ fontSize: 12, color: C.muted, fontFamily: F.body, marginLeft: 4 }}>
          {filtered.length} entrée{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Log table */}
      <div style={{
        background: C.surface, borderRadius: 12,
        border: `1px solid ${C.border}`,
        boxShadow: '0 1px 3px rgba(60,30,10,0.05)',
        overflow: 'hidden',
      }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', fontSize: 14, color: C.muted, fontFamily: F.body }}>
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
                      whiteSpace: 'nowrap', fontFamily: F.body,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((log: any) => {
                  const cfg = ACTION_CONFIG[log.action_type] ?? { label: log.action_type, color: C.muted, bg: C.bg }
                  const ts = new Date(log.created_at)
                  return (
                    <tr key={log.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: C.muted, whiteSpace: 'nowrap', fontFamily: F.body, verticalAlign: 'middle' }}>
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
                          background: cfg.bg, color: cfg.color, fontFamily: F.body,
                        }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: C.ink, fontWeight: 600, fontFamily: F.body, verticalAlign: 'middle' }}>
                        {log.users?.full_name ?? '—'}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: C.muted, fontFamily: F.body, verticalAlign: 'middle' }}>
                        {ROLE_LABELS[log.user_role_snapshot] ?? log.user_role_snapshot ?? '—'}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: C.muted, fontFamily: F.body, verticalAlign: 'middle', maxWidth: 260 }}>
                        {formatAuditDetails(log.action_type, log.data_after as Record<string, unknown> | null, currency)}
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

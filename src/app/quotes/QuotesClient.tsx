'use client'

import React, { useState, useTransition, useCallback } from 'react'
import { useRouter }    from 'next/navigation'
import PageLayout       from '@/components/PageLayout'
import { convertQuote, cancelQuote } from './actions'
import type { BadgeCounts } from '@/lib/supabase/badge-counts'
import { fmtCurrency }      from '@/lib/format'
import { pluralize }        from '@/lib/pluralize'

import { C, F, R, SP, SH, TR, Z } from '@/lib/design-system'

const fmtNum = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
const fmtM2  = (n: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' m²'

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string; bd: string }> = {
  draft:     { label: 'En attente', bg: C.goldBg,  color: C.gold,  dot: C.gold,  bd: C.goldBd  },
  cancelled: { label: 'Annulé',     bg: C.redBg,   color: C.red,   dot: C.red,   bd: C.redBd   },
}

const TH: React.CSSProperties = {
  padding: `${SP[3]} ${SP[4]}`, textAlign: 'left', fontSize: 11,
  fontWeight: F.bold, color: C.dim, textTransform: 'uppercase',
  letterSpacing: F.lsWider, borderBottom: `1.5px solid ${C.border}`,
  whiteSpace: 'nowrap', fontFamily: F.body, background: C.surfaceSub,
}
const TD: React.CSSProperties = {
  padding: `${SP[3]} ${SP[4]}`, fontSize: 13, color: C.text,
  borderBottom: `1px solid ${C.borderSub}`, verticalAlign: 'middle', fontFamily: F.body,
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function IconDoc({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 20" fill="none">
      <path d="M3 2h9l3 3v13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M12 2v4h3" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M5 9h8M5 12h8M5 15h5" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}
function IconCheck({ size = 14, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M2 7l4 4 6-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconX({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M1 1l10 10M11 1L1 11" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  )
}
function IconPrint({ size = 13, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="5" width="14" height="8" rx="1.5" stroke={color} strokeWidth="1.3"/>
      <path d="M4 5V3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v2" stroke={color} strokeWidth="1.3"/>
      <path d="M4 10.5h8M4 8h5" stroke={color} strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  )
}
function IconEmpty({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="20" fill={C.bg}/>
      <path d="M12 10h10l5 5v15a1 1 0 0 1-1 1H12a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1Z" stroke={C.dim} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M22 10v6h5" stroke={C.dim} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M15 19h10M15 22h8M15 25h5" stroke={C.dim} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function QuotesClient({
  profile, currency, quotes, badgeCounts,
  companyName, ownerName,
  currentPage, totalPages, totalCount,
  activeSearch, activeStatus,
}: {
  profile:       any
  currency:      string
  quotes:        any[]
  badgeCounts?:  BadgeCounts
  companyName:   string
  ownerName:     string
  currentPage:   number
  totalPages:    number
  totalCount:    number
  activeSearch:  string
  activeStatus:  string
}) {
  const router = useRouter()
  const fmt    = (n: number) => fmtCurrency(n, currency)
  const [navPending, startNav] = useTransition()

  // ── Local state ──────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState(activeSearch)
  const [expandedId,  setExpanded]    = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Convert modal
  const [convertId,      setConvertId]      = useState<string | null>(null)
  const [convertAmount,  setConvertAmount]  = useState('')
  const [convertNotes,   setConvertNotes]   = useState('')
  const [convertPhone,   setConvertPhone]   = useState('')
  const [convertCNI,     setConvertCNI]     = useState('')
  const [convertLoading, setConvertLoading] = useState(false)
  const [convertSuccess, setConvertSuccess] = useState<string | null>(null) // VNT number after success

  // Cancel modal
  const [cancelId,      setCancelId]      = useState<string | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  // ── Navigation helpers ────────────────────────────────────────────────────────
  const push = useCallback((href: string) => startNav(() => router.push(href)), [router, startNav])

  const applyFilters = useCallback((overrides: Record<string, string>) => {
    const params = new URLSearchParams()
    const s  = overrides.search  ?? activeSearch
    const st = overrides.status  ?? activeStatus
    if (s)  params.set('search',  s)
    if (st) params.set('status',  st)
    params.set('page', '1')
    startNav(() => router.push(`/quotes?${params.toString()}`))
  }, [router, activeSearch, activeStatus, startNav])

  const handleLogout = async () => {
    const { createClient } = await import('@/lib/supabase/client')
    await createClient().auth.signOut()
    router.push('/login')
  }

  // ── Convert handler ──────────────────────────────────────────────────────────
  const handleConvert = async () => {
    if (!convertId) return
    const q = quotes.find(q => q.id === convertId)
    // Phone and CNI required to confirm — collect them if not already on the quote
    const phone = convertPhone.trim() || q?.customer_phone
    const cni   = convertCNI.trim()   || q?.customer_cni
    if (!phone) { setActionError('Le numéro de téléphone est requis pour confirmer la vente.'); return }
    if (!cni)   { setActionError('Le numéro CNI est requis pour confirmer la vente.'); return }
    setConvertLoading(true)
    setActionError(null)
    const result = await convertQuote(convertId, parseFloat(convertAmount) || 0, convertNotes || null, phone, cni)
    setConvertLoading(false)
    if (result.error) { setActionError(result.error); return }
    setConvertSuccess(result.saleNumber ?? null)
  }

  const closeConvertModal = () => {
    setConvertId(null); setConvertAmount(''); setConvertNotes('')
    setConvertPhone(''); setConvertCNI('')
    setConvertSuccess(null); setActionError(null)
  }

  // ── Cancel handler ───────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!cancelId) return
    setCancelLoading(true)
    setActionError(null)
    const result = await cancelQuote(cancelId)
    setCancelLoading(false)
    if (result.error) { setActionError(result.error); setCancelId(null); return }
    setCancelId(null)
  }

  // ── Print devis ──────────────────────────────────────────────────────────────
  const printQuote = (quote: any) => {
    const escHtml = (s: string | null | undefined): string =>
      String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')

    const now = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

    const rows = (quote.sale_items ?? []).map((item: any) => {
      const prod       = item.products
      const isItemTile = (prod?.product_type ?? 'tile') === 'tile'
      const unitLbl    = escHtml(prod?.unit_label ?? (isItemTile ? 'm²' : 'unité'))
      let qtyCell: string, priceCell: string

      if (isItemTile) {
        const tileArea = item.tile_area_m2_snapshot ? parseFloat(item.tile_area_m2_snapshot) : 0
        const tpc      = item.tiles_per_carton_snapshot ? parseInt(item.tiles_per_carton_snapshot) : 0
        const m2       = item.quantity_tiles * tileArea
        const cartons  = tpc ? Math.floor(item.quantity_tiles / tpc) : 0
        const loose    = tpc ? item.quantity_tiles % tpc : 0
        qtyCell   = `${new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(m2)} m² · ${cartons}${loose>0?` <span style="color:#D97706">+${loose}</span>`:''} ctn`
        priceCell = `${fmtNum(item.unit_price_per_m2)} ${currency}/m²`
      } else {
        const itemType = prod?.product_type ?? 'unit'
        const bagKg    = itemType === 'bag' && prod?.bag_weight_kg
          ? Math.round(item.quantity_tiles * parseFloat(prod.bag_weight_kg)) : null
        const pkgCnt   = itemType === 'unit' && prod?.pieces_per_package
          ? Math.floor(item.quantity_tiles / parseInt(prod.pieces_per_package)) : null
        const pLbl = pluralize(unitLbl, item.quantity_tiles)

        if (bagKg) {
          qtyCell = `${fmtNum(item.quantity_tiles)} sac${item.quantity_tiles>1?'s':''} <span style="color:#64748B;font-size:11px">(${fmtNum(bagKg)} kg)</span>`
        } else if (pkgCnt && pkgCnt > 0) {
          const pkgLblPrint = escHtml(prod?.package_label ?? 'lot')
          qtyCell = `${fmtNum(item.quantity_tiles)} ${pLbl} <span style="color:#64748B;font-size:11px">(${pkgCnt} ${pkgLblPrint}${pkgCnt>1?'s':''})</span>`
        } else {
          qtyCell = `${fmtNum(item.quantity_tiles)} ${pLbl}`
        }
        priceCell = `${fmtNum(item.unit_price_per_m2)} ${currency}/${unitLbl}`
      }

      return `<tr>
        <td>${escHtml(prod?.name)}</td>
        <td style="color:#64748B;font-size:11px">${escHtml(prod?.reference_code)}</td>
        <td style="text-align:center">${qtyCell}</td>
        <td style="text-align:right">${priceCell}</td>
        <td style="text-align:right;font-weight:700">${fmtNum(Math.round(item.total_price))} ${currency}</td>
      </tr>`
    }).join('')

    const total = Math.round(Number(quote.total_amount))

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><meta name="viewport" content="width=800"/>
<title>Devis — ${escHtml(quote.quote_number)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0F172A;padding:32px;font-size:13px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #0F172A}
.logo{font-size:24px;font-weight:800;letter-spacing:-0.03em}
.devis-badge{display:inline-block;padding:4px 12px;border-radius:6px;background:#FFFBEB;border:1px solid #B45309;font-size:11px;font-weight:700;color:#B45309;letter-spacing:0.08em;text-transform:uppercase;margin-top:6px}
.meta{font-size:11px;color:#64748B;text-align:right;line-height:1.8}
.quote-id{font-size:22px;font-weight:800;color:#0F172A;letter-spacing:-0.02em;margin-bottom:4px}
.info-block{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px 18px;margin-bottom:20px;display:flex;gap:32px}
.info-col{flex:1}
.info-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#94A3B8;margin-bottom:3px}
.info-value{font-size:13px;font-weight:600;color:#0F172A}
.validity{background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:12px;color:#92400E}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
th{text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;padding:0 10px 10px 0;border-bottom:2px solid #0F172A}
td{padding:10px 10px 10px 0;border-bottom:1px solid #E2E8F0;vertical-align:middle}
.total-row{display:flex;justify-content:flex-end;margin-bottom:28px}
.total-box{background:#0F172A;color:white;padding:14px 24px;border-radius:8px;text-align:right}
.total-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#94A3B8;margin-bottom:4px}
.total-amount{font-size:22px;font-weight:900;letter-spacing:-0.02em}
.sig-section{margin-top:32px;padding-top:20px;border-top:1px solid #E2E8F0}
.sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:16px}
.sig-name{font-size:12px;font-weight:600;color:#0F172A;margin-bottom:4px}
.sig-role{font-size:11px;color:#64748B;margin-bottom:12px}
.sig-line{border-bottom:1.5px solid #CBD5E1;height:52px;margin-bottom:6px}
.sig-sub{font-size:10px;color:#94A3B8}
.footer{margin-top:24px;text-align:center;font-size:10px;color:#94A3B8;padding-top:16px;border-top:1px solid #E2E8F0}
.back-btn{display:inline-flex;align-items:center;gap:6px;margin-bottom:20px;padding:8px 16px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:6px;font-size:12px;font-weight:600;color:#475569;cursor:pointer;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}
@media print{@page{margin:20mm}.back-btn{display:none!important}}
</style></head><body>
<button class="back-btn" onclick="window.close()">← Retour</button>
<div class="header">
  <div>
    <div class="logo">${escHtml(companyName)}</div>
    <div class="devis-badge">Devis commercial</div>
  </div>
  <div class="meta">
    <div>${now}</div>
    <div>${escHtml((quote.boutiques as any)?.name ?? '')}</div>
  </div>
</div>

<div class="quote-id">${escHtml(quote.quote_number) || '—'}</div>
<div style="font-size:12px;color:#64748B;margin-bottom:20px">${new Date(quote.created_at).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>

<div class="validity">
  Ce devis est valable 30 jours à compter de sa date d'émission. Les prix indiqués sont susceptibles de variation.
</div>

<div class="info-block">
  <div class="info-col">
    <div class="info-label">Client</div>
    <div class="info-value">${escHtml(quote.customer_name) || 'Non renseigné'}</div>
    ${quote.customer_phone ? `<div style="font-size:12px;color:#64748B;margin-top:2px">${escHtml(quote.customer_phone)}</div>` : ''}
    ${quote.customer_cni ? `<div style="font-size:11px;color:#94A3B8;margin-top:2px">CNI : ${escHtml(quote.customer_cni)}</div>` : ''}
  </div>
  <div class="info-col">
    <div class="info-label">Vendeur</div>
    <div class="info-value">${escHtml((quote.users as any)?.full_name ?? '')}</div>
    <div style="font-size:12px;color:#64748B;margin-top:2px">${escHtml((quote.boutiques as any)?.name ?? '')}</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Produit</th>
      <th>Référence</th>
      <th style="text-align:center">Quantité</th>
      <th style="text-align:right">Prix unit.</th>
      <th style="text-align:right">Sous-total</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<div class="total-row">
  <div class="total-box">
    <div class="total-label">Montant estimatif</div>
    <div class="total-amount">${fmtNum(total)} ${currency}</div>
  </div>
</div>

${quote.notes ? `<div style="margin-bottom:28px;padding:12px 16px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;font-size:12px;color:#475569"><strong>Notes :</strong> ${escHtml(quote.notes)}</div>` : ''}

<div class="sig-section">
  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#94A3B8">Acceptation du devis</div>
  <div class="sig-grid">
    <div>
      <div class="sig-name">${escHtml((quote.users as any)?.full_name ?? 'Le vendeur')}</div>
      <div class="sig-role">Vendeur — ${escHtml((quote.boutiques as any)?.name ?? '')}</div>
      <div class="sig-line"></div>
      <div class="sig-sub">Signature du vendeur</div>
    </div>
    <div>
      <div class="sig-name">${escHtml(quote.customer_name) || 'Le client'}</div>
      <div class="sig-role">Client — Bon pour accord</div>
      <div class="sig-line"></div>
      <div class="sig-sub">Signature du client</div>
    </div>
  </div>
</div>

<div class="footer">${escHtml(companyName)} — Devis émis le ${now} · Document non contractuel avant signature</div>
</body></html>`

    const w = window.open('', '_blank', 'width=800,height=900')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 400)
  }

  // ── Quote being converted (for modal display) ──────────────────────────────
  const convertingQuote = convertId ? quotes.find(q => q.id === convertId) : null

  return (
    <PageLayout profile={profile} activeRoute="/quotes" onLogout={handleLogout} badgeCounts={badgeCounts}>

      {/* ── Page header ── */}
      <div className="fade-in-up" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.ink, margin: '0 0 4px', letterSpacing: '-0.03em', fontFamily: F.body }}>
              Devis
            </h1>
            <p style={{ fontSize: 13, color: C.muted, margin: 0, fontFamily: F.body }}>
              {totalCount} devis au total · Confirmez pour créer une vente
            </p>
          </div>
          <button
            onClick={() => push('/sales/new')}
            disabled={navPending}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,#2563EB,#1D4ED8)',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: navPending ? 'not-allowed' : 'pointer',
              fontFamily: F.body, boxShadow: '0 4px 16px rgba(37,99,235,0.3)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1v11M1 6.5h11" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Nouvelle vente
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke={C.muted} strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilters({ search })}
            placeholder="Rechercher un devis, client…"
            style={{
              width: '100%', paddingLeft: 30, paddingRight: 12,
              paddingTop: 9, paddingBottom: 9, borderRadius: 9,
              border: `1.5px solid ${C.border}`, fontSize: 13,
              color: C.ink, outline: 'none', boxSizing: 'border-box',
              background: C.surface, fontFamily: F.body,
            }}
          />
        </div>

        {/* Status pills */}
        {(['', 'draft', 'cancelled'] as const).map(s => {
          const labels: Record<string, string> = { '': 'Tous', draft: 'En attente', cancelled: 'Annulés' }
          const active = activeStatus === s
          return (
            <button key={s} onClick={() => applyFilters({ status: s })}
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: F.body,
                border: `1.5px solid ${active ? C.blue : C.border}`,
                background: active ? C.blueBg : C.surface,
                color: active ? C.blue : C.muted,
              }}>
              {labels[s]}
            </button>
          )
        })}
      </div>

      {/* ── Error banner ── */}
      {actionError && (
        <div style={{ padding: '12px 16px', background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 10, color: C.red, fontSize: 13, fontWeight: 600, marginBottom: 16, fontFamily: F.body, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {actionError}
          <button onClick={() => setActionError(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.red }}><IconX size={12} color={C.red} /></button>
        </div>
      )}

      {/* ── Table ── */}
      {quotes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', background: C.surface, borderRadius: 16, border: `1px solid ${C.border}` }}>
          <div style={{ display: 'inline-flex', marginBottom: 16 }}><IconEmpty size={48} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 6, fontFamily: F.body }}>Aucun devis</div>
          <div style={{ fontSize: 13, color: C.muted, fontFamily: F.body }}>
            {activeSearch || activeStatus ? 'Aucun résultat pour ces filtres.' : 'Les devis sauvegardés apparaîtront ici.'}
          </div>
        </div>
      ) : (
        <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={TH}>N° Devis</th>
                  <th style={TH}>Date</th>
                  <th style={TH}>Client</th>
                  <th style={TH}>Articles</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Montant</th>
                  <th style={TH}>Statut</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map(quote => {
                  const cfg       = STATUS_CONFIG[quote.status] ?? STATUS_CONFIG.draft
                  const isDraft   = quote.status === 'draft'
                  const itemCount = (quote.sale_items ?? []).length
                  const isExp     = expandedId === quote.id

                  return (
                    <React.Fragment key={quote.id}>
                      <tr style={{ cursor: 'pointer' }} onClick={() => setExpanded(isExp ? null : quote.id)}>
                        <td style={TD}>
                          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 700, color: C.gold }}>
                            {quote.quote_number || '—'}
                          </span>
                        </td>
                        <td style={TD}>
                          <div style={{ fontSize: 13, color: C.ink, fontFamily: F.body }}>
                            {new Date(quote.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                          <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>
                            {new Date(quote.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td style={TD}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, fontFamily: F.body }}>
                            {quote.customer_name || <span style={{ color: C.muted }}>—</span>}
                          </div>
                          {quote.customer_phone && (
                            <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>{quote.customer_phone}</div>
                          )}
                        </td>
                        <td style={TD}>
                          <span style={{ fontSize: 12, color: C.muted, fontFamily: F.body }}>
                            {itemCount} article{itemCount !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td style={{ ...TD, textAlign: 'right' }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: C.ink, fontFamily: F.body }}>
                            {fmt(Number(quote.total_amount))}
                          </span>
                        </td>
                        <td style={TD}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '4px 10px', borderRadius: 100,
                            background: cfg.bg, border: `1px solid ${cfg.color}30`,
                            fontSize: 11, fontWeight: 700, color: cfg.color, fontFamily: F.body,
                          }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                            {cfg.label}
                          </span>
                        </td>
                        <td style={{ ...TD, textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                            {/* Print devis */}
                            <button
                              onClick={e => { e.stopPropagation(); printQuote(quote) }}
                              title="Imprimer le devis"
                              style={{
                                padding: '6px 10px', borderRadius: 7, cursor: 'pointer',
                                border: `1.5px solid ${C.border}`, background: C.surface,
                                color: C.muted, fontSize: 12, fontWeight: 600,
                                fontFamily: F.body, display: 'flex', alignItems: 'center', gap: 5,
                              }}
                            >
                              <IconPrint size={13} color={C.muted} />
                              Devis
                            </button>

                            {isDraft && (
                              <>
                                {/* Convert to sale */}
                                <button
                                  onClick={e => { e.stopPropagation(); setConvertId(quote.id); setActionError(null) }}
                                  title="Convertir en vente"
                                  style={{
                                    padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
                                    border: 'none', background: C.green,
                                    color: '#fff', fontSize: 12, fontWeight: 700,
                                    fontFamily: F.body, display: 'flex', alignItems: 'center', gap: 5,
                                  }}
                                >
                                  <IconCheck size={12} color="white" />
                                  Confirmer
                                </button>

                                {/* Cancel */}
                                <button
                                  onClick={e => { e.stopPropagation(); setCancelId(quote.id); setActionError(null) }}
                                  title="Annuler le devis"
                                  style={{
                                    padding: '6px 8px', borderRadius: 7, cursor: 'pointer',
                                    border: `1.5px solid ${C.border}`, background: C.surface,
                                    color: C.red, fontSize: 12, fontWeight: 600,
                                    fontFamily: F.body, display: 'flex', alignItems: 'center',
                                  }}
                                >
                                  <IconX size={11} color={C.red} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded items row */}
                      {isExp && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0, background: C.bg }}>
                            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 10, fontFamily: F.body }}>
                                Articles du devis
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {(quote.sale_items ?? []).map((item: any, idx: number) => {
                                  const prod       = item.products
                                  const isItemTile = (prod?.product_type ?? 'tile') === 'tile'
                                  const unitLbl    = prod?.unit_label ?? (isItemTile ? 'm²' : 'unité')
                                  const bagKg      = !isItemTile && prod?.product_type === 'bag' && prod?.bag_weight_kg
                                    ? Math.round(item.quantity_tiles * parseFloat(prod.bag_weight_kg)) : null
                                  const pkgCnt     = !isItemTile && prod?.product_type === 'unit' && prod?.pieces_per_package
                                    ? Math.floor(item.quantity_tiles / parseInt(prod.pieces_per_package)) : null

                                  const qtyDisp = isItemTile
                                    ? (() => {
                                        const ta = parseFloat(item.tile_area_m2_snapshot ?? 0)
                                        const tc = parseInt(item.tiles_per_carton_snapshot ?? 0)
                                        return `${fmtM2(item.quantity_tiles * ta)} · ${tc ? Math.floor(item.quantity_tiles/tc) : 0} ctn`
                                      })()
                                    : bagKg
                                    ? `${fmtNum(item.quantity_tiles)} sac${item.quantity_tiles>1?'s':''} (${fmtNum(bagKg)} kg)`
                                    : pkgCnt && pkgCnt > 0
                                    ? `${fmtNum(item.quantity_tiles)} ${pluralize(unitLbl, item.quantity_tiles)} (${pkgCnt} ${prod?.package_label ?? 'lot'}${pkgCnt>1?'s':''})`
                                    : `${fmtNum(item.quantity_tiles)} ${pluralize(unitLbl, item.quantity_tiles)}`

                                  return (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}>
                                      <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, fontFamily: F.body }}>{prod?.name}</div>
                                        <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>{prod?.reference_code} · {qtyDisp}</div>
                                      </div>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, fontFamily: F.body }}>{fmt(Math.round(item.total_price))}</div>
                                    </div>
                                  )
                                })}
                              </div>
                              {quote.notes && (
                                <div style={{ marginTop: 10, padding: '8px 12px', background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, color: C.muted, fontFamily: F.body }}>
                                  <strong>Notes :</strong> {quote.notes}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: C.bg }}>
              <span style={{ fontSize: 12, color: C.muted, fontFamily: F.body }}>
                Page {currentPage} / {totalPages} · {totalCount} devis
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {([
                  { label: '← Préc.', page: currentPage - 1, disabled: currentPage <= 1 },
                  { label: 'Suiv. →', page: currentPage + 1, disabled: currentPage >= totalPages },
                ] as const).map(btn => (
                  <button key={btn.label}
                    disabled={btn.disabled}
                    onClick={() => {
                      const p = new URLSearchParams()
                      if (activeSearch) p.set('search',  activeSearch)
                      if (activeStatus) p.set('status',  activeStatus)
                      p.set('page', String(btn.page))
                      startNav(() => router.push(`/quotes?${p.toString()}`))
                    }}
                    style={{
                      padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: `1.5px solid ${C.border}`, background: C.surface,
                      color: btn.disabled ? C.dim : C.muted,
                      cursor: btn.disabled ? 'not-allowed' : 'pointer', fontFamily: F.body,
                    }}>
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════ CONVERT MODAL ═══════════════════════════════ */}
      {convertId && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(4px)', fontFamily: F.body }}>
          <div className="modal-panel" style={{ background: C.surface, borderRadius: 18, width: '100%', maxWidth: 480, boxShadow: '0 32px 80px rgba(0,0,0,0.22)', overflow: 'hidden' }}>

            {convertSuccess ? (
              /* ── Success state ── */
              <>
                <div style={{ height: 4, background: 'linear-gradient(90deg,#059669,#34D399)' }} />
                <div style={{ padding: '32px 28px', textAlign: 'center' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.greenBg, border: '4px solid #D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                      <path d="M5 13l6 6 10-11" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: C.ink, margin: '0 0 8px', letterSpacing: '-0.02em' }}>Vente confirmée</h3>
                  <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>Le devis a été converti avec succès.</p>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 100, background: C.bg, border: `1px solid ${C.border}`, marginBottom: 24 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
                    <span style={{ fontSize: 16, fontWeight: 900, color: C.ink, letterSpacing: '0.02em', fontFamily: 'ui-monospace, monospace' }}>
                      {convertSuccess}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => { closeConvertModal(); push('/sales') }}
                      style={{ flex: 1, padding: '12px', borderRadius: 9, border: 'none', background: C.green, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: F.body }}>
                      Voir dans les ventes
                    </button>
                    <button onClick={closeConvertModal}
                      style={{ padding: '12px 18px', borderRadius: 9, border: `1.5px solid ${C.border}`, background: C.surface, color: C.muted, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: F.body }}>
                      Fermer
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* ── Form state ── */
              <>
                <div style={{ height: 4, background: 'linear-gradient(90deg,#059669,#34D399)' }} />
                <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: C.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IconCheck size={18} color={C.green} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Confirmer le devis</div>
                    <div style={{ fontSize: 13, color: C.muted }}>
                      {convertingQuote?.quote_number} · {fmt(Number(convertingQuote?.total_amount))}
                    </div>
                  </div>
                  <button onClick={closeConvertModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.dim, padding: 2 }}>
                    <IconX size={13} color={C.dim} />
                  </button>
                </div>

                <div style={{ padding: '20px 24px', maxHeight: '70vh', overflowY: 'auto' }}>
                  <div style={{ padding: '12px 14px', background: C.blueBg, borderRadius: 10, border: `1px solid ${C.blue}30`, fontSize: 12, color: C.blue, marginBottom: 16, fontFamily: F.body }}>
                    La vente sera enregistrée et la commande envoyée à l'entrepôt. Le stock sera réservé.
                  </div>

                  {/* Complete missing client info if needed */}
                  {(!convertingQuote?.customer_phone || !convertingQuote?.customer_cni) && (
                    <div style={{ marginBottom: 16, padding: '14px', background: C.orangeBg, borderRadius: 10, border: `1px solid ${C.orange}40` }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.orange, marginBottom: 10, fontFamily: F.body }}>
                        Informations manquantes pour finaliser la vente
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {!convertingQuote?.customer_phone && (
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 4, fontFamily: F.body }}>
                              Téléphone <span style={{ color: C.red }}>*</span>
                            </label>
                            <input type="tel" value={convertPhone} onChange={e => setConvertPhone(e.target.value)}
                              placeholder="ex : 6 99 11 22 33"
                              style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, outline: 'none', boxSizing: 'border-box', background: C.surface, fontFamily: F.body }} />
                          </div>
                        )}
                        {!convertingQuote?.customer_cni && (
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 4, fontFamily: F.body }}>
                              N° CNI <span style={{ color: C.red }}>*</span>
                            </label>
                            <input type="text" value={convertCNI} onChange={e => setConvertCNI(e.target.value)}
                              placeholder="ex : 1 23 04 5678 912 34"
                              style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, outline: 'none', boxSizing: 'border-box', background: C.surface, fontFamily: F.body }} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Payment amount */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: F.body }}>
                      Montant encaissé <span style={{ fontWeight: 400, color: C.muted }}>(optionnel)</span>
                    </label>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <button type="button" onClick={() => setConvertAmount(String(convertingQuote?.total_amount ?? ''))}
                        style={{ flex: 1, padding: '8px', borderRadius: 7, border: `1.5px solid ${parseFloat(convertAmount) >= Number(convertingQuote?.total_amount) && convertAmount ? C.green : C.border}`, background: parseFloat(convertAmount) >= Number(convertingQuote?.total_amount) && convertAmount ? C.greenBg : C.bg, color: parseFloat(convertAmount) >= Number(convertingQuote?.total_amount) && convertAmount ? C.green : C.muted, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: F.body }}>
                        Paiement complet
                      </button>
                      <button type="button" onClick={() => setConvertAmount('')}
                        style={{ flex: 1, padding: '8px', borderRadius: 7, border: `1.5px solid ${convertAmount === '' ? C.blue : C.border}`, background: convertAmount === '' ? C.blueBg : C.bg, color: convertAmount === '' ? C.blue : C.muted, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: F.body }}>
                        Sans paiement
                      </button>
                    </div>
                    <input
                      type="number" min="0" step="100"
                      value={convertAmount}
                      onChange={e => setConvertAmount(e.target.value)}
                      placeholder={`max. ${fmt(Number(convertingQuote?.total_amount))}`}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, outline: 'none', boxSizing: 'border-box', background: C.surface, fontFamily: F.body }}
                    />
                  </div>

                  {/* Notes */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: F.body }}>
                      Notes de paiement <span style={{ fontWeight: 400, color: C.muted }}>(optionnel)</span>
                    </label>
                    <input
                      type="text"
                      value={convertNotes}
                      onChange={e => setConvertNotes(e.target.value)}
                      placeholder="ex : Virement, chèque…"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, outline: 'none', boxSizing: 'border-box', background: C.surface, fontFamily: F.body }}
                    />
                  </div>

                  {actionError && (
                    <div style={{ padding: '10px 12px', background: C.redBg, borderRadius: 8, border: `1px solid ${C.red}`, fontSize: 12, fontWeight: 600, color: C.red, marginBottom: 14, fontFamily: F.body }}>
                      {actionError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={handleConvert} disabled={convertLoading}
                      style={{ flex: 1, padding: '13px', background: C.green, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: convertLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: convertLoading ? 0.7 : 1, fontFamily: F.body }}>
                      {convertLoading ? <><span className="spinner" />Confirmation…</> : <><IconCheck size={14} color="white" />Confirmer la vente</>}
                    </button>
                    <button onClick={closeConvertModal} disabled={convertLoading}
                      style={{ padding: '13px 20px', background: C.bg, color: C.muted, border: `1.5px solid ${C.border}`, borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: F.body }}>
                      Annuler
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════ CANCEL MODAL ════════════════════════════════ */}
      {cancelId && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(4px)', fontFamily: F.body }}>
          <div className="modal-panel" style={{ background: C.surface, borderRadius: 18, width: '100%', maxWidth: 420, boxShadow: '0 32px 80px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
            <div style={{ height: 4, background: 'linear-gradient(90deg,#EF4444,#F87171)' }} />
            <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: C.redBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IconX size={16} color={C.red} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Annuler le devis</div>
                <div style={{ fontSize: 13, color: C.muted }}>Cette action est irréversible.</div>
              </div>
              <button onClick={() => setCancelId(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.dim, padding: 2 }}>
                <IconX size={13} color={C.dim} />
              </button>
            </div>
            <div style={{ padding: '20px 24px 24px', display: 'flex', gap: 10 }}>
              <button onClick={handleCancel} disabled={cancelLoading}
                style={{ flex: 1, padding: '12px', background: C.red, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: cancelLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: cancelLoading ? 0.7 : 1, fontFamily: F.body }}>
                {cancelLoading ? <><span className="spinner" />Annulation…</> : 'Annuler le devis'}
              </button>
              <button onClick={() => setCancelId(null)} disabled={cancelLoading}
                style={{ padding: '12px 20px', background: C.bg, color: C.muted, border: `1.5px solid ${C.border}`, borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: F.body }}>
                Retour
              </button>
            </div>
          </div>
        </div>
      )}

    </PageLayout>
  )
}

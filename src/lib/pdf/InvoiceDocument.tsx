import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { InvoiceData, InvoiceItem } from './types'
import { pluralize } from '@/lib/pluralize'

// ── Palette ──────────────────────────────────────────────────────────────────
const COGNAC     = '#A0531A'
const COGNAC_DIM = '#C87B45'
const INK        = '#1A0F06'
const TEXT       = '#3C2715'
const MUTED      = '#7A6248'
const DIM        = '#A8906E'
const SURFACE    = '#FDFAF5'
const BORDER     = '#DDD4C5'
const STRIPE     = '#FAF5EE'
const WHITE      = '#FFFFFF'
const GREEN      = '#059669'
const GREEN_BG   = '#D1FAE5'
const ORANGE     = '#D97706'
const ORANGE_BG  = '#FEF3C7'
const RED        = '#DC2626'
const RED_BG     = '#FEE2E2'
const GOLD       = '#78350F'
const GOLD_BG    = '#FFFBEB'
const GOLD_BD    = '#FDE68A'

// ── Helpers ───────────────────────────────────────────────────────────────────
// Node.js v22 fr-FR uses U+202F (narrow no-break space) as thousands separator.
// Built-in PDF fonts (Helvetica, etc.) don't include that glyph — it renders as
// a fallback character.  Strip it to a regular ASCII space after formatting.
const sanitize = (s: string) => s.replace(/\u202F/g, ' ')

const fmtNum = (n: number) =>
  sanitize(new Intl.NumberFormat('fr-FR').format(Math.round(n)))
const fmtAmt = (n: number, cur: string) => `${fmtNum(n)} ${cur}`
const fmtM2  = (n: number) =>
  sanitize(
    new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n),
  )
const fmtDate = (s: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(s).toLocaleDateString('fr-FR', opts ?? {
    day: 'numeric', month: 'long', year: 'numeric',
  })

// Unit labels that are abbreviations (1-2 chars: m, L, kg…) must not be
// pluralised — "100 ms" for linear metres looks wrong; keep them invariant.
const pluralizeUnit = (label: string, count: number) =>
  label.length <= 2 ? label : pluralize(label, count)

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: TEXT,
    paddingTop: 36,
    paddingBottom: 48,
    paddingLeft: 36,
    paddingRight: 36,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  logoImg: {
    width: 42,
    height: 42,
    marginRight: 11,
    borderRadius: 4,
  },
  logoFallback: {
    width: 42,
    height: 42,
    marginRight: 11,
    borderRadius: 4,
    backgroundColor: COGNAC,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackText: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
  },
  companyName: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: COGNAC,
    letterSpacing: -0.5,
    marginBottom: 3,
  },
  boutiqueName: {
    fontSize: 8.5,
    color: MUTED,
    marginBottom: 1,
  },
  boutiqueDetail: {
    fontSize: 8,
    color: DIM,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  docNumber: {
    fontSize: 15,
    fontFamily: 'Courier-Bold',
    color: INK,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  docTypeLabel: {
    fontSize: 7.5,
    color: COGNAC_DIM,
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  docDate: {
    fontSize: 9,
    color: TEXT,
  },

  // Cognac rule
  rule: {
    height: 2,
    backgroundColor: COGNAC,
    borderRadius: 1,
    marginBottom: 14,
  },

  // Quote notice
  quoteNotice: {
    backgroundColor: GOLD_BG,
    borderWidth: 0.5,
    borderColor: GOLD_BD,
    borderStyle: 'solid',
    borderRadius: 4,
    paddingTop: 7,
    paddingBottom: 7,
    paddingLeft: 10,
    paddingRight: 10,
    marginBottom: 14,
  },
  quoteNoticeTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: GOLD,
    marginBottom: 3,
  },
  quoteNoticeBody: {
    fontSize: 8,
    color: '#92400E',
    lineHeight: 1.5,
  },

  // Info grid
  infoGrid: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  infoColLeft: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 5,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 12,
    paddingRight: 12,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderStyle: 'solid',
    marginRight: 10,
  },
  infoColRight: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 5,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 12,
    paddingRight: 12,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderStyle: 'solid',
  },
  infoLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  infoName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: INK,
    marginBottom: 3,
  },
  infoSub: {
    fontSize: 8.5,
    color: TEXT,
    marginBottom: 2,
  },
  infoDim: {
    fontSize: 8,
    color: DIM,
  },

  // Items table
  table: {
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COGNAC,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 8,
    paddingRight: 8,
    borderRadius: 3,
    marginBottom: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingTop: 7,
    paddingBottom: 7,
    paddingLeft: 8,
    paddingRight: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    borderBottomStyle: 'solid',
  },
  tableRowAlt: {
    flexDirection: 'row',
    paddingTop: 7,
    paddingBottom: 7,
    paddingLeft: 8,
    paddingRight: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    borderBottomStyle: 'solid',
    backgroundColor: STRIPE,
  },
  colDesignation: { flex: 3 },
  colQty:         { flex: 2 },
  colPrice:       { flex: 2 },
  colTotal:       { flex: 2 },
  thText: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
    letterSpacing: 0.5,
  },
  thRight: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
    letterSpacing: 0.5,
    textAlign: 'right',
  },
  thCenter: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  tdName: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: INK,
    marginBottom: 2,
  },
  tdRef: {
    fontSize: 7.5,
    fontFamily: 'Courier',
    color: DIM,
  },
  tdQtyMain: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: INK,
    textAlign: 'center',
    marginBottom: 1,
  },
  tdQtySub: {
    fontSize: 7.5,
    color: MUTED,
    textAlign: 'center',
  },
  tdPrice: {
    fontSize: 8.5,
    color: TEXT,
    textAlign: 'right',
  },
  tdTotal: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: INK,
    textAlign: 'right',
  },

  // Totals
  totalsSection: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  totalsBox: {
    width: 222,
  },
  totalLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 4,
    paddingRight: 4,
  },
  totalLbl:  { fontSize: 9, color: MUTED },
  totalVal:  { fontSize: 9, fontFamily: 'Helvetica-Bold', color: TEXT },
  totalPaid: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: GREEN },
  totalRem:  { fontSize: 9, fontFamily: 'Helvetica-Bold', color: RED },
  divider: {
    height: 0.5,
    backgroundColor: BORDER,
    marginTop: 5,
    marginBottom: 5,
  },
  grandTotalBox: {
    backgroundColor: INK,
    borderRadius: 5,
    paddingTop: 11,
    paddingBottom: 11,
    paddingLeft: 14,
    paddingRight: 14,
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grandTotalLbl: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#7A6248',
    letterSpacing: 1.2,
  },
  grandTotalAmt: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
  },

  // Status pill
  pillRow: {
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  pillBase: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 11,
    paddingRight: 11,
    borderRadius: 100,
    borderWidth: 0.5,
    borderStyle: 'solid',
  },
  pillDotBase: {
    width: 5,
    height: 5,
    borderRadius: 100,
    marginRight: 6,
  },
  pillTxt: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
  },

  // Payment history
  payHistSection: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  payHistRow: {
    flexDirection: 'row',
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 8,
    paddingRight: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    borderBottomStyle: 'solid',
  },
  payHistRowAlt: {
    flexDirection: 'row',
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 8,
    paddingRight: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    borderBottomStyle: 'solid',
    backgroundColor: STRIPE,
  },
  payHistDate: { flex: 2, fontSize: 8, color: MUTED },
  payHistNote: { flex: 3, fontSize: 8, color: DIM },
  payHistAmt:  { flex: 2, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: GREEN, textAlign: 'right' },

  // Signatures
  sigSection: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    borderTopStyle: 'solid',
  },
  sigColLeft:  { flex: 1, marginRight: 20 },
  sigColRight: { flex: 1 },
  sigName: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: INK,
    marginBottom: 2,
  },
  sigRole: {
    fontSize: 8,
    color: MUTED,
    marginBottom: 14,
  },
  sigLine: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderBottomStyle: 'solid',
    height: 40,
    marginBottom: 5,
  },
  sigSub: {
    fontSize: 7.5,
    color: DIM,
  },

  // Footer (absolute)
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    borderTopStyle: 'solid',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerL: { fontSize: 7.5, color: DIM },
  footerR: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: MUTED },
})

// ── Item row ──────────────────────────────────────────────────────────────────
function ItemRow({ item, idx, currency }: { item: InvoiceItem; idx: number; currency: string }) {
  const isTile = (item.product_type ?? 'tile') === 'tile'
  let qtyMain: string
  let qtySub: string | null = null
  let priceStr: string

  if (isTile) {
    const tileArea    = item.tile_area_m2_snapshot ?? 1
    const tpc         = item.tiles_per_carton_snapshot ?? 1
    const m2          = item.quantity_tiles * tileArea
    const fullCartons = Math.floor(item.quantity_tiles / tpc)
    const loose       = item.quantity_tiles % tpc
    qtyMain  = `${fmtM2(m2)} m\u00b2`
    qtySub   = `${fmtNum(fullCartons)} ctn${loose > 0 ? ` + ${loose} pcs` : ''}`
    priceStr = `${fmtNum(item.unit_price_per_m2)} ${currency}/m\u00b2`
  } else {
    const unitLbl = item.unit_label || 'unite'
    const pLbl    = pluralizeUnit(unitLbl, item.quantity_tiles)
    qtyMain  = `${fmtNum(item.quantity_tiles)} ${pLbl}`
    priceStr = `${fmtNum(item.unit_price_per_m2)} ${currency}/${unitLbl}`
  }

  const rowStyle = idx % 2 === 0 ? S.tableRow : S.tableRowAlt

  return (
    <View style={rowStyle}>
      <View style={S.colDesignation}>
        <Text style={S.tdName}>{item.product_name}</Text>
        {item.reference_code ? <Text style={S.tdRef}>{item.reference_code}</Text> : null}
      </View>
      <View style={S.colQty}>
        <Text style={S.tdQtyMain}>{qtyMain}</Text>
        {qtySub ? <Text style={S.tdQtySub}>{qtySub}</Text> : null}
      </View>
      <View style={S.colPrice}>
        <Text style={S.tdPrice}>{priceStr}</Text>
      </View>
      <View style={S.colTotal}>
        <Text style={S.tdTotal}>{fmtAmt(item.total_price, currency)}</Text>
      </View>
    </View>
  )
}

// ── Payment pill ──────────────────────────────────────────────────────────────
function PaymentPill({ status }: { status: string }) {
  const cfg =
    status === 'paid'    ? { bg: GREEN_BG,  bd: GREEN,  dot: GREEN,  text: GREEN,  label: 'Sold\u00e9' } :
    status === 'partial' ? { bg: ORANGE_BG, bd: ORANGE, dot: ORANGE, text: ORANGE, label: 'Acompte vers\u00e9' } :
                           { bg: RED_BG,    bd: RED,    dot: RED,    text: RED,    label: 'Impay\u00e9' }
  return (
    <View style={[S.pillBase, { backgroundColor: cfg.bg, borderColor: cfg.bd }]}>
      <View style={[S.pillDotBase, { backgroundColor: cfg.dot }]} />
      <Text style={[S.pillTxt, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  )
}

// ── Main document ─────────────────────────────────────────────────────────────
export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const {
    doc_number, doc_type, created_at,
    company_name, currency, owner_name, logo_data_uri,
    boutique_name, boutique_phone, boutique_address,
    vendor_name,
    customer_name, customer_phone, customer_cni,
    total_amount, amount_paid, payment_status,
    items, payments,
  } = data

  const isSale  = doc_type === 'sale'
  const balance = Math.max(0, total_amount - amount_paid)
  const genDate = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <Document
      title={`${isSale ? 'Facture' : 'Devis'} ${doc_number}`}
      author={company_name}
      subject={`${isSale ? 'Facture de vente' : 'Devis estimatif'} — ${customer_name ?? 'Client'}`}
      creator={`${company_name} SGI`}
    >
      <Page size="A4" style={S.page}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={S.header}>
          <View style={S.headerLeft}>
            {logo_data_uri ? (
              <Image src={logo_data_uri} style={S.logoImg} />
            ) : (
              <View style={S.logoFallback}>
                <Text style={S.logoFallbackText}>
                  {company_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View>
              <Text style={S.companyName}>{company_name}</Text>
              <Text style={S.boutiqueName}>{boutique_name}</Text>
              {boutique_address
                ? <Text style={S.boutiqueDetail}>{boutique_address}</Text>
                : null}
              {boutique_phone
                ? <Text style={S.boutiqueDetail}>{boutique_phone}</Text>
                : null}
            </View>
          </View>
          <View style={S.headerRight}>
            <Text style={S.docNumber}>{doc_number}</Text>
            <Text style={S.docTypeLabel}>
              {isSale ? 'FACTURE DE VENTE' : 'DEVIS ESTIMATIF'}
            </Text>
            <Text style={S.docDate}>{fmtDate(created_at)}</Text>
          </View>
        </View>

        {/* ── Cognac rule ────────────────────────────────────────────────── */}
        <View style={S.rule} />

        {/* ── Quote validity notice ───────────────────────────────────────── */}
        {!isSale && (
          <View style={S.quoteNotice}>
            <Text style={S.quoteNoticeTitle}>
              {'Devis estimatif \u2014 non contractuel avant signature'}
            </Text>
            <Text style={S.quoteNoticeBody}>
              {'Ce document est valable 30 jours \u00e0 compter du ' +
               fmtDate(created_at) +
               '. Les prix sont susceptibles d\u2019\u00e9voluer. ' +
               'La vente est confirm\u00e9e uniquement apr\u00e8s signature des deux parties.'}
            </Text>
          </View>
        )}

        {/* ── Client / Vendor grid ────────────────────────────────────────── */}
        <View style={S.infoGrid}>
          <View style={S.infoColLeft}>
            <Text style={S.infoLabel}>{'CLIENT'}</Text>
            <Text style={S.infoName}>{customer_name || 'Client anonyme'}</Text>
            {customer_phone ? <Text style={S.infoSub}>{customer_phone}</Text> : null}
            {customer_cni   ? <Text style={S.infoDim}>{'CNI : ' + customer_cni}</Text> : null}
          </View>
          <View style={S.infoColRight}>
            <Text style={S.infoLabel}>{'VENDEUR'}</Text>
            <Text style={S.infoName}>{vendor_name}</Text>
            <Text style={S.infoSub}>{boutique_name}</Text>
            {boutique_phone ? <Text style={S.infoDim}>{boutique_phone}</Text> : null}
          </View>
        </View>

        {/* ── Items table ─────────────────────────────────────────────────── */}
        <View style={S.table}>
          <View style={S.tableHeader}>
            <View style={S.colDesignation}>
              <Text style={S.thText}>{'D\u00c9SIGNATION'}</Text>
            </View>
            <View style={S.colQty}>
              <Text style={S.thCenter}>{'QUANTIT\u00c9'}</Text>
            </View>
            <View style={S.colPrice}>
              <Text style={S.thRight}>{'PRIX UNIT.'}</Text>
            </View>
            <View style={S.colTotal}>
              <Text style={S.thRight}>{'TOTAL'}</Text>
            </View>
          </View>
          {items.map((item, i) => (
            <ItemRow key={i} item={item} idx={i} currency={currency} />
          ))}
        </View>

        {/* ── Totals ──────────────────────────────────────────────────────── */}
        <View style={S.totalsSection}>
          <View style={S.totalsBox}>
            {/* Sous-total + Encaissé only when a partial or full payment exists */}
            {amount_paid > 0 && (
              <View style={S.totalLineRow}>
                <Text style={S.totalLbl}>{'Sous-total'}</Text>
                <Text style={S.totalVal}>{fmtAmt(total_amount, currency)}</Text>
              </View>
            )}
            {amount_paid > 0 && (
              <View style={S.totalLineRow}>
                <Text style={S.totalLbl}>{'Encaiss\u00e9'}</Text>
                <Text style={S.totalPaid}>{fmtAmt(amount_paid, currency)}</Text>
              </View>
            )}
            {/* Reste à payer: only when there IS a partial payment and a remaining balance */}
            {amount_paid > 0 && balance > 0 && (
              <View style={S.totalLineRow}>
                <Text style={S.totalLbl}>{'Reste \u00e0 payer'}</Text>
                <Text style={S.totalRem}>{fmtAmt(balance, currency)}</Text>
              </View>
            )}
            {amount_paid > 0 && <View style={S.divider} />}
            <View style={S.grandTotalBox}>
              <Text style={S.grandTotalLbl}>{'TOTAL'}</Text>
              <Text style={S.grandTotalAmt}>{fmtAmt(total_amount, currency)}</Text>
            </View>
          </View>
        </View>

        {/* ── Payment status pill ─────────────────────────────────────────── */}
        {isSale && (
          <View style={S.pillRow}>
            <PaymentPill status={payment_status} />
          </View>
        )}

        {/* ── Payment history (only when multiple tranches recorded) ─────── */}
        {isSale && payments.length > 1 && (
          <View style={S.payHistSection}>
            <Text style={S.sectionTitle}>{'HISTORIQUE DES PAIEMENTS'}</Text>
            {payments.map((p, i) => (
              <View key={i} style={i % 2 === 0 ? S.payHistRow : S.payHistRowAlt}>
                <Text style={S.payHistDate}>
                  {fmtDate(p.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
                <Text style={S.payHistNote}>{p.notes || '\u2014'}</Text>
                <Text style={S.payHistAmt}>{fmtAmt(p.amount, currency)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Signature block ─────────────────────────────────────────────── */}
        <View style={S.sigSection}>
          <View style={S.sigColLeft}>
            <Text style={S.sigName}>{vendor_name}</Text>
            <Text style={S.sigRole}>{'Vendeur \u2014 ' + boutique_name}</Text>
            <View style={S.sigLine} />
            <Text style={S.sigSub}>{'Signature du vendeur'}</Text>
          </View>
          <View style={S.sigColRight}>
            {isSale ? (
              <>
                <Text style={S.sigName}>{owner_name}</Text>
                <Text style={S.sigRole}>{'Propri\u00e9taire \u2014 ' + company_name}</Text>
                <View style={S.sigLine} />
                <Text style={S.sigSub}>{'Signature et cachet'}</Text>
              </>
            ) : (
              <>
                <Text style={S.sigName}>{customer_name || 'Le Client'}</Text>
                <Text style={S.sigRole}>{'Acceptation du devis'}</Text>
                <View style={S.sigLine} />
                <Text style={S.sigSub}>{'Lu et approuv\u00e9 \u2014 signature du client'}</Text>
              </>
            )}
          </View>
        </View>

        {/* ── Footer (absolute) ───────────────────────────────────────────── */}
        <View style={S.footer} fixed>
          <Text style={S.footerL}>
            {'Document officiel ' + company_name + ' \u00b7 ' + doc_number}
          </Text>
          <Text style={S.footerR}>{'G\u00e9n\u00e9r\u00e9 le ' + genDate}</Text>
        </View>

      </Page>
    </Document>
  )
}

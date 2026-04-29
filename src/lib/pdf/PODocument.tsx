import React from 'react'
import { Document, Page, View, Text, Svg, Path, StyleSheet } from '@react-pdf/renderer'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PODocItem {
  product_name:   string
  reference_code: string | null
  unit_label:     string
  qty_ordered:    number
  unit_price:     number
}

export interface PODocData {
  order_number:   string
  created_at:     string
  expected_date:  string | null
  notes:          string | null
  company_name:   string
  supplier_name:  string
  supplier_contact: string | null
  supplier_phone: string | null
  supplier_email: string | null
  supplier_address: string | null
  ordered_by:     string
  currency:       string
  items:          PODocItem[]
}

// ── Palette ───────────────────────────────────────────────────────────────────

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
const AMBER_BG   = 'rgba(160,83,26,0.08)'

// ── Helpers ───────────────────────────────────────────────────────────────────

const sanitize = (s: string) => s.replace(/ /g, ' ')

const fmtNum = (n: number) =>
  sanitize(new Intl.NumberFormat('fr-FR').format(Math.round(n)))

const fmtDate = (s: string) =>
  new Date(s.length === 10 ? s + 'T12:00:00' : s).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: TEXT,
    paddingTop: 36,
    paddingBottom: 52,
    paddingLeft: 36,
    paddingRight: 36,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft:   { flexDirection: 'row', alignItems: 'flex-start' },
  logoMark:     { width: 38, height: 31, marginRight: 12 },
  companyName:  { fontSize: 20, fontFamily: 'Helvetica-Bold', color: COGNAC, letterSpacing: -0.5, marginBottom: 3 },
  boutiqueSub:  { fontSize: 8.5, color: MUTED, marginBottom: 1 },
  headerRight:  { alignItems: 'flex-end' },
  docNumber:    { fontSize: 15, fontFamily: 'Courier-Bold', color: INK, letterSpacing: 0.3, marginBottom: 2 },
  docTypeLabel: { fontSize: 7.5, color: COGNAC_DIM, letterSpacing: 1.2, marginBottom: 3 },
  docDate:      { fontSize: 9, color: TEXT },

  rule: { height: 2, backgroundColor: COGNAC, borderRadius: 1, marginBottom: 14 },

  infoGrid:    { flexDirection: 'row', marginBottom: 14 },
  infoCol:     { flex: 1, backgroundColor: SURFACE, borderRadius: 5, paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12, borderWidth: 0.5, borderColor: BORDER, borderStyle: 'solid' },
  infoColLeft: { marginRight: 10 },
  infoLabel:   { fontSize: 7, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 1.2, marginBottom: 5 },
  infoName:    { fontSize: 11, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 3 },
  infoSub:     { fontSize: 8.5, color: TEXT, marginBottom: 2 },
  infoDim:     { fontSize: 8, color: DIM },

  table:       { marginBottom: 10 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COGNAC,
    paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8,
    borderRadius: 3, marginBottom: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingTop: 7, paddingBottom: 7, paddingLeft: 8, paddingRight: 8,
    borderBottomWidth: 0.5, borderBottomColor: BORDER, borderBottomStyle: 'solid',
  },
  tableRowAlt: {
    flexDirection: 'row',
    paddingTop: 7, paddingBottom: 7, paddingLeft: 8, paddingRight: 8,
    borderBottomWidth: 0.5, borderBottomColor: BORDER, borderBottomStyle: 'solid',
    backgroundColor: STRIPE,
  },

  colDesignation: { flex: 3 },
  colQty:         { flex: 1.5 },
  colPrice:       { flex: 1.5 },
  colTotal:       { flex: 1.5 },

  thText:   { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: WHITE, letterSpacing: 0.5 },
  thRight:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: WHITE, letterSpacing: 0.5, textAlign: 'right' },
  thCenter: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: WHITE, letterSpacing: 0.5, textAlign: 'center' },

  tdName:  { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 2 },
  tdRef:   { fontSize: 7.5, fontFamily: 'Courier', color: DIM },
  tdNum:   { fontSize: 9, fontFamily: 'Courier', color: INK, textAlign: 'right' },
  tdNumBold: { fontSize: 9, fontFamily: 'Courier-Bold', color: INK, textAlign: 'right' },
  tdUnit:  { fontSize: 7.5, color: MUTED, textAlign: 'right', marginTop: 1 },
  tdCenter: { fontSize: 9, fontFamily: 'Courier', color: INK, textAlign: 'center' },

  // Total bar
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: AMBER_BG,
    borderRadius: 5,
    paddingTop: 10, paddingBottom: 10, paddingLeft: 16, paddingRight: 16,
    borderWidth: 0.75, borderColor: COGNAC, borderStyle: 'solid',
    marginBottom: 16,
  },
  totalLabel:  { fontSize: 9, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 0.5, marginRight: 16, paddingTop: 3 },
  totalAmount: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: COGNAC },
  totalCurrency: { fontSize: 9, color: COGNAC_DIM, paddingTop: 6, marginLeft: 4 },

  // Notes box
  notesBox: {
    marginBottom: 14,
    paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10,
    backgroundColor: SURFACE,
    borderRadius: 4,
    borderWidth: 0.5, borderColor: BORDER, borderStyle: 'solid',
  },
  notesLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 1.2, marginBottom: 4 },
  notesText:  { fontSize: 8.5, color: TEXT, lineHeight: 1.6 },

  // Signature block
  sigSection: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 0.5, borderTopColor: BORDER, borderTopStyle: 'solid',
  },
  sigCol:     { flex: 1, marginRight: 16 },
  sigColLast: { flex: 1 },
  sigName:    { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 2 },
  sigRole:    { fontSize: 8, color: MUTED, marginBottom: 14 },
  sigLine:    { borderBottomWidth: 1, borderBottomColor: BORDER, borderBottomStyle: 'solid', height: 40, marginBottom: 5 },
  sigSub:     { fontSize: 7.5, color: DIM },

  footer: {
    position: 'absolute', bottom: 20, left: 36, right: 36,
    borderTopWidth: 0.5, borderTopColor: BORDER, borderTopStyle: 'solid',
    paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between',
  },
  footerL: { fontSize: 7.5, color: DIM },
  footerR: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: MUTED },
})

// ── Item row ──────────────────────────────────────────────────────────────────

function POItemRow({ item, idx }: { item: PODocItem; idx: number }) {
  const rowStyle = idx % 2 === 0 ? S.tableRow : S.tableRowAlt
  const lineTotal = item.qty_ordered * item.unit_price

  return (
    <View style={rowStyle}>
      <View style={S.colDesignation}>
        <Text style={S.tdName}>{item.product_name}</Text>
        {item.reference_code ? <Text style={S.tdRef}>{item.reference_code}</Text> : null}
      </View>
      <View style={S.colQty}>
        <Text style={S.tdCenter}>
          {fmtNum(item.qty_ordered)}
        </Text>
        <Text style={[S.tdUnit, { textAlign: 'center' }]}>{item.unit_label}</Text>
      </View>
      <View style={S.colPrice}>
        <Text style={S.tdNum}>
          {item.unit_price > 0 ? fmtNum(item.unit_price) : '—'}
        </Text>
      </View>
      <View style={S.colTotal}>
        <Text style={S.tdNumBold}>
          {item.unit_price > 0 ? fmtNum(lineTotal) : '—'}
        </Text>
      </View>
    </View>
  )
}

// ── Main document ─────────────────────────────────────────────────────────────

export function PODocument({ data }: { data: PODocData }) {
  const total = data.items.reduce((s, i) => s + i.qty_ordered * i.unit_price, 0)
  const genDate = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <Document
      title={`BC ${data.order_number}`}
      author={data.company_name}
      subject={`Bon de commande — ${data.supplier_name}`}
      creator={`${data.company_name} SGI`}
    >
      <Page size="A4" style={S.page}>

        {/* ── Header ── */}
        <View style={S.header}>
          <View style={S.headerLeft}>
            <Svg viewBox="0 0 20 16" style={S.logoMark}>
              <Path d="M2.5 14V2.5L10 9L17.5 2.5V14" stroke={COGNAC} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
              <Path d="M2.5 14h15"                    stroke={COGNAC} strokeWidth="2.3" strokeLinecap="round"/>
            </Svg>
            <View>
              <Text style={S.companyName}>{data.company_name}</Text>
              <Text style={S.boutiqueSub}>{'Bon de commande fournisseur'}</Text>
            </View>
          </View>
          <View style={S.headerRight}>
            <Text style={S.docNumber}>{data.order_number}</Text>
            <Text style={S.docTypeLabel}>{'BON DE COMMANDE'}</Text>
            <Text style={S.docDate}>{'Émis le ' + fmtDate(data.created_at)}</Text>
            {data.expected_date && (
              <Text style={[S.docDate, { color: COGNAC_DIM, marginTop: 2 }]}>
                {'Livraison prévue : ' + fmtDate(data.expected_date)}
              </Text>
            )}
          </View>
        </View>

        {/* ── Cognac rule ── */}
        <View style={S.rule} />

        {/* ── Info grid: Fournisseur | Commande ── */}
        <View style={S.infoGrid}>
          <View style={[S.infoCol, S.infoColLeft]}>
            <Text style={S.infoLabel}>{'FOURNISSEUR'}</Text>
            <Text style={S.infoName}>{data.supplier_name}</Text>
            {data.supplier_contact ? <Text style={S.infoSub}>{data.supplier_contact}</Text> : null}
            {data.supplier_phone   ? <Text style={S.infoSub}>{data.supplier_phone}</Text>   : null}
            {data.supplier_email   ? <Text style={S.infoDim}>{data.supplier_email}</Text>   : null}
            {data.supplier_address ? <Text style={S.infoDim}>{data.supplier_address}</Text> : null}
          </View>
          <View style={S.infoCol}>
            <Text style={S.infoLabel}>{'COMMANDÉ PAR'}</Text>
            <Text style={S.infoName}>{data.company_name}</Text>
            <Text style={S.infoSub}>{data.ordered_by}</Text>
            <Text style={[S.infoDim, { marginTop: 6 }]}>{'Référence : ' + data.order_number}</Text>
            <Text style={S.infoDim}>{'Date : ' + fmtDate(data.created_at)}</Text>
            {data.expected_date && (
              <Text style={S.infoDim}>{'Livraison souhaitée : ' + fmtDate(data.expected_date)}</Text>
            )}
          </View>
        </View>

        {/* ── Items table ── */}
        <View style={S.table}>
          <View style={S.tableHeader}>
            <View style={S.colDesignation}>
              <Text style={S.thText}>{'DÉSIGNATION'}</Text>
            </View>
            <View style={S.colQty}>
              <Text style={S.thCenter}>{'QUANTITÉ'}</Text>
            </View>
            <View style={S.colPrice}>
              <Text style={S.thRight}>{'PRIX UNITAIRE'}</Text>
            </View>
            <View style={S.colTotal}>
              <Text style={S.thRight}>{'TOTAL'}</Text>
            </View>
          </View>
          {data.items.map((item, i) => (
            <POItemRow key={i} item={item} idx={i} />
          ))}
        </View>

        {/* ── Total bar ── */}
        <View style={S.totalBar}>
          <Text style={S.totalLabel}>{'TOTAL ESTIMÉ'}</Text>
          <Text style={S.totalAmount}>{fmtNum(total)}</Text>
          <Text style={S.totalCurrency}>{data.currency}</Text>
        </View>

        {/* ── Notes ── */}
        {data.notes && (
          <View style={S.notesBox}>
            <Text style={S.notesLabel}>{'NOTES / CONDITIONS'}</Text>
            <Text style={S.notesText}>{data.notes}</Text>
          </View>
        )}

        {/* ── Signature block ── */}
        <View style={S.sigSection}>
          <View style={S.sigCol}>
            <Text style={S.sigName}>{data.ordered_by}</Text>
            <Text style={S.sigRole}>{'Responsable achats — ' + data.company_name}</Text>
            <View style={S.sigLine} />
            <Text style={S.sigSub}>{'Commandé par — signature'}</Text>
          </View>
          <View style={S.sigColLast}>
            <Text style={S.sigName}>{data.supplier_name}</Text>
            <Text style={S.sigRole}>{'Accusé de réception fournisseur'}</Text>
            <View style={S.sigLine} />
            <Text style={S.sigSub}>{'Cachet + signature + date'}</Text>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={S.footer} fixed>
          <Text style={S.footerL}>
            {'Bon de commande ' + data.order_number + ' · ' + data.company_name + ' → ' + data.supplier_name}
          </Text>
          <Text style={S.footerR}>{'Généré le ' + sanitize(genDate)}</Text>
        </View>

      </Page>
    </Document>
  )
}


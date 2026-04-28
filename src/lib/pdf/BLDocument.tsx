import React from 'react'
import { Document, Page, View, Text, Svg, Path, StyleSheet } from '@react-pdf/renderer'
import type { BLData, BLItem } from './types'
import { pluralize } from '@/lib/pluralize'

// ── Palette (shared with InvoiceDocument) ────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
const sanitize = (s: string) => s.replace(/ /g, ' ')

const fmtNum  = (n: number) =>
  sanitize(new Intl.NumberFormat('fr-FR').format(Math.round(n)))
const fmtM2   = (n: number) =>
  sanitize(
    new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(n),
  )
const fmtDate = (s: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(s).toLocaleDateString('fr-FR', opts ?? {
    day: 'numeric', month: 'long', year: 'numeric',
  })

const pluralizeUnit = (label: string, count: number) =>
  label.length <= 2 ? label : pluralize(label, count)

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

  // ── Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'flex-start' },
  logoMark:   { width: 38, height: 31, marginRight: 12 },
  companyName: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: COGNAC,
    letterSpacing: -0.5,
    marginBottom: 3,
  },
  boutiqueName:   { fontSize: 8.5, color: MUTED, marginBottom: 1 },
  boutiqueDetail: { fontSize: 8, color: DIM },
  headerRight:    { alignItems: 'flex-end' },
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
  deliveryDate: { fontSize: 9, color: TEXT },

  // ── Cognac rule
  rule: {
    height: 2,
    backgroundColor: COGNAC,
    borderRadius: 1,
    marginBottom: 14,
  },

  // ── Info grid (client | sale reference)
  infoGrid: { flexDirection: 'row', marginBottom: 14 },
  infoCol: {
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
  infoColLeft:  { marginRight: 10 },
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
  infoSub: { fontSize: 8.5, color: TEXT, marginBottom: 2 },
  infoDim: { fontSize: 8, color: DIM },

  // ── Items table
  table:       { marginBottom: 10 },
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
  colCond:        { flex: 2 },
  colQty:         { flex: 2 },
  thText: {
    fontSize: 7.5, fontFamily: 'Helvetica-Bold',
    color: WHITE, letterSpacing: 0.5,
  },
  thCenter: {
    fontSize: 7.5, fontFamily: 'Helvetica-Bold',
    color: WHITE, letterSpacing: 0.5, textAlign: 'center',
  },
  thRight: {
    fontSize: 7.5, fontFamily: 'Helvetica-Bold',
    color: WHITE, letterSpacing: 0.5, textAlign: 'right',
  },
  tdName: {
    fontSize: 9.5, fontFamily: 'Helvetica-Bold',
    color: INK, marginBottom: 2,
  },
  tdRef: {
    fontSize: 7.5, fontFamily: 'Courier', color: DIM,
  },
  tdCondMain: {
    fontSize: 9, fontFamily: 'Helvetica-Bold',
    color: INK, textAlign: 'center', marginBottom: 1,
  },
  tdCondSub: {
    fontSize: 7.5, color: MUTED, textAlign: 'center',
  },
  tdQtyMain: {
    fontSize: 9, fontFamily: 'Helvetica-Bold',
    color: INK, textAlign: 'right',
  },
  tdQtySub: {
    fontSize: 7.5, color: MUTED, textAlign: 'right',
  },

  // ── Summary bar
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    backgroundColor: GREEN_BG,
    borderRadius: 5,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 12,
    paddingRight: 12,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: GREEN,
    borderStyle: 'solid',
  },
  summaryItem: { alignItems: 'center' },
  summaryVal: {
    fontSize: 11, fontFamily: 'Helvetica-Bold',
    color: INK, marginBottom: 1,
  },
  summaryLbl: { fontSize: 7, color: MUTED, letterSpacing: 0.8 },

  // ── Signature block
  sigSection: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    borderTopStyle: 'solid',
  },
  sigCol:       { flex: 1, marginRight: 14 },
  sigColLast:   { flex: 1 },
  sigName: {
    fontSize: 9.5, fontFamily: 'Helvetica-Bold',
    color: INK, marginBottom: 2,
  },
  sigRole: { fontSize: 8, color: MUTED, marginBottom: 14 },
  sigLine: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderBottomStyle: 'solid',
    height: 42,
    marginBottom: 5,
  },
  sigSub: { fontSize: 7.5, color: DIM },

  // ── Notice
  notice: {
    marginTop: 12,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 10,
    paddingRight: 10,
    backgroundColor: SURFACE,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderStyle: 'solid',
  },
  noticeText: { fontSize: 7.5, color: DIM, lineHeight: 1.6 },

  // ── Footer (absolute)
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
function BLItemRow({ item, idx }: { item: BLItem; idx: number }) {
  const isTile = (item.product_type ?? 'tile') === 'tile'
  let condMain: string
  let condSub:  string | null = null
  let qtyMain:  string
  let qtySub:   string | null = null

  if (isTile) {
    const tileArea    = item.tile_area_m2_snapshot ?? 1
    const tpc         = item.tiles_per_carton_snapshot ?? 1
    const fullCartons = Math.floor(item.quantity_tiles / tpc)
    const loose       = item.quantity_tiles % tpc
    const m2          = item.quantity_tiles * tileArea
    condMain = `${fmtNum(fullCartons)} carton${fullCartons !== 1 ? 's' : ''}`
    condSub  = loose > 0 ? `+ ${loose} pièce${loose > 1 ? 's' : ''}` : null
    qtyMain  = `${fmtM2(m2)} m²`
    qtySub   = `${fmtNum(item.quantity_tiles)} pc${item.quantity_tiles > 1 ? 's' : ''}`
  } else {
    const unitLbl = item.unit_label || 'unité'
    const pLbl    = pluralizeUnit(unitLbl, item.quantity_tiles)
    condMain = `${fmtNum(item.quantity_tiles)} ${pLbl}`
    qtyMain  = '—'
  }

  const rowStyle = idx % 2 === 0 ? S.tableRow : S.tableRowAlt

  return (
    <View style={rowStyle}>
      <View style={S.colDesignation}>
        <Text style={S.tdName}>{item.product_name}</Text>
        {item.reference_code ? <Text style={S.tdRef}>{item.reference_code}</Text> : null}
      </View>
      <View style={S.colCond}>
        <Text style={S.tdCondMain}>{condMain}</Text>
        {condSub ? <Text style={S.tdCondSub}>{condSub}</Text> : null}
      </View>
      <View style={S.colQty}>
        <Text style={S.tdQtyMain}>{qtyMain}</Text>
        {qtySub ? <Text style={S.tdQtySub}>{qtySub}</Text> : null}
      </View>
    </View>
  )
}

// ── Main document ─────────────────────────────────────────────────────────────
export function BLDocument({ data }: { data: BLData }) {
  const {
    order_number, sale_number, sale_created_at, delivery_date,
    company_name, logo_data_uri,
    boutique_name, boutique_address, boutique_phone,
    vendor_name, prepared_by,
    customer_name, customer_phone, customer_cni,
    items, order_notes,
  } = data

  // Summary aggregates
  let totalM2       = 0
  let totalCartons  = 0
  let totalLoose    = 0
  let hasTiles      = false
  for (const item of items) {
    if ((item.product_type ?? 'tile') === 'tile' && item.tile_area_m2_snapshot && item.tiles_per_carton_snapshot) {
      hasTiles     = true
      totalM2     += item.quantity_tiles * item.tile_area_m2_snapshot
      totalCartons += Math.floor(item.quantity_tiles / item.tiles_per_carton_snapshot)
      totalLoose   += item.quantity_tiles % item.tiles_per_carton_snapshot
    }
  }

  const delivererName = prepared_by ?? vendor_name
  const genDate = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <Document
      title={`BL ${order_number}`}
      author={company_name}
      subject={`Bon de livraison — ${customer_name ?? 'Client'}`}
      creator={`${company_name} SGI`}
    >
      <Page size="A4" style={S.page}>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <View style={S.header}>
          <View style={S.headerLeft}>
            <Svg viewBox="0 0 20 16" style={S.logoMark}>
              <Path
                d="M2.5 14V2.5L10 9L17.5 2.5V14"
                stroke={COGNAC} strokeWidth="2.3"
                strokeLinecap="round" strokeLinejoin="round"
              />
              <Path
                d="M2.5 14h15"
                stroke={COGNAC} strokeWidth="2.3"
                strokeLinecap="round"
              />
            </Svg>
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
            <Text style={S.docNumber}>{order_number}</Text>
            <Text style={S.docTypeLabel}>{'BON DE LIVRAISON'}</Text>
            <Text style={S.deliveryDate}>
              {delivery_date
                ? `Livré le ${fmtDate(delivery_date)}`
                : `Édité le ${fmtDate(new Date().toISOString())}`}
            </Text>
          </View>
        </View>

        {/* ── Cognac rule ───────────────────────────────────────────────────── */}
        <View style={S.rule} />

        {/* ── Client + Sale reference grid ──────────────────────────────────── */}
        <View style={S.infoGrid}>
          <View style={[S.infoCol, S.infoColLeft]}>
            <Text style={S.infoLabel}>{'CLIENT'}</Text>
            <Text style={S.infoName}>{customer_name || 'Client anonyme'}</Text>
            {customer_phone ? <Text style={S.infoSub}>{customer_phone}</Text> : null}
            {customer_cni   ? <Text style={S.infoDim}>{'CNI : ' + customer_cni}</Text> : null}
          </View>
          <View style={S.infoCol}>
            <Text style={S.infoLabel}>{'RÉFÉRENCE VENTE'}</Text>
            <Text style={S.infoName}>{sale_number}</Text>
            <Text style={S.infoSub}>{'Vendeur : ' + vendor_name}</Text>
            <Text style={S.infoDim}>
              {'Date vente : ' + fmtDate(sale_created_at, { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
            {order_notes
              ? <Text style={[S.infoDim, { marginTop: 4 }]}>
                  {'Note : ' + order_notes}
                </Text>
              : null}
          </View>
        </View>

        {/* ── Items table ───────────────────────────────────────────────────── */}
        <View style={S.table}>
          <View style={S.tableHeader}>
            <View style={S.colDesignation}>
              <Text style={S.thText}>{'DÉSIGNATION'}</Text>
            </View>
            <View style={S.colCond}>
              <Text style={S.thCenter}>{'CONDITIONNEMENT'}</Text>
            </View>
            <View style={S.colQty}>
              <Text style={S.thRight}>{'SURFACE / QTÉ'}</Text>
            </View>
          </View>
          {items.map((item, i) => (
            <BLItemRow key={i} item={item} idx={i} />
          ))}
        </View>

        {/* ── Summary bar ───────────────────────────────────────────────────── */}
        <View style={S.summaryBar}>
          <View style={S.summaryItem}>
            <Text style={S.summaryVal}>{items.length}</Text>
            <Text style={S.summaryLbl}>{'RÉFÉRENCE(S)'}</Text>
          </View>
          {hasTiles && (
            <>
              <View style={S.summaryItem}>
                <Text style={S.summaryVal}>
                  {totalCartons > 0
                    ? `${fmtNum(totalCartons)} ctn${totalLoose > 0 ? ` + ${totalLoose} pcs` : ''}`
                    : `${totalLoose} pcs`}
                </Text>
                <Text style={S.summaryLbl}>{'CONDITIONNEMENT'}</Text>
              </View>
              <View style={S.summaryItem}>
                <Text style={S.summaryVal}>{`${fmtM2(totalM2)} m²`}</Text>
                <Text style={S.summaryLbl}>{'SURFACE TOTALE'}</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Signature block ───────────────────────────────────────────────── */}
        <View style={S.sigSection}>
          {/* Col 1: Delivered by */}
          <View style={S.sigCol}>
            <Text style={S.sigName}>{delivererName}</Text>
            <Text style={S.sigRole}>
              {prepared_by ? 'Magasinier — ' + boutique_name : 'Vendeur — ' + boutique_name}
            </Text>
            <View style={S.sigLine} />
            <Text style={S.sigSub}>{'Livré par — signature'}</Text>
          </View>
          {/* Col 2: Received by client */}
          <View style={S.sigCol}>
            <Text style={S.sigName}>{customer_name || 'Le Client'}</Text>
            <Text style={S.sigRole}>{'Réception des marchandises'}</Text>
            <View style={S.sigLine} />
            <Text style={S.sigSub}>{'Reçu en bon état — signature + date'}</Text>
          </View>
          {/* Col 3: Company stamp */}
          <View style={S.sigColLast}>
            <Text style={S.sigName}>{company_name}</Text>
            <Text style={S.sigRole}>{'Cachet et visa'}</Text>
            <View style={S.sigLine} />
            <Text style={S.sigSub}>{'Tampon officiel'}</Text>
          </View>
        </View>

        {/* ── Legal notice ──────────────────────────────────────────────────── */}
        <View style={S.notice}>
          <Text style={S.noticeText}>
            {'Toute réclamation relative à un manque, une avarie visible ou un défaut de conformité doit être '
            + 'signalée dans les 48 heures suivant la réception des marchandises. Passé ce délai, les marchandises '
            + 'sont réputées livrées conformes et acceptées sans réserve.'}
          </Text>
        </View>

        {/* ── Footer (absolute) ─────────────────────────────────────────────── */}
        <View style={S.footer} fixed>
          <Text style={S.footerL}>
            {'Bon de livraison ' + company_name + ' · Vente ' + sale_number}
          </Text>
          <Text style={S.footerR}>{'Généré le ' + genDate}</Text>
        </View>

      </Page>
    </Document>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter }                from 'next/navigation'
import PageLayout                   from '@/components/PageLayout'
import { createClient }             from '@/lib/supabase/client'
import { C, F, SP, R, SH, TR }     from '@/lib/design-system/tokens'
import type { BadgeCounts }         from '@/lib/supabase/badge-counts'
import { confirmDelivery, reportDeliveryIssue } from './actions'

const ISSUE_REASONS = [
  { value: 'absent',    label: 'Client absent' },
  { value: 'refus',     label: 'Refus de réception' },
  { value: 'adresse',   label: 'Mauvaise adresse' },
  { value: 'article',   label: 'Article endommagé' },
  { value: 'paiement',  label: 'Paiement refusé' },
  { value: 'autre',     label: 'Autre' },
]

function fmtCurrency(n: number, currency: string) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' ' + currency
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    ready:     { label: 'Prête',    bg: C.blueBg,   color: C.blue   },
    delivered: { label: 'Livrée',   bg: C.greenBg,  color: C.green  },
  }
  const s = map[status] ?? { label: status, bg: C.surfaceSub, color: C.muted }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: `2px 10px`, borderRadius: 99,
      fontSize: F.xs, fontWeight: 700, letterSpacing: '0.03em',
      background: s.bg, color: s.color,
      fontFamily: F.body,
    }}>
      {s.label}
    </span>
  )
}

function IconTruck() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1" y="5" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M12 7h3l2 3v3h-5V7Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <circle cx="4.5" cy="13.5" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="13.5" cy="13.5" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  )
}

function IconBox() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="5" width="12" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M2 5L8 2l6 3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="1.3"/>
      <line x1="5" y1="7.5" x2="11" y2="7.5" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  )
}

export default function DeliveriesClient({
  profile,
  currency,
  companyName,
  orders,
  badgeCounts,
}: {
  profile:      any
  currency:     string
  companyName:  string
  orders:       any[]
  badgeCounts:  BadgeCounts
}) {
  const router   = useRouter()
  const supabase = createClient()
  const fmt      = (n: number) => fmtCurrency(n, currency)
  const isOwner  = ['owner', 'manager', 'warehouse'].includes(profile.role)

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login') }

  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [confirmId,    setConfirmId]    = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [confirming,   startConfirm]   = useTransition()
  const [issueId,      setIssueId]      = useState<string | null>(null)
  const [issueReason,  setIssueReason]  = useState('absent')
  const [issueNotes,   setIssueNotes]   = useState('')
  const [issueLoading, setIssueLoading] = useState(false)
  const [issueError,   setIssueError]   = useState<string | null>(null)

  const handleConfirm = (orderId: string) => {
    setConfirmError(null)
    startConfirm(async () => {
      const res = await confirmDelivery(orderId)
      if (res.error) { setConfirmError(res.error); return }
      setConfirmId(null)
      router.refresh()
    })
  }

  const handleIssueSubmit = async (orderId: string) => {
    setIssueLoading(true)
    setIssueError(null)
    const res = await reportDeliveryIssue(orderId, issueReason, issueNotes.trim())
    setIssueLoading(false)
    if (res.error) { setIssueError(res.error); return }
    setIssueId(null)
    setIssueReason('absent')
    setIssueNotes('')
  }

  return (
    <PageLayout profile={profile} activeRoute="/deliveries" onLogout={handleLogout} badgeCounts={badgeCounts}>
      <div className="fade-in-up" style={{
        maxWidth: 720, margin: '0 auto', padding: `${SP[8]} ${SP[6]}`,
      }}>

        {/* Header */}
        <div style={{ marginBottom: SP[8] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SP[3], marginBottom: SP[2] }}>
            <div style={{
              width: 40, height: 40, borderRadius: R.md,
              background: C.amberGlow, color: C.amber,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconTruck />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: F['2xl'], fontWeight: 700, color: C.ink, fontFamily: F.display, lineHeight: 1.15 }}>
                {profile.role === 'delivery' ? 'Mes livraisons' : 'Livraisons'}
              </h1>
              <p style={{ margin: 0, fontSize: F.sm, color: C.muted, fontFamily: F.body }}>
                {orders.length} commande{orders.length !== 1 ? 's' : ''} prête{orders.length !== 1 ? 's' : ''} à livrer
              </p>
            </div>
          </div>
        </div>

        {/* Empty state */}
        {orders.length === 0 && (
          <div style={{
            textAlign: 'center', padding: `${SP[12]} ${SP[6]}`,
            background: C.surface, borderRadius: R.lg,
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ color: C.amber, marginBottom: SP[3], display: 'flex', justifyContent: 'center' }}>
              <IconTruck />
            </div>
            <p style={{ margin: 0, fontSize: F.base, fontWeight: 600, color: C.text, fontFamily: F.body }}>
              Aucune livraison en attente
            </p>
            <p style={{ margin: `${SP[2]} 0 0`, fontSize: F.sm, color: C.muted, fontFamily: F.body }}>
              Les commandes prêtes à livrer apparaîtront ici.
            </p>
          </div>
        )}

        {/* Orders list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SP[3] }}>
          {orders.map((order: any) => {
            const sale    = order.sales
            const isOpen  = expanded === order.id
            const items   = sale?.sale_items ?? []
            const itemCount = items.reduce((s: number, i: any) => s + Number(i.quantity_tiles), 0)

            return (
              <div key={order.id} style={{
                background: C.surface, borderRadius: R.lg,
                border: `1px solid ${C.border}`,
                boxShadow: SH.sm,
                overflow: 'hidden',
                transition: TR.base,
              }}>
                {/* Card header — tap to expand detail */}
                <div
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                  style={{
                    padding: `${SP[4]} ${SP[5]}`,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: SP[3],
                    borderLeft: `4px solid ${order.status === 'ready' ? C.amber : C.muted}`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: SP[2], marginBottom: SP[1] }}>
                      <span style={{ fontSize: F.base, fontWeight: 700, color: C.ink, fontFamily: F.mono }}>
                        {order.order_number}
                      </span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p style={{ margin: 0, fontSize: F.sm, fontWeight: 600, color: C.text, fontFamily: F.body }}>
                      {sale?.customer_name ?? 'Client non spécifié'}
                    </p>
                    {sale?.customer_phone && (
                      <a href={`tel:${sale.customer_phone}`} onClick={e => e.stopPropagation()} style={{
                        fontSize: F.xs, color: C.amber, fontFamily: F.body,
                        textDecoration: 'none', fontWeight: 600,
                      }}>
                        {sale.customer_phone}
                      </a>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ margin: 0, fontSize: F.sm, fontWeight: 700, color: C.ink, fontFamily: F.body }}>
                      {fmt(sale?.total_amount ?? 0)}
                    </p>
                    <p style={{ margin: `${SP[1]} 0 0`, fontSize: F.xs, color: C.muted, fontFamily: F.body }}>
                      {itemCount} article{itemCount !== 1 ? 's' : ''}
                      {' '}
                      <span style={{ opacity: 0.6 }}>{isOpen ? '▲' : '▼'}</span>
                    </p>
                  </div>
                </div>

                {/* Confirm action — always visible for ready orders */}
                {order.status === 'ready' && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      padding: `${SP[3]} ${SP[5]}`,
                      borderTop: `1px solid ${C.borderSub}`,
                      background: C.amberGlow,
                    }}
                  >
                    {issueId === order.id ? (
                      <div>
                        <p style={{ margin: `0 0 ${SP[2]}`, fontSize: F.sm, fontWeight: 600, color: C.red, fontFamily: F.body }}>
                          Signaler un problème de livraison
                        </p>
                        <div style={{ display: 'flex', gap: SP[2], marginBottom: SP[2], flexWrap: 'wrap' }}>
                          {ISSUE_REASONS.map(r => (
                            <button
                              key={r.value}
                              onClick={() => setIssueReason(r.value)}
                              style={{
                                padding: `${SP[1]} ${SP[3]}`, borderRadius: R.full,
                                fontSize: F.xs, fontWeight: 600, cursor: 'pointer',
                                fontFamily: F.body, border: `1.5px solid ${issueReason === r.value ? C.red : C.border}`,
                                background: issueReason === r.value ? C.redBg : C.surface,
                                color: issueReason === r.value ? C.red : C.muted,
                              }}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                        <textarea
                          placeholder="Détails supplémentaires (optionnel)…"
                          value={issueNotes}
                          onChange={e => setIssueNotes(e.target.value)}
                          rows={2}
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            marginBottom: SP[2], padding: `${SP[2]} ${SP[3]}`,
                            borderRadius: R.md, border: `1.5px solid ${C.border}`,
                            fontSize: F.sm, fontFamily: F.body, color: C.text,
                            background: C.surface, resize: 'none', outline: 'none',
                          }}
                        />
                        {issueError && (
                          <p style={{ margin: `0 0 ${SP[2]}`, fontSize: F.xs, color: C.red, fontFamily: F.body }}>
                            {issueError}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: SP[2] }}>
                          <button
                            onClick={() => { setIssueId(null); setIssueError(null) }}
                            style={{
                              flex: 1, padding: `${SP[2]} ${SP[4]}`, borderRadius: R.md,
                              border: `1.5px solid ${C.border}`, background: C.surface,
                              fontSize: F.sm, fontWeight: 600, color: C.text,
                              cursor: 'pointer', fontFamily: F.body,
                            }}>
                            Annuler
                          </button>
                          <button
                            onClick={() => handleIssueSubmit(order.id)}
                            disabled={issueLoading}
                            style={{
                              flex: 2, padding: `${SP[2]} ${SP[4]}`, borderRadius: R.md,
                              border: 'none', background: C.red, color: '#fff',
                              fontSize: F.sm, fontWeight: 700,
                              cursor: issueLoading ? 'not-allowed' : 'pointer', fontFamily: F.body,
                              opacity: issueLoading ? 0.7 : 1,
                            }}>
                            {issueLoading ? 'Envoi…' : 'Envoyer le signalement'}
                          </button>
                        </div>
                      </div>
                    ) : confirmId === order.id ? (
                      <div>
                        <p style={{ margin: `0 0 ${SP[2]}`, fontSize: F.sm, fontWeight: 600, color: C.amber, fontFamily: F.body }}>
                          Confirmer la livraison de cette commande ?
                        </p>
                        {confirmError && (
                          <p style={{ margin: `0 0 ${SP[2]}`, fontSize: F.sm, color: C.red, fontFamily: F.body }}>
                            {confirmError}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: SP[2] }}>
                          <button
                            onClick={() => { setConfirmId(null); setConfirmError(null) }}
                            style={{
                              flex: 1, padding: `${SP[2]} ${SP[4]}`, borderRadius: R.md,
                              border: `1.5px solid ${C.border}`, background: C.surface,
                              fontSize: F.sm, fontWeight: 600, color: C.text,
                              cursor: 'pointer', fontFamily: F.body,
                            }}>
                            Annuler
                          </button>
                          <button
                            disabled={confirming}
                            onClick={() => handleConfirm(order.id)}
                            style={{
                              flex: 2, padding: `${SP[2]} ${SP[4]}`, borderRadius: R.md,
                              border: 'none', background: C.green,
                              fontSize: F.sm, fontWeight: 700, color: '#fff',
                              cursor: confirming ? 'not-allowed' : 'pointer', fontFamily: F.body,
                              opacity: confirming ? 0.7 : 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SP[1],
                            }}>
                            <IconTruck />
                            {confirming ? 'Confirmation…' : 'Oui, livraison confirmée'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: SP[2] }}>
                        <button
                          onClick={() => { setConfirmId(order.id); setConfirmError(null) }}
                          style={{
                            flex: 3, padding: `${SP[3]} ${SP[4]}`,
                            borderRadius: R.md, border: 'none',
                            background: C.amber, color: '#FAF5EE',
                            fontSize: F.base, fontWeight: 700,
                            cursor: 'pointer', fontFamily: F.body,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SP[2],
                          }}>
                          <IconTruck />
                          Confirmer la livraison
                        </button>
                        <button
                          onClick={() => { setIssueId(order.id); setIssueReason('absent'); setIssueNotes(''); setIssueError(null) }}
                          title="Signaler un problème"
                          style={{
                            flex: 1, padding: `${SP[3]} ${SP[3]}`,
                            borderRadius: R.md, border: `1.5px solid ${C.redBd}`,
                            background: C.redBg, color: C.red,
                            fontSize: F.xs, fontWeight: 700,
                            cursor: 'pointer', fontFamily: F.body,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SP[1],
                          }}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M6 1L11 10H1L6 1Z" stroke={C.red} strokeWidth="1.2" strokeLinejoin="round"/>
                            <path d="M6 5v2.5" stroke={C.red} strokeWidth="1.2" strokeLinecap="round"/>
                            <circle cx="6" cy="9" r="0.5" fill={C.red}/>
                          </svg>
                          Problème
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Expanded detail — items + notes */}
                {isOpen && (
                  <div style={{
                    borderTop: `1px solid ${C.borderSub}`,
                    padding: `${SP[4]} ${SP[5]}`,
                    background: C.bg,
                  }}>
                    <div style={{ marginBottom: sale?.notes ? SP[4] : 0 }}>
                      <p style={{ margin: `0 0 ${SP[2]}`, fontSize: F.xs, fontWeight: 700, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: F.body }}>
                        Articles
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: SP[2] }}>
                        {items.map((item: any) => (
                          <div key={item.id} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: `${SP[2]} ${SP[3]}`,
                            background: C.surface, borderRadius: R.sm,
                            border: `1px solid ${C.borderSub}`,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: SP[2], color: C.muted }}>
                              <IconBox />
                              <span style={{ fontSize: F.sm, color: C.text, fontFamily: F.body }}>
                                {item.products?.name ?? '—'}
                              </span>
                            </div>
                            <span style={{ fontSize: F.sm, fontWeight: 600, color: C.text, fontFamily: F.mono }}>
                              {item.quantity_tiles} {item.products?.unit_label ?? 'unité(s)'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {sale?.notes && (
                      <div>
                        <p style={{ margin: `0 0 ${SP[1]}`, fontSize: F.xs, fontWeight: 700, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: F.body }}>
                          Notes
                        </p>
                        <p style={{ margin: 0, fontSize: F.sm, color: C.text, fontFamily: F.body, fontStyle: 'italic' }}>
                          {sale.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </PageLayout>
  )
}

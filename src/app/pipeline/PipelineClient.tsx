'use client'

import { useState }             from 'react'
import { useRouter }            from 'next/navigation'
import Link                     from 'next/link'
import PageLayout               from '@/components/PageLayout'
import { createClient }         from '@/lib/supabase/client'
import { C, F, SP, R, SH, TR } from '@/lib/design-system/tokens'
import type { BadgeCounts }     from '@/lib/supabase/badge-counts'

function fmtCurrency(n: number, currency: string) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' ' + currency
}

const STATUS_MAP: Record<string, { label: string; bg: string; color: string; bd: string }> = {
  draft:     { label: 'Devis',     bg: C.goldBg,   color: C.gold,   bd: C.goldBd   },
  confirmed: { label: 'Confirmé',  bg: C.greenBg,  color: C.green,  bd: C.greenBd  },
  cancelled: { label: 'Annulé',    bg: C.redBg,    color: C.red,    bd: C.redBd    },
  preparing: { label: 'En cours',  bg: C.blueBg,   color: C.blue,   bd: C.blueBd   },
  ready:     { label: 'Prêt',      bg: C.orangeBg, color: C.orange, bd: C.orangeBd },
  delivered: { label: 'Livré',     bg: C.greenBg,  color: C.green,  bd: C.greenBd  },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, bg: C.surfaceSub, color: C.muted, bd: C.borderSub }
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

function IconPipeline() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1" y="3" width="16" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="1" y="7.5" width="10" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="1" y="12" width="14" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <line x1="7" y1="2" x2="7" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

export default function PipelineClient({
  profile,
  currency,
  companyName,
  quotes,
  boutiques,
  badgeCounts,
}: {
  profile:     any
  currency:    string
  companyName: string
  quotes:      any[]
  boutiques:   any[]
  badgeCounts: BadgeCounts
}) {
  const router       = useRouter()
  const supabase     = createClient()
  const fmt          = (n: number) => fmtCurrency(n, currency)
  const isManagement = ['owner', 'manager'].includes(profile.role)
  const isFieldAgent = profile.role === 'field_agent'

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login') }

  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all'
    ? quotes
    : quotes.filter(q => q.status === filter)

  const stats = {
    total:     quotes.length,
    draft:     quotes.filter(q => q.status === 'draft').length,
    confirmed: quotes.filter(q => q.status === 'confirmed').length,
    cancelled: quotes.filter(q => q.status === 'cancelled').length,
  }

  return (
    <PageLayout profile={profile} activeRoute="/pipeline" onLogout={handleLogout} badgeCounts={badgeCounts}>
      <div className="fade-in-up" style={{
        maxWidth: 800, margin: '0 auto', padding: `${SP[8]} ${SP[6]}`,
      }}>

        {/* Header */}
        <div style={{ marginBottom: SP[8], display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: SP[4] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SP[3] }}>
            <div style={{
              width: 40, height: 40, borderRadius: R.md,
              background: C.amberGlow, color: C.amber,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconPipeline />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: F['2xl'], fontWeight: 700, color: C.ink, fontFamily: F.display, lineHeight: 1.15 }}>
                {isFieldAgent ? 'Mon pipeline' : 'Pipeline commercial'}
              </h1>
              <p style={{ margin: 0, fontSize: F.sm, color: C.muted, fontFamily: F.body }}>
                {stats.total} devis · {stats.draft} en attente · {stats.confirmed} confirmés
              </p>
            </div>
          </div>
          <Link href="/quotes/new" style={{ textDecoration: 'none' }}>
            <button className="btn-amber" style={{
              display: 'inline-flex', alignItems: 'center', gap: SP[2],
              padding: `${SP[2]} ${SP[4]}`, whiteSpace: 'nowrap',
            }}>
              <IconPlus />
              Nouveau devis
            </button>
          </Link>
        </div>

        {/* Stats strip */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: SP[3],
          marginBottom: SP[6],
        }}>
          {[
            { key: 'draft',     label: 'En attente', value: stats.draft,     bg: C.goldBg,   color: C.gold  },
            { key: 'confirmed', label: 'Confirmés',  value: stats.confirmed, bg: C.greenBg,  color: C.green },
            { key: 'cancelled', label: 'Annulés',    value: stats.cancelled, bg: C.redBg,    color: C.red   },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setFilter(filter === s.key ? 'all' : s.key)}
              style={{
                padding: SP[4], borderRadius: R.md, cursor: 'pointer',
                background: filter === s.key ? s.bg : C.surface,
                border: `1.5px solid ${filter === s.key ? s.color : C.border}`,
                textAlign: 'left', transition: TR.base,
              }}>
              <p style={{ margin: 0, fontSize: F['2xl'], fontWeight: 800, color: s.color, fontFamily: F.display }}>
                {s.value}
              </p>
              <p style={{ margin: 0, fontSize: F.xs, color: C.muted, fontFamily: F.body, marginTop: 2 }}>
                {s.label}
              </p>
            </button>
          ))}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div style={{
            textAlign: 'center', padding: `${SP[12]} ${SP[6]}`,
            background: C.surface, borderRadius: R.lg,
            border: `1px solid ${C.border}`,
          }}>
            <p style={{ margin: 0, fontSize: F.base, fontWeight: 600, color: C.text, fontFamily: F.body }}>
              Aucun devis
            </p>
            <p style={{ margin: `${SP[2]} 0 ${SP[5]}`, fontSize: F.sm, color: C.muted, fontFamily: F.body }}>
              {filter !== 'all' ? 'Aucun devis dans ce statut.' : 'Créez votre premier devis pour commencer.'}
            </p>
            {filter === 'all' && (
              <Link href="/quotes/new" style={{ textDecoration: 'none' }}>
                <button className="btn-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: SP[2] }}>
                  <IconPlus />
                  Créer un devis
                </button>
              </Link>
            )}
          </div>
        )}

        {/* Quote list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SP[2] }}>
          {filtered.map((quote: any) => (
            <Link key={quote.id} href={`/quotes`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: C.surface, borderRadius: R.md,
                border: `1px solid ${C.border}`,
                padding: `${SP[4]} ${SP[5]}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP[4],
                cursor: 'pointer', transition: TR.base,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = C.surfaceHov)}
              onMouseLeave={e => (e.currentTarget.style.background = C.surface)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: SP[2], marginBottom: SP[1] }}>
                    <span style={{ fontSize: F.sm, fontWeight: 700, color: C.ink, fontFamily: F.mono }}>
                      {quote.quote_number ?? quote.sale_number ?? '—'}
                    </span>
                    <StatusBadge status={quote.status} />
                  </div>
                  <p style={{ margin: 0, fontSize: F.sm, color: C.text, fontFamily: F.body }}>
                    {quote.customer_name ?? 'Client non spécifié'}
                  </p>
                  {isManagement && quote.users?.full_name && (
                    <p style={{ margin: `${SP[1]} 0 0`, fontSize: F.xs, color: C.muted, fontFamily: F.body }}>
                      Commercial : {quote.users.full_name}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: F.sm, fontWeight: 700, color: C.ink, fontFamily: F.body }}>
                    {fmt(quote.total_amount)}
                  </p>
                  <p style={{ margin: `${SP[1]} 0 0`, fontSize: F.xs, color: C.muted, fontFamily: F.body }}>
                    {new Date(quote.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PageLayout>
  )
}

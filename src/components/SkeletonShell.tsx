/**
 * SkeletonShell — full-page loading skeleton (sidebar + content area).
 * Used by every route's loading.tsx so transitions never show a blank page.
 * This is a pure server component — no 'use client' needed.
 */

const C = {
  bg:      '#F5F2ED',
  surface: '#FDFCF9',
  border:  '#E7E5E4',
}

// ── Shimmer block helper ───────────────────────────────────────────────────────
function Sk({
  w = '100%', h = 14, r = 6, mb = 0,
}: { w?: number | string; h?: number; r?: number; mb?: number }) {
  return (
    <div
      className="skeleton"
      style={{
        width: w, height: h, borderRadius: r,
        marginBottom: mb, flexShrink: 0,
      }}
    />
  )
}

// ── Fake sidebar ───────────────────────────────────────────────────────────────
function SidebarSkeleton() {
  return (
    <aside style={{
      width: 240, background: C.surface, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      borderRight: `1px solid ${C.border}`,
      position: 'fixed', top: 0, left: 0, bottom: 0,
    }}>
      {/* Accent stripe */}
      <div style={{
        height: 3, flexShrink: 0,
        background: 'linear-gradient(90deg,#1D4ED8 0%,#3B82F6 60%,#60A5FA 100%)',
      }} />

      {/* Logo */}
      <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sk w={32} h={32} r={9} />
          <div style={{ flex: 1 }}>
            <Sk w="60%" h={14} r={4} mb={5} />
            <Sk w="80%" h={8} r={3} />
          </div>
        </div>
      </div>

      {/* Profile */}
      <div style={{
        padding: '11px 16px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(28,25,23,0.035)',
      }}>
        <Sk w={34} h={34} r={17} />
        <div style={{ flex: 1 }}>
          <Sk w="65%" h={12} r={4} mb={5} />
          <Sk w="45%" h={9} r={3} />
        </div>
      </div>

      {/* Nav label */}
      <div style={{ padding: '14px 22px 6px' }}>
        <Sk w="40%" h={8} r={3} />
      </div>

      {/* Nav items */}
      <nav style={{ padding: '0 10px', flex: 1 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 11,
            padding: '10px 12px', borderRadius: 8, marginBottom: 2,
          }}>
            <Sk w={17} h={17} r={4} />
            <Sk w={`${55 + (i % 3) * 15}%`} h={12} r={4} />
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ padding: '6px 10px 18px', borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px' }}>
          <Sk w={16} h={16} r={4} />
          <Sk w="45%" h={12} r={4} />
        </div>
      </div>
    </aside>
  )
}

// ── Mobile top bar skeleton ────────────────────────────────────────────────────
function MobileBarSkeleton() {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      background: C.surface, zIndex: 200,
      borderBottom: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        height: 3,
        background: 'linear-gradient(90deg,#1D4ED8 0%,#3B82F6 60%,#60A5FA 100%)',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', gap: 12, height: 52 }}>
        <Sk w={36} h={36} r={9} />
        <Sk w="40%" h={14} r={5} />
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Sk w={26} h={26} r={7} />
          <Sk w={50} h={13} r={4} />
        </div>
      </div>
    </div>
  )
}

// ── Exported shell ─────────────────────────────────────────────────────────────
export default function SkeletonShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @media (max-width: 767px) { .sk-sidebar { display: none !important; } }
        @media (min-width: 768px) { .sk-mobilebar { display: none !important; } }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
        {/* Sidebar — hidden on mobile via CSS */}
        <div className="sk-sidebar">
          <SidebarSkeleton />
        </div>

        {/* Mobile top bar — hidden on desktop via CSS */}
        <div className="sk-mobilebar">
          <MobileBarSkeleton />
        </div>

        {/* Content area */}
        <main style={{
          flex: 1,
          // Desktop: offset by sidebar width; mobile: top padding for bar
          paddingLeft:  'clamp(16px, calc(240px + 40px), calc(240px + 40px))',
          paddingRight: 'clamp(16px, 40px, 40px)',
          paddingTop:   'clamp(71px, 32px, 32px)',
          paddingBottom: 40,
          minWidth: 0,
        }}>
          <style>{`
            @media (max-width: 767px) {
              main {
                padding-left: 16px !important;
                padding-right: 16px !important;
                padding-top: 71px !important;
              }
            }
            @media (min-width: 768px) {
              main {
                padding-left: calc(240px + 40px) !important;
                padding-top: 32px !important;
              }
            }
          `}</style>
          {children}
        </main>
      </div>
    </>
  )
}

// ── Common content skeleton blocks ────────────────────────────────────────────
export function PageHeaderSkeleton({ hasButton = false }: { hasButton?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, gap: 12 }}>
      <div>
        <Sk w={200} h={28} r={6} mb={8} />
        <Sk w={160} h={14} r={4} />
      </div>
      {hasButton && <Sk w={130} h={38} r={9} />}
    </div>
  )
}

export function KpiRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${count}, 1fr)`,
      gap: 14, marginBottom: 24,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          background: C.surface, borderRadius: 14,
          border: `1px solid ${C.border}`,
          borderLeft: '4px solid #E7E5E4',
          padding: '18px 20px 20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <Sk w="50%" h={11} r={4} />
            <Sk w={36} h={36} r={10} />
          </div>
          <Sk w="70%" h={28} r={6} mb={10} />
          <Sk w="55%" h={13} r={4} />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div style={{
      background: C.surface, borderRadius: 14,
      border: `1px solid ${C.border}`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', gap: 16, padding: '13px 16px',
        borderBottom: `1.5px solid ${C.border}`, background: C.bg,
      }}>
        {[80, 100, 140, 80, 80, 70].map((w, i) => (
          <Sk key={i} w={w} h={10} r={4} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          display: 'flex', gap: 16, alignItems: 'center',
          padding: '15px 16px', borderBottom: `1px solid ${C.border}`,
        }}>
          {[60, 90, 160, 70, 70, 50].map((w, j) => (
            <Sk key={j} w={w} h={13} r={4} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      gap: 16,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          background: C.surface, borderRadius: 14,
          border: `1px solid ${C.border}`, padding: '18px 20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <Sk w="60%" h={14} r={4} />
            <Sk w={50} h={20} r={10} />
          </div>
          <Sk w="40%" h={11} r={3} mb={16} />
          <Sk w="100%" h={1} r={0} mb={14} />
          <div style={{ display: 'flex', gap: 12 }}>
            <Sk w="45%" h={28} r={6} />
            <Sk w="45%" h={28} r={6} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PanelSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div style={{
      background: C.surface, borderRadius: 14,
      border: `1px solid ${C.border}`, padding: '20px 22px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
        <Sk w={3} h={14} r={2} />
        <Sk w={120} h={11} r={4} />
      </div>
      <Sk w="100%" h={height} r={8} />
    </div>
  )
}

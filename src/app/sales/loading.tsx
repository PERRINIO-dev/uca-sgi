const C = {
  border: '#E2E8F0', bg: '#F8FAFC', surface: '#FFFFFF', muted: '#94A3B8',
}
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif"

function Skeleton({ w = '100%', h = 14, radius = 6, style = {} }: {
  w?: string | number; h?: number; radius?: number; style?: React.CSSProperties
}) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: 'linear-gradient(90deg, #E2E8F0 25%, #F1F5F9 50%, #E2E8F0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      flexShrink: 0,
      ...style,
    }} />
  )
}

export default function SalesLoading() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: FONT }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>

      {/* Sidebar placeholder */}
      <div style={{ width: 240, flexShrink: 0, background: '#0C1A35' }} />

      {/* Main content */}
      <div style={{ flex: 1, padding: '28px 32px', maxWidth: 1200 }}>

        {/* Page header */}
        <div style={{ display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 24 }}>
          <Skeleton w={160} h={24} radius={8} />
          <Skeleton w={140} h={36} radius={8} />
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[200, 140, 140, 130, 130].map((w, i) => (
            <Skeleton key={i} w={w} h={36} radius={8} />
          ))}
        </div>

        {/* Table */}
        <div style={{ background: C.surface, borderRadius: 12,
          border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{ display: 'flex', gap: 16, padding: '12px 16px',
            borderBottom: `1.5px solid ${C.border}`, background: C.bg }}>
            {[60, 100, 140, 100, 100, 80].map((w, i) => (
              <Skeleton key={i} w={w} h={11} />
            ))}
          </div>
          {/* Data rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, padding: '14px 16px',
              borderBottom: `1px solid ${C.border}`, alignItems: 'center' }}>
              <Skeleton w={60}  h={13} />
              <Skeleton w={100} h={13} />
              <Skeleton w={140} h={13} />
              <Skeleton w={80}  h={13} />
              <Skeleton w={80}  h={24} radius={100} />
              <Skeleton w={80}  h={24} radius={100} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

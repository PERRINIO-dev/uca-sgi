const C = { border: '#E2E8F0', bg: '#F8FAFC', surface: '#FFFFFF' }
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif"

function Skeleton({ w = '100%', h = 14, radius = 6 }: {
  w?: string | number; h?: number; radius?: number
}) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius, flexShrink: 0,
      background: 'linear-gradient(90deg, #E2E8F0 25%, #F1F5F9 50%, #E2E8F0 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
    }} />
  )
}

export default function ReportsLoading() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: FONT }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ width: 240, flexShrink: 0, background: '#0C1A35' }} />
      <div style={{ flex: 1, padding: '28px 32px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
          <Skeleton w={140} h={24} radius={8} />
          <Skeleton w={120} h={36} radius={8} />
        </div>
        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: C.surface, borderRadius: 12,
              border: `1px solid ${C.border}`, padding: '18px 20px',
              display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Skeleton w={80} h={11} />
              <Skeleton w={120} h={28} radius={6} />
              <Skeleton w="60%" h={11} />
            </div>
          ))}
        </div>
        {/* Charts row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ background: C.surface, borderRadius: 12,
              border: `1px solid ${C.border}`, padding: 20, height: 220 }}>
              <div style={{ marginBottom: 16 }}><Skeleton w={140} h={14} /></div>
              <Skeleton w="100%" h={160} radius={8} />
            </div>
          ))}
        </div>
        {/* Table */}
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 16, padding: '12px 16px',
            borderBottom: `1.5px solid ${C.border}`, background: C.bg }}>
            {[120, 100, 100, 100, 80].map((w, i) => <Skeleton key={i} w={w} h={11} />)}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, padding: '13px 16px',
              borderBottom: `1px solid ${C.border}`, alignItems: 'center' }}>
              <Skeleton w={120} h={13} />
              <Skeleton w={100} h={13} />
              <Skeleton w={100} h={13} />
              <Skeleton w={100} h={13} />
              <Skeleton w={80}  h={13} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

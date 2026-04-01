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

export default function WarehouseLoading() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: FONT }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ width: 240, flexShrink: 0, background: '#0C1A35' }} />
      <div style={{ flex: 1, padding: '28px 32px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
          <Skeleton w={180} h={24} radius={8} />
          <Skeleton w={120} h={36} radius={8} />
        </div>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[100, 100, 120].map((w, i) => <Skeleton key={i} w={w} h={36} radius={20} />)}
        </div>
        {/* Cards grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: C.surface, borderRadius: 12,
              border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Skeleton w={140} h={15} />
                <Skeleton w={60} h={22} radius={100} />
              </div>
              <Skeleton w="100%" h={6} radius={3} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[0,1,2].map(j => <Skeleton key={j} w="100%" h={44} radius={6} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

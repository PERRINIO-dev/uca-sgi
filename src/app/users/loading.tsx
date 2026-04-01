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

export default function UsersLoading() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: FONT }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ width: 240, flexShrink: 0, background: '#0C1A35' }} />
      <div style={{ flex: 1, padding: '28px 32px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <Skeleton w={160} h={24} radius={8} />
          <Skeleton w={150} h={36} radius={8} />
        </div>
        {/* Table */}
        <div style={{ background: C.surface, borderRadius: 12,
          border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 16, padding: '12px 16px',
            borderBottom: `1.5px solid ${C.border}`, background: C.bg }}>
            {[200, 140, 100, 120, 80, 80].map((w, i) => <Skeleton key={i} w={w} h={11} />)}
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, padding: '14px 16px',
              borderBottom: `1px solid ${C.border}`, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 200, flexShrink: 0 }}>
                <Skeleton w={34} h={34} radius={34} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Skeleton w="80%" h={13} />
                  <Skeleton w="60%" h={11} />
                </div>
              </div>
              <Skeleton w={140} h={13} />
              <Skeleton w={90}  h={22} radius={100} />
              <Skeleton w={110} h={22} radius={100} />
              <Skeleton w={60}  h={22} radius={100} />
              <Skeleton w={60}  h={28} radius={6} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

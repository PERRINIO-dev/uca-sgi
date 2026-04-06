import SkeletonShell, {
  PageHeaderSkeleton,
  TableSkeleton,
} from '@/components/SkeletonShell'

const C = { surface: '#FDFCF9', border: '#E7E5E4', bg: '#F5F2ED' }

function SegmentTabsSkeleton() {
  return (
    <div style={{
      display: 'flex', gap: 4,
      background: C.bg, border: `1px solid ${C.border}`,
      borderRadius: 11, padding: 4, marginBottom: 20,
      width: 'fit-content',
    }}>
      {[100, 90, 120].map((w, i) => (
        <div key={i} className="skeleton" style={{
          width: w, height: 32, borderRadius: 8,
        }} />
      ))}
    </div>
  )
}

export default function WarehouseLoading() {
  return (
    <SkeletonShell>
      <PageHeaderSkeleton />
      <SegmentTabsSkeleton />
      <TableSkeleton rows={8} />
    </SkeletonShell>
  )
}

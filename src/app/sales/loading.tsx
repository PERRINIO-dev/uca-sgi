import SkeletonShell, {
  PageHeaderSkeleton,
  TableSkeleton,
} from '@/components/SkeletonShell'

export default function SalesLoading() {
  return (
    <SkeletonShell>
      <PageHeaderSkeleton hasButton />
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[160, 120, 120, 100].map((w, i) => (
          <div key={i} style={{
            width: w, height: 36, borderRadius: 8,
            background: '#FDFCF9', border: '1px solid #E7E5E4',
          }} className="skeleton" />
        ))}
      </div>
      <TableSkeleton rows={10} />
    </SkeletonShell>
  )
}

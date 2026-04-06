import SkeletonShell, {
  PageHeaderSkeleton,
  CardGridSkeleton,
} from '@/components/SkeletonShell'

export default function ProductsLoading() {
  return (
    <SkeletonShell>
      <PageHeaderSkeleton hasButton />
      {/* Filter/search bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[200, 130, 110].map((w, i) => (
          <div key={i} className="skeleton" style={{
            width: w, height: 36, borderRadius: 8,
          }} />
        ))}
      </div>
      <CardGridSkeleton count={6} />
    </SkeletonShell>
  )
}

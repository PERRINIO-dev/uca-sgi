import SkeletonShell, {
  PageHeaderSkeleton,
  KpiRowSkeleton,
  PanelSkeleton,
} from '@/components/SkeletonShell'

export default function ReportsLoading() {
  return (
    <SkeletonShell>
      <PageHeaderSkeleton />
      <KpiRowSkeleton count={3} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <PanelSkeleton height={240} />
        <PanelSkeleton height={240} />
      </div>
      <PanelSkeleton height={180} />
    </SkeletonShell>
  )
}

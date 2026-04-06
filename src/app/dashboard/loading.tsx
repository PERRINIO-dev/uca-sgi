import SkeletonShell, {
  PageHeaderSkeleton,
  KpiRowSkeleton,
  PanelSkeleton,
} from '@/components/SkeletonShell'

export default function DashboardLoading() {
  return (
    <SkeletonShell>
      <PageHeaderSkeleton />
      <KpiRowSkeleton count={4} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <PanelSkeleton height={220} />
        <PanelSkeleton height={220} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <PanelSkeleton height={180} />
        <PanelSkeleton height={180} />
      </div>
    </SkeletonShell>
  )
}

import SkeletonShell, {
  PageHeaderSkeleton,
  TableSkeleton,
} from '@/components/SkeletonShell'

export default function UsersLoading() {
  return (
    <SkeletonShell>
      <PageHeaderSkeleton hasButton />
      <TableSkeleton rows={8} />
    </SkeletonShell>
  )
}

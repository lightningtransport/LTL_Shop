export function isAdminWorkOrderReadyToClose({
  canManageWorkOrders,
  status,
  categoryName,
  jobs,
}: {
  canManageWorkOrders: boolean;
  status: string;
  categoryName: string;
  jobs: Array<{ status: string }>;
}): boolean {
  // LTR-175: a `created` Work Order whose Jobs are all done (PM mechanic + Manager) closes too.
  if (!canManageWorkOrders || !['in_progress', 'created'].includes(status)) return false;
  const hasIncompleteStandardJobs = categoryName !== 'PM' && jobs.some((job) => job.status === 'to_do');
  return !hasIncompleteStandardJobs;
}

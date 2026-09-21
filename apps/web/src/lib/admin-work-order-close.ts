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
  if (!canManageWorkOrders || status !== 'in_progress') return false;
  const hasIncompleteStandardJobs = categoryName !== 'PM' && jobs.some((job) => job.status === 'to_do');
  return !hasIncompleteStandardJobs;
}

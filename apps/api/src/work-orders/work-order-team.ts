/**
 * LTR-164 (#11) / D11: the team shown on a Work Order is derived from its
 * owners. A PM mechanic reaches the Work Order only through the PM job (no
 * `mechanic_assignments` row, so no Standard access), yet still belongs on the
 * team: active assignments first, then each non-cancelled Job's owner not
 * already listed.
 */
export type WorkOrderTeamMember = { mechanicId: string; mechanicName: string; addedAt: Date };

export function workOrderTeam(
  assignments: Array<{ mechanicId?: string; mechanic: { id?: string; name: string }; addedAt: Date; removedAt?: Date | null }>,
  jobs: Array<{ status: string; addedAt?: Date | null; assignedMechanic?: { id: string; name: string } | null }>,
  fallbackAddedAt: Date,
): WorkOrderTeamMember[] {
  const team: WorkOrderTeamMember[] = [];
  const seen = new Set<string>();
  for (const assignment of assignments) {
    const mechanicId = assignment.mechanicId ?? assignment.mechanic.id;
    if (assignment.removedAt || !mechanicId || seen.has(mechanicId)) continue;
    seen.add(mechanicId);
    team.push({ mechanicId, mechanicName: assignment.mechanic.name, addedAt: assignment.addedAt });
  }
  for (const job of jobs) {
    const owner = job.assignedMechanic;
    if (job.status === 'cancelled' || !owner || seen.has(owner.id)) continue;
    seen.add(owner.id);
    team.push({ mechanicId: owner.id, mechanicName: owner.name, addedAt: job.addedAt ?? fallbackAddedAt });
  }
  return team;
}

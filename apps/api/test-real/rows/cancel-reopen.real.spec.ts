import { beforeEach, describe, it } from 'vitest';
import {
  USERS, Json, activeBlocker, admin, adminCompleteJob, adminWo, cancelWo, closeWo, createWo, doLane, doPm, inspect,
  laneJob, manager, meta, namedJob, as, ok, openSessionUsers, plannedWo, prisma, refused, reportBlocker, resetDb, same,
  sameNextStepEverywhere, start, truckDetail, truthy,
} from '../harness';

describe('Manager y Admin: cancelar y reabrir', () => {
  beforeEach(resetDb);

  it('A15 | Cancelar WO (con motivo) → cierra sesiones y pausas; el Truck queda libre', async () => {
    const { truck, workOrderId } = await plannedWo('905', [
      { category: 'Electrical & Starting', job: 'Battery', assignee: USERS.general },
    ]);
    ok('Start general', await start(USERS.general, workOrderId));
    ok('Start alignment', await start(USERS.alignment, workOrderId));
    ok('pausa oficial', await manager.post(`/admin/work-orders/${workOrderId}/pause`, { reason: 'waiting_for_parts' }));

    refused('cancelar exige motivo', await manager.post(`/admin/work-orders/${workOrderId}/cancel`, await meta(workOrderId)), 400);
    ok('cancelar WO', await cancelWo(workOrderId));
    const workOrder = await adminWo(workOrderId);
    same('estado', workOrder.status, 'cancelled');
    same('sin sesiones abiertas', await openSessionUsers(workOrderId), []);
    same('la pausa oficial se cierra', await prisma.pauseEvent.count({ where: { workOrderId, isOfficialPause: true, endedAt: null } }), 0);
    same('los Jobs no se cancelan uno por uno', (workOrder.jobs as Json[]).every((job) => job.status === 'to_do'), true);
    same('el Truck queda libre', (await truckDetail(truck.id)).nextStep.kind, 'create_work_order');
    same('queda en el historial', (ok('historial', await manager.get('/admin/history?limit=100')).items as Json[]).some((item) => item.id === workOrderId), true);
  });

  it('A15b | Cancelar un WO con un Job bloqueado resuelve el bloqueo [defecto #2]', async () => {
    const { workOrderId } = await plannedWo('922', [{ category: 'Electrical & Starting', job: 'Battery', assignee: USERS.general }]);
    ok('Start', await start(USERS.general, workOrderId));
    ok('bloqueo en Battery', await reportBlocker(USERS.general, workOrderId, namedJob(await adminWo(workOrderId), 'Battery').id));
    ok('cancelar WO', await cancelWo(workOrderId));
    same('bloqueos activos', await activeBlocker(workOrderId), null);
  });

  it('A15c | Tras cancelar, el siguiente WO del Truck empieza con la inspección pendiente [defecto #4]', async () => {
    const first = await createWo('931');
    await inspect(first.truck.id, 'no_issues_found');
    ok('cancelar WO', await cancelWo(first.workOrderId));
    const next = await createWo('931');
    same('inspección del WO nuevo', (await truckDetail(first.truck.id)).workPlan.inspection.outcome, 'not_started');
    await sameNextStepEverywhere('WO nuevo tras cancelar', next.workOrderId, first.truck.id, 'inspect');
  });

  it('A16 | Cancelar Job / reabrir Job; paso con todos sus Jobs cancelados = no aplica', async () => {
    const { truck, workOrderId } = await plannedWo('944');
    const alignment = laneJob(await adminWo(workOrderId), 'alignment');
    refused('cancelar Job exige motivo', await manager.post(`/admin/jobs/${alignment.id}/cancel`, await meta(workOrderId)), 400);
    ok('cancelar Alignment', await manager.post(`/admin/jobs/${alignment.id}/cancel`, { ...(await meta(workOrderId)), reason: 'Alineado la semana pasada.' }));
    let detail = await truckDetail(truck.id);
    same('Alignment no aplica', detail.workPlan.mandatory.alignment.status, 'not_applicable');
    truthy('no pide volver a agregarlo', detail.nextStep.kind !== 'add_missing_steps', detail.nextStep);
    same('el mecánico de Alignment ya no ve el WO', (ok('lista', await as(USERS.alignment).get('/work-orders?mode=standard')).created as Json[]).some((item) => item.id === workOrderId), false);

    refused('reabrir Job exige motivo', await manager.post(`/admin/jobs/${alignment.id}/reopen`, await meta(workOrderId)), 400);
    ok('reabrir Alignment', await manager.post(`/admin/jobs/${alignment.id}/reopen`, { ...(await meta(workOrderId)), reason: 'Sí hace falta.' }));
    detail = await truckDetail(truck.id);
    same('Alignment vuelve a pendiente', detail.workPlan.mandatory.alignment.status, 'pending');
    same('conserva su dueño', laneJob(detail.workPlan, 'alignment').assignedMechanic?.id, alignment.assignedMechanic?.id);
  });

  it('A16b | Completar desde Admin un Job bloqueado no deja el bloqueo vivo [defecto #2]', async () => {
    const { truck, workOrderId } = await plannedWo('957', [{ category: 'Electrical & Starting', job: 'Battery', assignee: USERS.general }]);
    const battery = namedJob(await adminWo(workOrderId), 'Battery');
    ok('Start', await start(USERS.general, workOrderId));
    ok('bloqueo en Battery', await reportBlocker(USERS.general, workOrderId, battery.id));
    const reply = await adminCompleteJob(workOrderId, battery.id);
    if (reply.status >= 400) return refused('o se rechaza como al mecánico', reply, 400, 'JOB_BLOCKED');
    same('bloqueos activos', await activeBlocker(workOrderId), null);
    truthy('el siguiente paso no pide resolver', (await truckDetail(truck.id)).nextStep.kind !== 'resolve_blocker');
  });

  it('A16c | Cancelar un Job bloqueado resuelve su bloqueo [defecto #2]', async () => {
    const { truck, workOrderId } = await plannedWo('968', [{ category: 'Electrical & Starting', job: 'Battery', assignee: USERS.general }]);
    const battery = namedJob(await adminWo(workOrderId), 'Battery');
    ok('Start', await start(USERS.general, workOrderId));
    ok('bloqueo en Battery', await reportBlocker(USERS.general, workOrderId, battery.id));
    ok('cancelar el Job bloqueado', await manager.post(`/admin/jobs/${battery.id}/cancel`, { ...(await meta(workOrderId)), reason: 'No se hará.' }));
    same('bloqueos activos', await activeBlocker(workOrderId), null);
    truthy('el siguiente paso no pide resolver', (await truckDetail(truck.id)).nextStep.kind !== 'resolve_blocker');
  });

  it('A17 | Reabrir WO completado/cancelado → in_progress o created', async () => {
    const done = await plannedWo('944');
    await doPm(done.workOrderId, done.truck.id);
    await doLane(USERS.alignment, done.workOrderId, 'alignment');
    await doLane(USERS.detailing, done.workOrderId, 'detailing');
    ok('Mark QC complete', await adminCompleteJob(done.workOrderId, laneJob(await adminWo(done.workOrderId), 'quality_check').id));
    ok('Close', await closeWo(done.workOrderId));

    const reopen = async (actor: typeof admin, workOrderId: string, reason?: string) =>
      actor.post(`/admin/work-orders/${workOrderId}/reopen`, { ...(await meta(workOrderId)), ...(reason ? { reason } : {}) });
    refused('reabrir exige motivo', await reopen(admin, done.workOrderId), 400);
    ok('reabrir el WO completado', await reopen(admin, done.workOrderId, 'Faltó revisar luces.'));
    let workOrder = await adminWo(done.workOrderId);
    same('un WO que ya había empezado vuelve a in_progress', workOrder.status, 'in_progress');
    same('se limpia la fecha de cierre', workOrder.completedAt, null);
    same('los Jobs no se reabren solos', (workOrder.jobs as Json[]).every((job) => job.status === 'completed'), true);
    await sameNextStepEverywhere('reabierto con todo hecho', done.workOrderId, done.truck.id, 'close');
    ok('se puede volver a cerrar', await closeWo(done.workOrderId));

    const never = await createWo('957');
    await inspect(never.truck.id, 'no_issues_found');
    ok('cancelar', await cancelWo(never.workOrderId));
    const other = await createWo('957');
    refused('no se reabre si el Truck ya tiene otro WO abierto', await reopen(admin, never.workOrderId, 'Error.'), 400);
    ok('cancelar el otro', await cancelWo(other.workOrderId));
    ok('reabrir el WO cancelado', await reopen(admin, never.workOrderId, 'Se canceló por error.'));
    workOrder = await adminWo(never.workOrderId);
    same('un WO que nunca empezó vuelve a created', workOrder.status, 'created');
    ok('el mecánico puede hacer Start', await start(USERS.alignment, never.workOrderId));
    same('y pasa a in_progress', (await adminWo(never.workOrderId)).status, 'in_progress');
  });

  it('A17b | Reabrir un WO que nunca empezó, con todos los Jobs hechos: se puede cerrar [defecto #1]', async () => {
    const reopen = async (workOrderId: string) =>
      admin.post(`/admin/work-orders/${workOrderId}/reopen`, { ...(await meta(workOrderId)), reason: 'Se canceló por error.' });
    const stuck = await plannedWo('968');
    await doPm(stuck.workOrderId, stuck.truck.id);
    for (const lane of ['alignment', 'detailing', 'quality_check'] as const) {
      ok(`Manager completa ${lane}`, await adminCompleteJob(stuck.workOrderId, laneJob(await adminWo(stuck.workOrderId), lane).id));
    }
    ok('cancelar', await cancelWo(stuck.workOrderId));
    ok('reabrir', await reopen(stuck.workOrderId));
    await sameNextStepEverywhere('reabierto con todo hecho', stuck.workOrderId, stuck.truck.id, 'close');
    ok('Close Work Order', await closeWo(stuck.workOrderId));
  });
});

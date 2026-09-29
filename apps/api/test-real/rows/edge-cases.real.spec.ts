import { randomUUID } from 'node:crypto';
import { beforeEach, describe, it } from 'vitest';
import {
  USERS, Json, adminCompleteJob, adminWo, as, assign, cancelWo, catalogJob, closeWo, completeJob, createPmService,
  createWo, doLane, doPm, inspect, laneJob, laneOf, manager, meta, namedJob, ok, openSessionUsers, plannedWo, prisma,
  refused, reportBlocker, resetDb, returnToService, same, savePm, start, truck, truckDetail, truthy, unassign, userId,
} from '../harness';

async function closedWo(truckNumber: string) {
  const planned = await plannedWo(truckNumber);
  await doPm(planned.workOrderId, planned.truck.id);
  await doLane(USERS.alignment, planned.workOrderId, 'alignment');
  await doLane(USERS.detailing, planned.workOrderId, 'detailing');
  ok('QC', await adminCompleteJob(planned.workOrderId, laneJob(await adminWo(planned.workOrderId), 'quality_check').id));
  ok('Close', await closeWo(planned.workOrderId));
  return planned;
}

describe('Casos límite', () => {
  beforeEach(resetDb);

  it('E1 | Un Truck con WO abierto no acepta un segundo WO', async () => {
    const { truck: row } = await createWo('905');
    refused('segundo WO', await manager.post('/admin/work-orders', { truckId: row.id, idempotencyKey: randomUUID() }), 409);
    same('sigue habiendo uno', await prisma.workOrder.count({ where: { truckId: row.id } }), 1);
    refused('Truck que no existe', await manager.post('/admin/work-orders', { truckId: randomUUID(), idempotencyKey: randomUUID() }), 400);
    refused('prioridad inválida', await manager.post('/admin/work-orders', { truckId: (await truck('922')).id, priority: 'urgente', idempotencyKey: randomUUID() }), 400);
  });

  it('E2 | Reintento de crear WO (misma clave) no crea otro', async () => {
    const row = await truck('905');
    const body = { truckId: row.id, idempotencyKey: randomUUID() };
    const first = ok('crear', await manager.post('/admin/work-orders', body));
    const again = ok('reintento', await manager.post('/admin/work-orders', body));
    same('devuelve el mismo WO', again.id, first.id);
    same('un solo WO', await prisma.workOrder.count({ where: { truckId: row.id } }), 1);
  });

  it('E3 | Dos Managers cambian el mismo WO: gana el primero, el segundo recibe aviso', async () => {
    const { workOrderId } = await plannedWo('905', [{ category: 'Electrical & Starting', job: 'Lights' }]);
    const stale = await meta(workOrderId);
    ok('primer cambio', await manager.patch(`/admin/work-orders/${workOrderId}`, { ...(await meta(workOrderId)), priority: 'high' }));
    refused('segundo cambio con datos viejos', await manager.patch(`/admin/work-orders/${workOrderId}`, { ...stale, priority: 'low' }), 409, 'VERSION_CONFLICT');
    same('queda el primer cambio', (await adminWo(workOrderId)).priority, 'high');
  });

  it('E4 | Usuario inactivo o desconocido no entra', async () => {
    await prisma.user.updateMany({ where: { email: USERS.spare }, data: { active: false } });
    refused('usuario inactivo', await as(USERS.spare).get('/work-orders?mode=standard'), 403);
    refused('usuario que no existe', await as('nadie@lightning.local').get('/work-orders?mode=standard'), 403);
    const anonymous = await fetch(`${(await import('vitest')).inject('apiUrl')}/api/admin/dashboard`);
    same('sin sesión', anonymous.status, 401);
  });

  it('E5 | Mecánico: Start donde no tiene Jobs, o cuando ya terminó los suyos', async () => {
    const { workOrderId } = await plannedWo('905');
    refused('Start sin Jobs en ese WO', await start(USERS.general, workOrderId), 403);
    same('el WO no cambia', (await adminWo(workOrderId)).status, 'created');
    await doLane(USERS.alignment, workOrderId, 'alignment');
    refused('Start con su parte terminada', await start(USERS.alignment, workOrderId), 400);
    same('sin sesiones abiertas', await openSessionUsers(workOrderId), []);
  });

  it('E6 | Completar un Job sin Start, o uno ya completado', async () => {
    const { workOrderId } = await plannedWo('905');
    const alignment = laneJob(await adminWo(workOrderId), 'alignment');
    refused('completar sin Start', await completeJob(USERS.alignment, workOrderId, alignment.id), 400, 'START_REQUIRED');
    ok('Start', await start(USERS.alignment, workOrderId));
    ok('completar', await completeJob(USERS.alignment, workOrderId, alignment.id));
    refused('completar otra vez', await completeJob(USERS.alignment, workOrderId, alignment.id), 400);
    refused('el Manager tampoco lo completa dos veces', await adminCompleteJob(workOrderId, alignment.id), 400);
  });

  it('E7 | Un mecánico Standard puede tener trabajo en curso en dos Trucks a la vez (decisión 2026-09-25, LTR-125)', async () => {
    const first = await plannedWo('905');
    const second = await plannedWo('922');
    ok('Start en el primero', await start(USERS.alignment, first.workOrderId));
    ok('Start en el segundo', await start(USERS.alignment, second.workOrderId));
    same('su tiempo corre en los dos (se acepta que se solape)', await prisma.workSession.count({ where: { userId: await userId(USERS.alignment), endedAt: null } }), 2);
    same('los dos WO en curso', [(await adminWo(first.workOrderId)).status, (await adminWo(second.workOrderId)).status], ['in_progress', 'in_progress']);
  });

  it('E8 | Quitar o cambiar el dueño de un Job en curso detiene el tiempo de ese mecánico', async () => {
    const { workOrderId } = await plannedWo('905', [{ category: 'Electrical & Starting', job: 'Lights', assignee: USERS.general }]);
    ok('Start', await start(USERS.general, workOrderId));
    const lights = namedJob(await adminWo(workOrderId), 'Lights');
    ok('reasignar', await assign(workOrderId, lights.id, USERS.spare));
    same('el tiempo del anterior se detiene', await openSessionUsers(workOrderId), []);
    refused('el anterior ya no lo puede completar', await completeJob(USERS.general, workOrderId, lights.id), 403);
    ok('quitar dueño', await unassign(workOrderId, lights.id));
    refused('nadie ejecuta un Job sin dueño', await start(USERS.spare, workOrderId), 403);
  });

  it('E9 | Asignar a quien no corresponde', async () => {
    const { workOrderId } = await plannedWo('905', [{ category: 'Electrical & Starting', job: 'Lights' }]);
    const workOrder = await adminWo(workOrderId);
    refused('mecánico PM en un Job Standard', await assign(workOrderId, namedJob(workOrder, 'Lights').id, USERS.pm), 400);
    refused('mecánico Standard en el PM', await assign(workOrderId, laneJob(workOrder, 'pm').id, USERS.general), 400);
    refused('cuenta de administrador', await assign(workOrderId, namedJob(workOrder, 'Lights').id, USERS.admin), 400);
    await prisma.user.updateMany({ where: { email: USERS.spare }, data: { active: false } });
    refused('usuario inactivo', await assign(workOrderId, namedJob(workOrder, 'Lights').id, USERS.spare), 400);
  });

  it('E9b | Quality Check no acepta dueño (D15) [defecto #8]', async () => {
    const { workOrderId } = await plannedWo('905');
    const qc = laneJob(await adminWo(workOrderId), 'quality_check');
    refused('asignar Quality Check', await assign(workOrderId, qc.id, USERS.general), 400);
  });

  it('E10 | Bloqueo: motivos que no son bloqueo, Job ajeno, Job terminado', async () => {
    const { workOrderId } = await plannedWo('905', [{ category: 'Electrical & Starting', job: 'Lights', assignee: USERS.general }]);
    const workOrder = await adminWo(workOrderId);
    const lights = namedJob(workOrder, 'Lights');
    ok('Start', await start(USERS.general, workOrderId));
    for (const reason of ['break', 'end_of_shift', 'working_on_another_wo', 'truck_unavailable']) {
      refused(`"${reason}" no es motivo de bloqueo`, await reportBlocker(USERS.general, workOrderId, lights.id, reason), 400);
    }
    refused('bloquear el Job de otro', await reportBlocker(USERS.general, workOrderId, laneJob(workOrder, 'alignment').id), 403);
    ok('completar', await completeJob(USERS.general, workOrderId, lights.id));
    refused('bloquear un Job terminado', await reportBlocker(USERS.general, workOrderId, lights.id), 400, 'JOB_NOT_PENDING');
  });

  it('E11 | PM: millaje menor, salto grande, terminar sin millaje o sin partes (D10)', async () => {
    const { truck: row, workOrderId } = await plannedWo('905');
    ok('Create PM service', await createPmService(row.id));
    const pm = as(USERS.pm);
    const pmJob = laneJob(await adminWo(workOrderId), 'pm');
    const mileage = row.mileage ?? 0;

    refused('terminar sin millaje ni partes', await completeJob(USERS.pm, workOrderId, pmJob.id), 400);
    refused('millaje menor que el del Truck', await pm.post(`/work-orders/${workOrderId}/pm`, { observedMileage: mileage - 1, selections: [] }), 400);
    refused('salto de más de 50 000 sin confirmar', await pm.post(`/work-orders/${workOrderId}/pm`, { observedMileage: mileage + 50_001, selections: [] }), 400);
    ok('millaje sin partes (borrador)', await pm.post(`/work-orders/${workOrderId}/pm`, { observedMileage: mileage + 10, selections: [] }));
    refused('terminar sin partes', await completeJob(USERS.pm, workOrderId, pmJob.id), 400);
    ok('salto grande confirmado', await pm.post(`/work-orders/${workOrderId}/pm`, { observedMileage: mileage + 50_001, selections: [], confirmLargeMileageJump: true }));
    ok('millaje y parte', await savePm(workOrderId, mileage + 10));
    ok('Finish', await completeJob(USERS.pm, workOrderId, pmJob.id));
    same('millaje del Truck', (await truck('905')).mileage, mileage + 10);
    refused('un PM terminado es de solo lectura', await pm.post(`/work-orders/${workOrderId}/pm`, { observedMileage: mileage + 20, selections: [] }), 400);
    await prisma.truck.update({ where: { id: row.id }, data: { mileage } });
  });

  it('E12 | Agregar trabajo a un Truck sin WO abierto crea el WO completo', async () => {
    const row = await truck('905');
    const lights = await catalogJob('Electrical & Starting', 'Lights');
    ok('agregar trabajo', await manager.post(`/admin/trucks/${row.id}/work-plan/jobs`, {
      idempotencyKey: randomUUID(),
      jobs: [{ catalogJobId: lights.id, categoryId: lights.categoryId, displayName: lights.displayName, assignedMechanicId: await userId(USERS.general) }],
    }));
    const detail = await truckDetail(row.id);
    same('el WO nace con los pasos obligatorios y el trabajo', (detail.workPlan.jobs as Json[]).map(laneOf).sort(), ['alignment', 'detailing', 'pm', 'quality_check', 'shop_work']);
    same('un solo WO', await prisma.workOrder.count({ where: { truckId: row.id } }), 1);
  });

  it('E13 | Inspección: no se puede pasar a "No issues found" con hallazgos en el plan', async () => {
    const { truck: row, workOrderId } = await plannedWo('905', [{ category: 'Electrical & Starting', job: 'Lights', assignee: USERS.general }]);
    refused('cambiar a "No issues found"', await manager.post(`/admin/trucks/${row.id}/work-plan/inspection`, { outcome: 'no_issues_found', idempotencyKey: randomUUID() }), 400);
    same('la inspección sigue con hallazgos', (await truckDetail(row.id)).workPlan.inspection.outcome, 'issues_found');
    same('el trabajo sigue en el plan', (await adminWo(workOrderId)).jobsTotal, 5);
    ok('cancelar el hallazgo', await manager.post(`/admin/jobs/${namedJob(await adminWo(workOrderId), 'Lights').id}/cancel`, { ...(await meta(workOrderId)), reason: 'Falsa alarma.' }));
    ok('ahora sí "No issues found"', await manager.post(`/admin/trucks/${row.id}/work-plan/inspection`, { outcome: 'no_issues_found', idempotencyKey: randomUUID() }));
  });

  it('E14 | Truck Ready to Go sin Return to Service: se puede abrir otro WO y deja de estar Ready to Go', async () => {
    const done = await closedWo('905');
    same('Ready to Go', (await truckDetail(done.truck.id)).phase, 'ready_to_go');
    const next = ok('abrir otro WO', await manager.post('/admin/work-orders', { truckId: done.truck.id, idempotencyKey: randomUUID() }));
    const detail = await truckDetail(done.truck.id);
    truthy('ya no está Ready to Go', detail.phase !== 'ready_to_go', detail.phase);
    same('el trabajo actual es el WO nuevo', detail.activeWorkOrder?.id, next.id);
    same('el Dashboard ya no lo cuenta como Ready to Go', ok('Dashboard', await manager.get('/admin/dashboard')).counts.readyToGo, 0);
  });

  it('E14b | Un WO nuevo sobre un Truck Ready to Go empieza con la inspección pendiente [defecto #4]', async () => {
    const done = await closedWo('905');
    const next = ok('abrir otro WO', await manager.post('/admin/work-orders', { truckId: done.truck.id, idempotencyKey: randomUUID() }));
    const detail = await truckDetail(done.truck.id);
    same('inspección del WO nuevo', detail.workPlan.inspection.outcome, 'not_started');
    same('siguiente paso', detail.nextStep.kind, 'inspect');
    truthy('es el WO nuevo', detail.nextStep.workOrderId === next.id);
  });

  it('E15 | Cerrar, cancelar y devolver a servicio en el estado equivocado', async () => {
    const done = await closedWo('905');
    refused('cancelar un WO completado', await cancelWo(done.workOrderId), 400);
    refused('cerrar dos veces', await closeWo(done.workOrderId), 400);
    refused('cancelar un Job completado', await manager.post(`/admin/jobs/${laneJob(await adminWo(done.workOrderId), 'alignment').id}/cancel`, { ...(await meta(done.workOrderId)), reason: 'x' }), 400);
    refused('el mecánico no trabaja en un WO cerrado', await start(USERS.alignment, done.workOrderId), 400);

    const cancelled = await plannedWo('922');
    ok('cancelar', await cancelWo(cancelled.workOrderId));
    refused('devolver a servicio un WO cancelado', await returnToService(cancelled.workOrderId), 400);
    refused('cancelar dos veces', await cancelWo(cancelled.workOrderId), 400);
    refused('el mecánico no trabaja en un WO cancelado', await start(USERS.alignment, cancelled.workOrderId), 400);
    same('el mecánico ya no lo ve en su lista', (ok('lista', await as(USERS.alignment).get('/work-orders?mode=standard')).created as Json[]).length, 0);
  });

  it('E16 | Cancelar todos los Jobs pendientes: el WO se puede cerrar', async () => {
    const { truck: row, workOrderId } = await plannedWo('905');
    ok('Start', await start(USERS.alignment, workOrderId));
    for (const lane of ['pm', 'alignment', 'detailing', 'quality_check'] as const) {
      const job = laneJob(await adminWo(workOrderId), lane);
      ok(`cancelar ${lane}`, await manager.post(`/admin/jobs/${job.id}/cancel`, { ...(await meta(workOrderId)), reason: 'No aplica en esta visita.' }));
    }
    same('sin sesiones abiertas', await openSessionUsers(workOrderId), []);
    const detail = await truckDetail(row.id);
    same('siguiente paso', detail.nextStep.kind, 'close');
    ok('Close', await closeWo(workOrderId));
  });

  it('E17 | Prioridad crítica sube en "Needs attention"; el PM no cambia de prioridad', async () => {
    const normal = await plannedWo('905');
    const critical = await createWo('922', { priority: 'critical' });
    await inspect(critical.truck.id, 'no_issues_found');
    const dashboard = ok('Dashboard', await manager.get('/admin/dashboard'));
    same('primero el crítico', (dashboard.attention as Json[]).map((item) => item.id), [critical.workOrderId, normal.workOrderId]);
    same('cuenta de High/Critical', dashboard.counts.highCriticalOpen, 1);
  });
});

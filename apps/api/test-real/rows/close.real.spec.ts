import { beforeEach, describe, it } from 'vitest';
import {
  USERS, Json, adminCompleteJob, adminWo, closeWo, doLane, doPm, laneJob, manager, ok, plannedWo, prisma, refused,
  resetDb, returnToService, same, sameNextStepEverywhere, truckDetail, truthy,
} from '../harness';

describe('Manager: QC, cerrar y devolver a servicio', () => {
  beforeEach(resetDb);

  it('A12 | M04: Manager completa Jobs desde Admin ("Mark complete")', async () => {
    const { workOrderId } = await plannedWo('905');
    const workOrder = await adminWo(workOrderId);
    ok('Manager completa Alignment', await adminCompleteJob(workOrderId, laneJob(workOrder, 'alignment').id));
    same('Job completado', laneJob(await adminWo(workOrderId), 'alignment').status, 'completed');
    refused('el PM no se completa desde Admin', await adminCompleteJob(workOrderId, laneJob(workOrder, 'pm').id), 400);
    same('completar un Job no completa el WO', ['created', 'in_progress'].includes((await adminWo(workOrderId)).status), true);
  });

  it('A12b | Si el Manager completa un Job, el WO deja de estar "created" [defecto #1]', async () => {
    const { workOrderId } = await plannedWo('957');
    ok('Manager completa Alignment', await adminCompleteJob(workOrderId, laneJob(await adminWo(workOrderId), 'alignment').id));
    same('estado del WO', (await adminWo(workOrderId)).status, 'in_progress');
  });

  it('A13a | M04: QC "Mark complete" → Ready to close → Close WO (un mecánico hizo Start)', async () => {
    const { truck, workOrderId } = await plannedWo('922');
    await doPm(workOrderId, truck.id);
    await doLane(USERS.alignment, workOrderId, 'alignment');
    await doLane(USERS.detailing, workOrderId, 'detailing');
    await sameNextStepEverywhere('solo falta QC', workOrderId, truck.id, 'qc');

    refused('no se cierra con QC pendiente', await closeWo(workOrderId), 400);
    ok('Mark QC complete', await adminCompleteJob(workOrderId, laneJob(await adminWo(workOrderId), 'quality_check').id));
    same('fase', (await truckDetail(truck.id)).workPlan.phase, 'ready_to_close');
    await sameNextStepEverywhere('listo para cerrar', workOrderId, truck.id, 'close');

    ok('Close Work Order', await closeWo(workOrderId));
    const workOrder = await adminWo(workOrderId);
    same('estado', workOrder.status, 'completed');
    same('sin sesiones abiertas', (workOrder.laborSessions as Json[]).filter((session) => !session.endedAt).length, 0);
  });

  it('A13b | M04: Close WO cuando nadie hizo Start (PM + Manager) — caso WO-009 [defecto #1]', async () => {
    const { truck, workOrderId } = await plannedWo('931');
    await doPm(workOrderId, truck.id);
    for (const lane of ['alignment', 'detailing', 'quality_check'] as const) {
      ok(`Manager completa ${lane}`, await adminCompleteJob(workOrderId, laneJob(await adminWo(workOrderId), lane).id));
    }
    await sameNextStepEverywhere('todos los Jobs completos', workOrderId, truck.id, 'close');
    // El siguiente paso ofrece "Close": la API tiene que aceptarlo.
    ok('Close Work Order', await closeWo(workOrderId));
    same('estado', (await adminWo(workOrderId)).status, 'completed');
  });

  it('A14 | M04: Ready to Go → Return to Service desde Truck, WO y Yard', async () => {
    const { truck, workOrderId } = await plannedWo('944');
    await doPm(workOrderId, truck.id);
    await doLane(USERS.alignment, workOrderId, 'alignment');
    await doLane(USERS.detailing, workOrderId, 'detailing');
    ok('Mark QC complete', await adminCompleteJob(workOrderId, laneJob(await adminWo(workOrderId), 'quality_check').id));
    refused('no se devuelve a servicio con el WO abierto', await returnToService(workOrderId), 400);
    ok('Close Work Order', await closeWo(workOrderId));

    let detail = await truckDetail(truck.id);
    same('fase Ready to Go', detail.phase, 'ready_to_go');
    same('el WO que lo mantiene Ready to Go está completado', detail.activeWorkOrder?.status, 'completed');
    same('siguiente paso en el Truck', detail.nextStep.kind, 'return_to_service');
    same('siguiente paso en el WO', (await adminWo(workOrderId)).nextStep?.kind, 'return_to_service');
    let yard = ok('Yard', await manager.get('/admin/yard-operations?limit=100'));
    same('el Yard lo cuenta como Ready to Go', yard.counts.readyToGo, 1);
    same('el Dashboard también', ok('Dashboard', await manager.get('/admin/dashboard')).counts.readyToGo, 1);

    ok('Return to Service (sin motivo)', await returnToService(workOrderId));
    detail = await truckDetail(truck.id);
    same('Truck en servicio', detail.operationalStatus, 'in_service');
    same('siguiente paso', detail.nextStep.kind, 'create_work_order');
    truthy('el WO guarda la fecha', (await adminWo(workOrderId)).returnedToServiceAt);
    yard = ok('Yard', await manager.get('/admin/yard-operations?limit=100'));
    same('sale del tablero', (yard.items as Json[]).some((item) => item.truck.id === truck.id), false);
    same('ya no cuenta como Ready to Go', yard.counts.readyToGo, 0);
    same('la evaluación de inspección se cierra', await prisma.truckReadinessAssessment.count({ where: { truckId: truck.id, status: { not: 'closed' } } }), 0);
    refused('no se devuelve a servicio dos veces', await returnToService(workOrderId), 400);
  });
});

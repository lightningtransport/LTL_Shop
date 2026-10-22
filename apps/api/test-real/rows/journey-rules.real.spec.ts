/**
 * D55 (P38, LTR-294): the rules a Work Order cannot skip on its way out of the shop. Each row tries to
 * skip one and has to be refused. Owner case: on the 917 and the 823 he opened a Work Order, cancelled
 * the default steps, completed the Quality Check and closed it without inspecting.
 */
import { beforeEach, describe, it } from 'vitest';
import {
  USERS, adminCompleteJob, adminWo, as, closeWo, completeJob, createWo, doLane, doPm, laneJob, manager, meta, ok, plannedWo,
  prisma, refused, resetDb, same, sameNextStepEverywhere, savePm,
} from '../harness';

async function cancelJob(workOrderId: string, jobId: string, reason = 'No aplica en esta visita.') {
  return manager.post(`/admin/jobs/${jobId}/cancel`, { ...(await meta(workOrderId)), reason });
}

describe('D55: reglas que una Work Order no se salta', () => {
  beforeEach(resetDb);

  it('A154 | R2: sin inspección no se cierra; con motivo sí, y el motivo queda en el historial', async () => {
    const { truck, workOrderId } = await createWo('905');
    await doPm(workOrderId, truck.id);
    await doLane(USERS.alignment, workOrderId, 'alignment');
    await doLane(USERS.detailing, workOrderId, 'detailing');
    ok('Mark QC complete', await adminCompleteJob(workOrderId, laneJob(await adminWo(workOrderId), 'quality_check').id));

    refused('cerrar sin inspección', await closeWo(workOrderId), 400, 'INSPECTION_NOT_DONE');
    refused('con un motivo vacío tampoco', await closeWo(workOrderId, { inspectionSkipReason: '  ' }), 400);
    ok('cerrar sin inspección, con motivo', await closeWo(workOrderId, { inspectionSkipReason: 'Vino solo por el PM; la inspección se hizo ayer.' }));
    same('estado', (await adminWo(workOrderId)).status, 'completed');
    const closed = await prisma.activityLog.findFirstOrThrow({ where: { workOrderId, eventType: 'work_order_completed' } });
    const value = closed.newValue as { inspectionSkipped?: boolean; notes?: string };
    same('el historial dice que fue sin inspección y por qué', [value.inspectionSkipped, value.notes], [true, 'Vino solo por el PM; la inspección se hizo ayer.']);
  });

  it('A155 | R2: con la inspección guardada se cierra sin pedir motivo', async () => {
    const { truck, workOrderId } = await plannedWo('922');
    await doPm(workOrderId, truck.id);
    await doLane(USERS.alignment, workOrderId, 'alignment');
    await doLane(USERS.detailing, workOrderId, 'detailing');
    ok('Mark QC complete', await adminCompleteJob(workOrderId, laneJob(await adminWo(workOrderId), 'quality_check').id));
    ok('Close Work Order', await closeWo(workOrderId));
    const closed = await prisma.activityLog.findFirstOrThrow({ where: { workOrderId, eventType: 'work_order_completed' } });
    same('sin marca de inspección saltada', (closed.newValue as { inspectionSkipped?: boolean }).inspectionSkipped, undefined);
  });

  it('A156 | R9: el Quality Check no se cancela', async () => {
    const { workOrderId } = await plannedWo('931');
    const qc = laneJob(await adminWo(workOrderId), 'quality_check');
    refused('cancelar el Quality Check', await cancelJob(workOrderId, qc.id), 400, 'QC_NOT_CANCELLABLE');
    same('sigue pendiente', laneJob(await adminWo(workOrderId), 'quality_check').status, 'to_do');
  });

  it('A157 | R11: el Manager no marca el QC completo con trabajo pendiente, igual que Safety', async () => {
    const { truck, workOrderId } = await plannedWo('944');
    refused('QC con todo pendiente', await adminCompleteJob(workOrderId, laneJob(await adminWo(workOrderId), 'quality_check').id), 400, 'QC_NOT_READY');
    await doPm(workOrderId, truck.id);
    await doLane(USERS.alignment, workOrderId, 'alignment');
    refused('QC con Detailing pendiente', await adminCompleteJob(workOrderId, laneJob(await adminWo(workOrderId), 'quality_check').id), 400, 'QC_NOT_READY');
    ok('cancelar Detailing con motivo', await cancelJob(workOrderId, laneJob(await adminWo(workOrderId), 'detailing').id));
    ok('con lo demás hecho o cancelado, sí', await adminCompleteJob(workOrderId, laneJob(await adminWo(workOrderId), 'quality_check').id));
  });

  it('A158 | R15: si todo se canceló, no se cierra: se cancela la Work Order (caso 917 / 823)', async () => {
    const { workOrderId } = await plannedWo('957');
    for (const lane of ['pm', 'alignment', 'detailing'] as const) {
      ok(`cancelar ${lane}`, await cancelJob(workOrderId, laneJob(await adminWo(workOrderId), lane).id));
    }
    ok('Mark QC complete', await adminCompleteJob(workOrderId, laneJob(await adminWo(workOrderId), 'quality_check').id));
    refused('cerrar sin ningún trabajo hecho', await closeWo(workOrderId), 400, 'NOTHING_DONE');
    refused('tampoco con motivo de inspección', await closeWo(workOrderId, { inspectionSkipReason: 'x' }), 400, 'NOTHING_DONE');
    ok('Cancel Work Order', await manager.post(`/admin/work-orders/${workOrderId}/cancel`, { ...(await meta(workOrderId)), reason: 'No se hizo nada.' }));
    same('estado', (await adminWo(workOrderId)).status, 'cancelled');
  });

  it('A159 | R8: el PM no se termina sin millaje, sin partes ni con un millaje por debajo del camión (D10)', async () => {
    const { truck, workOrderId } = await plannedWo('968');
    const pmJob = laneJob(await adminWo(workOrderId), 'pm');
    const pm = as(USERS.pm);
    ok('PM start', await pm.post(`/work-orders/${workOrderId}/jobs/${pmJob.id}/pm/start`));
    refused('terminar sin millaje ni partes', await completeJob(USERS.pm, workOrderId, pmJob.id), 400);

    const { mileage } = await prisma.truck.findUniqueOrThrow({ where: { id: truck.id } });
    await pm.post(`/work-orders/${workOrderId}/pm`, { observedMileage: (mileage ?? 0) + 50, selections: [] });
    refused('terminar con millaje pero sin partes', await completeJob(USERS.pm, workOrderId, pmJob.id), 400);

    refused('guardar un millaje menor al del camión', await savePm(workOrderId, (mileage ?? 0) - 10), 400);
    same('el camión no baja su millaje', (await prisma.truck.findUniqueOrThrow({ where: { id: truck.id } })).mileage, mileage);

    ok('con millaje y una parte, sí', await savePm(workOrderId, (mileage ?? 0) + 100));
    ok('PM finish', await completeJob(USERS.pm, workOrderId, pmJob.id));
    same('PM hecho', laneJob(await adminWo(workOrderId), 'pm').status, 'completed');
  });

  it('A160 | R15 en pantalla: con todo cancelado fuera del QC, el siguiente paso es Cancel Work Order en todas partes', async () => {
    const { truck, workOrderId } = await plannedWo('973');
    for (const lane of ['pm', 'alignment', 'detailing'] as const) {
      ok(`cancelar ${lane}`, await manager.post(`/admin/jobs/${laneJob(await adminWo(workOrderId), lane).id}/cancel`, { ...(await meta(workOrderId)), reason: 'No aplica.' }));
    }
    same('Truck, Work Order, listas y Yard dicen lo mismo', await sameNextStepEverywhere('todo cancelado', workOrderId, truck.id), 'cancel_work_order');
  });
});

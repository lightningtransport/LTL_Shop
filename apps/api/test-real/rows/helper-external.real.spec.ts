/**
 * HU-M10 (D23, LTR-188): the Manager puts a helper on a Job — the helper gets a Job of their own.
 * HU-M11 (D24, LTR-188): the Manager sends a Job to an external shop (the part or the truck) and,
 * when it comes back, completes it or gives it to a mechanic.
 */
import { beforeEach, describe, it } from 'vitest';
import {
  USERS, Json, adminCompleteJob, adminWo, as, closeWo, doLane, doPm, laneJob, manager, mechanicWo, meta, namedJob,
  ok, openSessionUsers, plannedWo, refused, reportBlocker, resetDb, same, sameNextStepEverywhere, start, truthy, userId,
  addShopJobs, completeJob,
} from '../harness';

async function addHelper(workOrderId: string, jobId: string, email: string, actor = manager) {
  return actor.post(`/admin/work-orders/${workOrderId}/jobs/${jobId}/helper`, {
    ...(await meta(workOrderId)),
    mechanicId: await userId(email),
  });
}

async function sendOut(workOrderId: string, jobId: string, kind: 'part' | 'truck', actor = manager) {
  return actor.post(`/admin/work-orders/${workOrderId}/jobs/${jobId}/external`, {
    ...(await meta(workOrderId)),
    kind,
    note: kind === 'part' ? 'La bomba va al taller hidráulico; vuelve el viernes.' : 'El camión va a la carrocería; vuelve el lunes.',
  });
}

async function returned(workOrderId: string, jobId: string, outcome: 'complete' | 'assign', email?: string) {
  return manager.post(`/admin/work-orders/${workOrderId}/jobs/${jobId}/external/return`, {
    ...(await meta(workOrderId)),
    outcome,
    ...(email ? { mechanicId: await userId(email) } : {}),
  });
}

function helperOf(workOrder: Json, parentId: string): Json {
  const job = (workOrder.jobs as Json[]).find((item) => item.helperOfJobId === parentId && item.status !== 'cancelled');
  if (!job) throw new Error('No hay Job de ayudante');
  return job;
}

async function yardCard(truckId: string): Promise<Json> {
  const yard = ok('Yard', await manager.get('/admin/yard-operations?limit=100'));
  const card = (yard.items as Json[]).find((item) => item.truck.id === truckId);
  if (!card) throw new Error('El camión no está en el Yard');
  return card;
}

describe('Ayudante y taller externo (HU-M10, HU-M11 — D23, D24)', () => {
  beforeEach(resetDb);

  it('A34 | Ayudante: Job aparte "· ayudante" con su dueño; su reloj corre a su nombre en ese WO; no deja al mismo dueño, a quien no hace Standard, ni en PM / QC / otro ayudante; el bloqueo del principal no lo bloquea; cancelar el principal no lo cancela; solo el Manager', async () => {
    const { workOrderId } = await plannedWo('905', [{ category: 'Electrical & Starting', job: 'Lights', assignee: USERS.general }]);
    const lights = namedJob(await adminWo(workOrderId), 'Lights');

    refused('un mecánico no agrega ayudantes', await addHelper(workOrderId, lights.id, USERS.spare, as(USERS.general)), 403);
    ok('Agregar ayudante: John en Lights', await addHelper(workOrderId, lights.id, USERS.spare));
    let wo = await adminWo(workOrderId);
    const helper = helperOf(wo, lights.id);
    same('el Job del ayudante: mismo nombre y categoría, dueño John', [helper.displayName, helper.category.name, helper.assignedMechanic?.id, helper.status],
      ['Lights', lights.category.name, await userId(USERS.spare), 'to_do']);
    same('el principal sigue con su dueño', namedJob(wo, 'Lights').assignedMechanic?.id, await userId(USERS.general));
    truthy('John queda en el equipo', (wo.mechanics as Json[]).some((member) => member.mechanicId === helper.assignedMechanic.id), wo.mechanics);

    refused('el mismo dueño no puede ser su ayudante', await addHelper(workOrderId, lights.id, USERS.general), 400, 'HELPER_INVALID_MECHANIC');
    refused('quien no hace trabajo Standard (Safety) no', await addHelper(workOrderId, lights.id, USERS.safety), 400, 'HELPER_INVALID_MECHANIC');
    refused('el mecánico PM no', await addHelper(workOrderId, lights.id, USERS.pm), 400, 'HELPER_INVALID_MECHANIC');
    refused('dos veces el mismo ayudante no', await addHelper(workOrderId, lights.id, USERS.spare), 400, 'HELPER_ALREADY_ADDED');
    refused('no en el PM', await addHelper(workOrderId, laneJob(wo, 'pm').id, USERS.spare), 400, 'HELPER_NOT_ALLOWED_HERE');
    refused('no en el Quality Check', await addHelper(workOrderId, laneJob(wo, 'quality_check').id, USERS.spare), 400, 'HELPER_NOT_ALLOWED_HERE');
    refused('no sobre el Job de un ayudante', await addHelper(workOrderId, helper.id, USERS.detailing), 400, 'HELPER_NOT_ALLOWED_HERE');

    // The helper works: his clock runs on this Work Order under his name.
    const john = await mechanicWo(USERS.spare, workOrderId);
    same('John lo ve en "Tus Jobs"', (john.myJobs as Json[]).map((job) => [job.id, job.helperOfJobId]), [[helper.id, lights.id]]);
    ok('John: Start', await start(USERS.spare, workOrderId));
    ok('Alejandro 2: Start', await start(USERS.general, workOrderId));
    same('relojes corriendo: los dos, cada uno a su nombre', await openSessionUsers(workOrderId),
      [await userId(USERS.general), await userId(USERS.spare)].sort());

    // The parent is blocked: the helper's Job is not.
    ok('Alejandro 2 bloquea Lights', await reportBlocker(USERS.general, workOrderId, lights.id));
    const johnAfter = await mechanicWo(USERS.spare, workOrderId);
    same('el Job del ayudante no queda bloqueado', johnAfter.myJobs[0].workStatus, 'in_progress');
    same('el reloj de John sigue; el de Alejandro 2 se detuvo', await openSessionUsers(workOrderId), [await userId(USERS.spare)]);

    // The parent is cancelled: the helper's Job stays (the Manager decides).
    ok('el Manager cancela Lights', await manager.post(`/admin/jobs/${lights.id}/cancel`, { ...(await meta(workOrderId)), reason: 'Lo termina el ayudante.' }));
    wo = await adminWo(workOrderId);
    same('el principal cancelado; el del ayudante sigue pendiente', [namedJob(wo, 'Lights').status, (wo.jobs as Json[]).find((job) => job.id === helper.id)?.status],
      ['cancelled', 'to_do']);
    // The duplicate guard ignores helper Jobs: with the parent cancelled, Lights can be added again.
    ok('volver a agregar Lights no choca con el Job del ayudante', await addShopJobs(wo.truck.id, workOrderId, [{ category: 'Electrical & Starting', job: 'Lights', assignee: USERS.general }]));
    ok('John completa su parte', await completeJob(USERS.spare, workOrderId, helper.id));
    same('al completar su último Job, el reloj de John se detiene', await openSessionUsers(workOrderId), []);
  });

  it('A35 | Taller externo: sale la pieza o el camión con nota; sin dueño, sin reloj y sin "sin asignar"; siguiente paso "En taller externo" igual en todas las pantallas; no se puede cerrar; los demás Jobs siguen; el Yard dice "Fuera del taller"; solo el Manager; "Regresó" → completar o asignar', async () => {
    const { truck, workOrderId } = await plannedWo('968', [
      { category: 'Air & Brake System', job: 'Air Dryer', assignee: USERS.general },
      { category: 'Electrical & Starting', job: 'Battery', assignee: USERS.spare },
    ]);
    let wo = await adminWo(workOrderId);
    const airDryer = namedJob(wo, 'Air Dryer');
    ok('Alejandro 2: Start', await start(USERS.general, workOrderId));

    refused('un mecánico no envía a taller externo', await sendOut(workOrderId, airDryer.id, 'part', as(USERS.general)), 403);
    refused('el Quality Check no sale', await sendOut(workOrderId, laneJob(wo, 'quality_check').id, 'part'), 400, 'EXTERNAL_NOT_ALLOWED_HERE');
    refused('la nota es obligatoria', await manager.post(`/admin/work-orders/${workOrderId}/jobs/${airDryer.id}/external`, { ...(await meta(workOrderId)), kind: 'part', note: '' }), 400);
    ok('Enviar a taller externo: sale la pieza', await sendOut(workOrderId, airDryer.id, 'part'));
    refused('ya está afuera', await sendOut(workOrderId, airDryer.id, 'part'), 400, 'EXTERNAL_ALREADY');

    wo = await adminWo(workOrderId);
    const out = namedJob(wo, 'Air Dryer');
    same('afuera: sigue pendiente, sin dueño, con la pieza y la nota', [out.status, out.assignedMechanic, out.external?.kind, Boolean(out.external?.note)], ['to_do', null, 'part', true]);
    same('el reloj de Alejandro 2 se cerró (era su único Job)', await openSessionUsers(workOrderId), []);
    truthy('no cuenta como "sin asignar"', wo.attentionReason !== 'unassigned', wo.attentionReason);
    same('los demás Jobs siguen: siguiente paso "work" igual en todas las pantallas', await sameNextStepEverywhere('con Jobs en el taller', workOrderId, truck.id), 'work');
    refused('un plain Assign no lo trae de vuelta', await manager.post(`/admin/work-orders/${workOrderId}/jobs/${airDryer.id}/assign`, { ...(await meta(workOrderId)), mechanicId: await userId(USERS.spare) }), 400, 'JOB_AT_EXTERNAL_SHOP');

    const john = await mechanicWo(USERS.spare, workOrderId);
    const other = (john.otherJobs as Json[]).find((job) => job.id === airDryer.id);
    same('el mecánico lo ve en "Other work" como externo, nunca como suyo', [other?.external?.kind, (john.myJobs as Json[]).some((job) => job.id === airDryer.id)], ['part', false]);
    same('la pieza afuera: el Yard no dice "Fuera del taller"', (await yardCard(truck.id)).outOfShop, false);

    // The rest of the truck goes on: Battery, PM, Alignment, Detailing and the Quality Check.
    ok('John: Start', await start(USERS.spare, workOrderId));
    ok('John completa Battery', await completeJob(USERS.spare, workOrderId, namedJob(await adminWo(workOrderId), 'Battery').id));
    await doPm(workOrderId, truck.id);
    await doLane(USERS.alignment, workOrderId, 'alignment');
    await doLane(USERS.detailing, workOrderId, 'detailing');
    same('solo queda lo de afuera (y QC): siguiente paso "external" igual en todas las pantallas',
      await sameNextStepEverywhere('pieza afuera', workOrderId, truck.id), 'external');
    wo = await adminWo(workOrderId);
    same('el siguiente paso nombra el Job y qué salió', [wo.nextStep.jobName, wo.nextStep.externalKind], ['Air Dryer', 'part']);
    // D55 R11: the Quality Check waits for what is outside, like Safety's (QC_NOT_READY).
    refused('el QC no se marca con una pieza afuera', await adminCompleteJob(workOrderId, laneJob(wo, 'quality_check').id), 400, 'QC_NOT_READY');
    refused('no se puede cerrar el WO con un Job afuera', await closeWo(workOrderId), 400);
    truthy('el camión no está Ready to Go', (await yardCard(truck.id)).phase !== 'ready_to_go');

    // It comes back and needs installing: assign it; the mechanic's clock runs as usual.
    refused('asignar exige mecánico', await returned(workOrderId, airDryer.id, 'assign'), 400);
    ok('Regresó → asignar a Alejandro 1', await returned(workOrderId, airDryer.id, 'assign', USERS.alignment));
    wo = await adminWo(workOrderId);
    same('de vuelta: dueño Alejandro 1, ya no externo', [namedJob(wo, 'Air Dryer').assignedMechanic?.id, namedJob(wo, 'Air Dryer').external], [await userId(USERS.alignment), null]);
    ok('Alejandro 1: Continue', await start(USERS.alignment, workOrderId));
    same('su reloj corre en este WO', await openSessionUsers(workOrderId), [await userId(USERS.alignment)]);
    ok('Alejandro 1 lo instala', await completeJob(USERS.alignment, workOrderId, airDryer.id));
    same('instalado: ahora sí el Quality Check', await sameNextStepEverywhere('instalado', workOrderId, truck.id), 'qc');
    ok('Mark QC complete', await adminCompleteJob(workOrderId, laneJob(await adminWo(workOrderId), 'quality_check').id));
    same('todo listo: siguiente paso "close"', await sameNextStepEverywhere('QC hecho', workOrderId, truck.id), 'close');
    ok('Close WO', await closeWo(workOrderId));

    // The whole truck goes out: the Yard card says "Out of the shop"; back → complete.
    const second = await plannedWo('922', [{ category: 'Air & Brake System', job: 'Air Leak', assignee: USERS.general }]);
    const airLeak = namedJob(await adminWo(second.workOrderId), 'Air Leak');
    ok('Enviar a taller externo: sale el camión', await sendOut(second.workOrderId, airLeak.id, 'truck'));
    const card = await yardCard(second.truck.id);
    same('el Yard: "Fuera del taller", la fase no cambia', [card.outOfShop, card.phase], [true, 'shop_work']);
    ok('Regresó → completar', await returned(second.workOrderId, airLeak.id, 'complete'));
    const back = namedJob(await adminWo(second.workOrderId), 'Air Leak');
    same('completado por el Manager', [back.status, back.completedBy?.id, back.external], ['completed', await userId(USERS.manager), null]);
    same('el Yard ya no dice "Fuera del taller"', (await yardCard(second.truck.id)).outOfShop, false);
  });
});

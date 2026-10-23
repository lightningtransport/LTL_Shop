import { beforeEach, describe, it } from 'vitest';
import {
  USERS, Json, activeBlocker, adminWo, as, completeJob, laneJob, laneOf, manager, mechanicWo, namedJob, ok,
  openSessionUsers, plannedWo, prisma, refused, reportBlocker, resetDb, same, sameNextStepEverywhere, start, truthy, userId, helpOn,
} from '../harness';

const openSessions = (workOrder: Json) => (workOrder.laborSessions as Json[]).filter((session) => !session.endedAt);

describe('Mecánico Standard: ver, trabajar, bloquear', () => {
  beforeEach(resetDb);

  it('A5 | MECH01: el mecánico ve solo sus Jobs; "Other work" solo lectura', async () => {
    const { workOrderId } = await plannedWo('905');
    const list = ok('lista del mecánico', await as(USERS.alignment).get('/work-orders?mode=standard'));
    const all = [...list.created, ...list.active, ...list.paused] as Json[];
    truthy('el WO aparece en su lista', all.some((item) => item.id === workOrderId), all.map((item) => item.displayId));

    const detail = await mechanicWo(USERS.alignment, workOrderId);
    same('Your Jobs = solo Alignment', (detail.myJobs as Json[]).map(laneOf), ['alignment']);
    same('Other work = el resto', (detail.otherJobs as Json[]).map(laneOf).sort(), ['detailing', 'pm', 'quality_check']);

    const detailing = laneJob(await adminWo(workOrderId), 'detailing');
    ok('Start', await start(USERS.alignment, workOrderId));
    refused('no puede completar el Job de otro', await completeJob(USERS.alignment, workOrderId, detailing.id), 403, 'JOB_NOT_ASSIGNED_TO_YOU');
    refused('quien no tiene Jobs ahí no lo puede leer', await as(USERS.general).get(`/work-orders/${workOrderId}`), 403);
    const others = ok('lista de otro mecánico', await as(USERS.general).get('/work-orders?mode=standard'));
    same('no aparece en la lista de otro', [...others.created, ...others.active, ...others.paused].length, 0);
  });

  it('A6 | MECH02: Start → WO pasa a in_progress, abre sesión → completar Jobs → "Terminaste tu parte" cierra sesión', async () => {
    const { truck, workOrderId } = await plannedWo('922', [
      { category: 'Electrical & Starting', job: 'Battery', assignee: USERS.general },
      { category: 'Electrical & Starting', job: 'Lights', assignee: USERS.general },
    ]);
    same('antes de Start', (await adminWo(workOrderId)).status, 'created');

    ok('Start', await start(USERS.general, workOrderId));
    let workOrder = await adminWo(workOrderId);
    same('Start pasa el WO a in_progress', workOrder.status, 'in_progress');
    same('una sesión abierta, del mecánico', await openSessionUsers(workOrderId), [await userId(USERS.general)]);
    same('su tiempo corre', (await mechanicWo(USERS.general, workOrderId)).laborRunning, true);
    same('Job en curso', namedJob((await manager.get(`/admin/trucks/${truck.id}`)).json.workPlan, 'Battery').uiStatus, 'in_progress');

    ok('completa Battery', await completeJob(USERS.general, workOrderId, namedJob(workOrder, 'Battery').id));
    same('le queda un Job: su tiempo sigue', openSessions(await adminWo(workOrderId)).length, 1);
    same('todavía no terminó su parte', (await mechanicWo(USERS.general, workOrderId)).myPartDone, false);

    ok('completa Lights', await completeJob(USERS.general, workOrderId, namedJob(workOrder, 'Lights').id));
    workOrder = await adminWo(workOrderId);
    same('terminó su parte: se cierra su sesión', openSessions(workOrder).length, 0);
    same('Terminaste tu parte', (await mechanicWo(USERS.general, workOrderId)).myPartDone, true);
    same('completar Jobs no completa el WO', workOrder.status, 'in_progress');
    truthy('el tiempo de trabajo quedó registrado', (workOrder.laborSessions as Json[]).length === 1 && workOrder.laborSessions[0].endedAt);
    await sameNextStepEverywhere('quedan Jobs de otros', workOrderId, truck.id, 'work');
  });

  it('A7 | MECH03: reportar bloqueo → notas → Manager resuelve → Continue', async () => {
    const { truck, workOrderId } = await plannedWo('931', [
      { category: 'Suspension & Steering', job: 'Air Bag Replacement', assignee: USERS.general },
    ]);
    ok('Start', await start(USERS.general, workOrderId));
    const job = namedJob(await adminWo(workOrderId), 'Air Bag Replacement');
    const waitingBefore = (await adminWo(workOrderId)).totalWaitingMs;

    ok('reportar bloqueo', await reportBlocker(USERS.general, workOrderId, job.id));
    const blocker = await activeBlocker(workOrderId);
    truthy('el bloqueo queda activo y es del Job', blocker?.jobId === job.id, blocker);
    let workOrder = await adminWo(workOrderId);
    same('el bloqueo no pausa el WO', workOrder.status, 'in_progress');
    same('el bloqueo no suma tiempo de espera', workOrder.totalWaitingMs, waitingBefore);
    same('era su último Job disponible: su tiempo se detiene (D18)', openSessions(workOrder).length, 0);
    same('Job bloqueado', namedJob((await manager.get(`/admin/trucks/${truck.id}`)).json.workPlan, 'Air Bag Replacement').uiStatus, 'blocked');
    await sameNextStepEverywhere('bloqueado', workOrderId, truck.id, 'resolve_blocker');

    ok('nota en el bloqueo', await as(USERS.general).post(`/work-orders/${workOrderId}/blockers/${blocker!.id}/notes`, { body: 'Ya llegó la pieza.' }));
    refused('no puede completar un Job bloqueado', await completeJob(USERS.general, workOrderId, job.id), 400, 'JOB_BLOCKED');
    refused('un solo bloqueo activo por Job', await reportBlocker(USERS.general, workOrderId, job.id), 409);
    refused('el mecánico no resuelve', await as(USERS.general).post(`/admin/work-orders/${workOrderId}/blockers/${blocker!.id}/resolve`), 403);

    ok('el Manager resuelve', await manager.post(`/admin/work-orders/${workOrderId}/blockers/${blocker!.id}/resolve`, { notes: 'Pieza entregada.' }));
    same('sin bloqueo activo', await activeBlocker(workOrderId), null);
    same('resolver no arranca el tiempo solo', openSessions(await adminWo(workOrderId)).length, 0);
    await sameNextStepEverywhere('resuelto', workOrderId, truck.id, 'work');

    ok('Continue', await start(USERS.general, workOrderId));
    same('su tiempo corre otra vez', openSessions(await adminWo(workOrderId)).length, 1);
    ok('completa el Job', await completeJob(USERS.general, workOrderId, job.id));
  });

  it('A8 | M03: pausa oficial → cierra sesiones → Resume reabre las mismas', async () => {
    const { truck, workOrderId } = await plannedWo('944', [
      { category: 'Electrical & Starting', job: 'Battery', assignee: USERS.general },
    ]);
    refused('no se pausa un WO que no ha empezado', await manager.post(`/admin/work-orders/${workOrderId}/pause`, { reason: 'waiting_for_parts' }), 400);
    ok('Start general', await start(USERS.general, workOrderId));
    // D57 §3: one area at a time; two clocks on one truck means one helps the other (D23).
    await helpOn(USERS.alignment, workOrderId, 'Battery');
    ok('Start alignment (ayudante)', await start(USERS.alignment, workOrderId));
    same('dos sesiones abiertas', openSessions(await adminWo(workOrderId)).length, 2);

    refused('el mecánico no pausa (LTR-180: el endpoint ya no existe)', await as(USERS.general).post(`/work-orders/${workOrderId}/pause`, { reason: 'waiting_for_parts' }), 404);
    refused('motivo "other" exige nota', await manager.post(`/admin/work-orders/${workOrderId}/pause`, { reason: 'other' }), 400);
    ok('pausa oficial', await manager.post(`/admin/work-orders/${workOrderId}/pause`, { reason: 'truck_unavailable', notes: 'El camión salió a prueba.' }));
    let workOrder = await adminWo(workOrderId);
    same('estado', workOrder.status, 'waiting_paused');
    same('se cierran todas las sesiones', openSessions(workOrder).length, 0);
    await sameNextStepEverywhere('pausado', workOrderId, truck.id, 'resume');
    refused('no se trabaja en un WO pausado', await start(USERS.general, workOrderId), 400);

    ok('Resume', await manager.post(`/admin/work-orders/${workOrderId}/resume`));
    workOrder = await adminWo(workOrderId);
    same('estado', workOrder.status, 'in_progress');
    same(
      'Resume reabre las sesiones de los mismos mecánicos',
      await openSessionUsers(workOrderId),
      [await userId(USERS.general), await userId(USERS.alignment)].sort(),
    );
    truthy('la pausa quedó cerrada en el historial', (workOrder.pauseHistory as Json[]).every((pause) => pause.endedAt), workOrder.pauseHistory);
    const pauses = await prisma.pauseEvent.count({ where: { workOrderId, isOfficialPause: true } });
    same('una pausa oficial registrada', pauses, 1);
  });
});

/** D57 §3 (LTR-306): a truck is worked by one area at a time. */
describe('Un camión a la vez: quien toca Start se lleva el camión (D57 §3)', () => {
  beforeEach(resetDb);

  it('A171 | El de Alignment toca Start y se lleva el camión: el general no puede empezar (TRUCK_BUSY), lo ve "con él" y el Yard dice quién lo tiene; al completar lo suelta; un bloqueo también; el PM espera; el cierre del día no lo suelta', async () => {
    const { truck, workOrderId } = await plannedWo('944', [{ category: 'Electrical & Starting', job: 'Battery', assignee: USERS.general }]);
    const plan = async () => ok('Work Plan', await manager.get(`/admin/trucks/${truck.id}/work-plan`));
    same('nadie lo tiene: espera un mecánico', [(await plan()).phase, (await plan()).holder ?? null], ['waiting_for_mechanic', null]);

    ok('el de Alignment toca Start', await start(USERS.alignment, workOrderId));
    const taken = await plan();
    same('el camión es del de Alignment', [taken.phase, taken.holder?.mechanic.id, taken.holder?.jobName], ['alignment', await userId(USERS.alignment), 'Alignment']);
    refused('el general no puede empezar', await start(USERS.general, workOrderId), 409, 'TRUCK_BUSY');
    same('el general lo ve con el de Alignment', (await mechanicWo(USERS.general, workOrderId)).truckBusy?.holder.id, await userId(USERS.alignment));
    same('el de Alignment no se ve a sí mismo como ocupado', (await mechanicWo(USERS.alignment, workOrderId)).truckBusy ?? null, null);

    // D20: the day close stops the clock, not the hold.
    await prisma.workSession.updateMany({ where: { workOrderId, endedAt: null }, data: { endedAt: new Date(), endReason: 'day_close' } });
    refused('después del cierre del día sigue siendo suyo', await start(USERS.general, workOrderId), 409, 'TRUCK_BUSY');
    ok('al día siguiente el de Alignment toca Continue', await start(USERS.alignment, workOrderId));

    const alignmentJob = laneJob(await adminWo(workOrderId), 'alignment');
    ok('completa Alignment', await completeJob(USERS.alignment, workOrderId, alignmentJob.id));
    same('completar lo suelta', (await plan()).holder ?? null, null);
    ok('ahora el general empieza', await start(USERS.general, workOrderId));
    same('el camión es del general, en Shop Work', [(await plan()).phase, (await plan()).holder?.mechanic.id], ['shop_work', await userId(USERS.general)]);

    const pmJob = laneJob(await adminWo(workOrderId), 'pm');
    refused('el PM espera mientras el general lo tiene', await as(USERS.pm).post(`/work-orders/${workOrderId}/jobs/${pmJob.id}/pm/start`), 409, 'TRUCK_BUSY');

    const battery = namedJob(await adminWo(workOrderId), 'Battery');
    ok('el general reporta un bloqueo', await reportBlocker(USERS.general, workOrderId, battery.id));
    same('un bloqueo lo suelta', (await plan()).holder ?? null, null);
    ok('el PM empieza', await as(USERS.pm).post(`/work-orders/${workOrderId}/jobs/${pmJob.id}/pm/start`));
    same('el camión es del PM', [(await plan()).phase, (await plan()).holder?.mechanic.id], ['pm', await userId(USERS.pm)]);

    // The queues do not offer a truck someone else has (D28 and the shop queue, D57 §5).
    const queued = await prisma.workOrderJob.create({ data: {
      workOrderId, catalogJobId: battery.catalogJobId, categoryId: battery.category.id, displayName: 'Lights',
      isCustom: false, addedById: await userId(USERS.manager), status: 'to_do', workflowStepKey: 'shop_work',
    } });
    const inQueue = async () => (ok('cola de John', await as(USERS.spare).get('/team-queue')) as Json[]).some((item) => item.jobId === queued.id);
    same('con el PM trabajando, la reparación no aparece disponible', await inQueue(), false);
    await prisma.workOrderJob.update({ where: { id: pmJob.id }, data: { status: 'completed', completedAt: new Date() } });
    same('cuando el PM termina, aparece', await inQueue(), true);
  });
});

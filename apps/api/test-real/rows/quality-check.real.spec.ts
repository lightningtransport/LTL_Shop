import { beforeEach, describe, it } from 'vitest';
import {
  USERS, Json, activeBlocker, adminWo, as, assign, closeWo, completeJob, doLane, doPm, laneJob, manager, meta, namedJob,
  ok, openSessionUsers, plannedWo, prisma, refused, reportBlocker, resetDb, same, sameNextStepEverywhere, start, truckDetail,
  truthy, userId,
} from '../harness';

const safety = as(USERS.safety);
const safety2 = as(USERS.safety2);

/** A truck with everything done except the Quality Check. */
async function readyForQc(truckNumber: string) {
  const planned = await plannedWo(truckNumber);
  await doPm(planned.workOrderId, planned.truck.id);
  await doLane(USERS.alignment, planned.workOrderId, 'alignment');
  await doLane(USERS.detailing, planned.workOrderId, 'detailing');
  return planned;
}

const queue = async (actor = safety) => ok('lista de Safety', await actor.get('/qc/queue'));
const inQueue = (list: Json, workOrderId: string) => (list as Json[]).find((item) => item.workOrderId === workOrderId) ?? null;

describe('Safety: Quality Check (D19)', () => {
  beforeEach(resetDb);

  it('QC1 | Safety ve solo los camiones con todo lo demás hecho', async () => {
    const ready = await readyForQc('905');
    const working = await plannedWo('922', [{ category: 'Electrical & Starting', job: 'Lights', assignee: USERS.general }]);
    const fresh = await plannedWo('931');
    const list = await queue();
    same('por revisar', (list.pending as Json[]).map((item) => item.workOrderId), [ready.workOrderId]);
    same('nada devuelto', list.returned, []);
    truthy('el que tiene trabajo pendiente no aparece', !inQueue(list.pending, working.workOrderId) && !inQueue(list.pending, fresh.workOrderId));
    const item = inQueue(list.pending, ready.workOrderId);
    same('dice qué se hizo', [...item.doneJobs].sort(), ['Alignment', 'Detailing', 'PM A Service']);
    same('y quién', [...item.mechanics].sort(), ['Alejandro 1', 'Anthony', 'Daniel']);
    same('sin tomar', item.takenBy, null);
    refused('no puede tomar uno que no está listo', await safety.post(`/qc/${working.workOrderId}/take`), 400, 'QC_NOT_READY');
  });

  it('QC2 | Tomar y aprobar: el primero gana; aprobar deja el camión listo para cerrar', async () => {
    const { truck, workOrderId } = await readyForQc('905');
    const taken = ok('Safety 1 toma', await safety.post(`/qc/${workOrderId}/take`));
    // Q1: the reply is the queue after the change (not before), so the screen shows "mine" right away.
    same('la respuesta ya lo muestra como suyo', inQueue(taken.pending, workOrderId)?.mine, true);
    refused('Safety 2 ya no puede tomarlo', await safety2.post(`/qc/${workOrderId}/take`), 409, 'QC_TAKEN');
    let item = inQueue((await queue(safety2)).pending, workOrderId);
    same('Safety 2 lo ve tomado por Safety 1', item.takenBy?.name, 'Safety 1');
    same('para Safety 2 no es suyo', item.mine, false);
    same('el Job de QC es de Safety 1', laneJob(await adminWo(workOrderId), 'quality_check').assignedMechanic?.id, await userId(USERS.safety));
    refused('Safety 2 no puede aprobar lo que no tomó', await safety2.post(`/qc/${workOrderId}/approve`), 400, 'QC_NOT_TAKEN');
    await sameNextStepEverywhere('esperando QC', workOrderId, truck.id, 'qc');

    const approved = ok('Safety 1 aprueba', await safety.post(`/qc/${workOrderId}/approve`));
    same('la respuesta ya no lo tiene por revisar', inQueue(approved.pending, workOrderId), null);
    const workOrder = await adminWo(workOrderId);
    const qc = laneJob(workOrder, 'quality_check');
    same('QC completado', qc.status, 'completed');
    same('por Safety 1', qc.completedBy?.id, await userId(USERS.safety));
    same('Safety no registra tiempo', await openSessionUsers(workOrderId), []);
    same('sin registro en la tabla de equipo (solo aparece derivado, como el PM)', await prisma.mechanicAssignment.count({ where: { workOrderId, mechanicId: await userId(USERS.safety) } }), 0);
    await sameNextStepEverywhere('listo para cerrar', workOrderId, truck.id, 'close');
    same('sale de la lista de Safety', inQueue((await queue()).pending, workOrderId), null);
    ok('el Manager cierra', await closeWo(workOrderId));
  });

  it('QC3 | Devolver con nota: el Manager lo ve, agrega el trabajo y el camión vuelve a Safety', async () => {
    const { truck, workOrderId } = await readyForQc('905');
    ok('tomar', await safety.post(`/qc/${workOrderId}/take`));
    refused('devolver exige decir qué encontró', await safety.post(`/qc/${workOrderId}/return`, { notes: '   ' }), 400, 'QC_NOTE_REQUIRED');
    const returnedReply = ok('devolver', await safety.post(`/qc/${workOrderId}/return`, { notes: 'Fuga en la manguera del freno trasero.' }));
    same('la respuesta ya lo tiene en devueltos', inQueue(returnedReply.returned, workOrderId)?.note, 'Fuga en la manguera del freno trasero.');

    const blocker = await activeBlocker(workOrderId);
    same('queda como bloqueo del Job de QC', blocker?.blockerReason, 'quality_check_failed');
    let workOrder = await adminWo(workOrderId);
    same('el QC queda libre para cualquiera de Safety', laneJob(workOrder, 'quality_check').assignedMechanic, null);
    const reported = (workOrder.reportedBlockers as Json[])[0];
    same('con la nota y quién', [reported.notes, reported.reportedBy?.name], ['Fuga en la manguera del freno trasero.', 'Safety 1']);
    const list = await queue();
    same('ya no está por revisar', inQueue(list.pending, workOrderId), null);
    same('está en devueltos, con la nota', inQueue(list.returned, workOrderId)?.note, 'Fuga en la manguera del freno trasero.');
    refused('no se puede volver a tomar mientras el Manager no resuelva', await safety2.post(`/qc/${workOrderId}/take`), 400, 'QC_RETURNED');

    const dashboard = ok('Dashboard', await manager.get('/admin/dashboard'));
    const attention = (dashboard.attention as Json[]).find((item) => item.id === workOrderId);
    same('el Manager lo ve en Needs attention como bloqueo', attention?.attentionReason, 'blocker');
    same('con el motivo de Safety', attention?.latestReportedBlocker?.blockerReason, 'quality_check_failed');
    await sameNextStepEverywhere('devuelto', workOrderId, truck.id, 'resolve_blocker');

    ok('el Manager agrega el trabajo', await manager.post(`/admin/trucks/${truck.id}/work-plan/jobs`, {
      ...(await meta(workOrderId)),
      jobs: [{ ...(await catalogRow('Air & Brake System', 'Brake Inspection')), assignedMechanicId: await userId(USERS.general) }],
    }));
    ok('y resuelve', await manager.post(`/admin/work-orders/${workOrderId}/blockers/${blocker!.id}/resolve`, { notes: 'Trabajo agregado.' }));
    same('mientras el trabajo está pendiente, Safety no lo ve', inQueue((await queue()).pending, workOrderId), null);

    ok('el mecánico hace el trabajo', await start(USERS.general, workOrderId));
    ok('completa', await completeJob(USERS.general, workOrderId, namedJob(await adminWo(workOrderId), 'Brake Inspection').id));
    truthy('el camión vuelve a la lista de Safety', inQueue((await queue()).pending, workOrderId));
    ok('Safety 2 lo toma esta vez', await safety2.post(`/qc/${workOrderId}/take`));
    ok('y aprueba', await safety2.post(`/qc/${workOrderId}/approve`));
    same('QC por Safety 2', laneJob(await adminWo(workOrderId), 'quality_check').completedBy?.id, await userId(USERS.safety2));
    same('sin bloqueos', await activeBlocker(workOrderId), null);
    await sameNextStepEverywhere('listo para cerrar', workOrderId, truck.id, 'close');
  });

  it('QC4 | Safety no puede hacer nada más; el motivo "Devuelto por Safety" es solo suyo', async () => {
    const { truck, workOrderId } = await readyForQc('905');
    refused('Safety: entrar a Admin', await safety.get('/admin/dashboard'), 403);
    refused('Safety: lista de mecánico', await safety.get('/work-orders?mode=standard'), 403);
    refused('Safety: cerrar el WO', await safety.post(`/admin/work-orders/${workOrderId}/complete`, await meta(workOrderId)), 403);
    refused('Safety: inspeccionar', await safety.post(`/admin/trucks/${truck.id}/work-plan/inspection`, { outcome: 'no_issues_found', idempotencyKey: crypto.randomUUID() }), 403);
    refused('un mecánico no entra a la lista de Safety', await as(USERS.general).get('/qc/queue'), 403);
    refused('el Manager tampoco (no es su pantalla)', await manager.get('/qc/queue'), 403);

    const other = await plannedWo('922', [{ category: 'Electrical & Starting', job: 'Lights', assignee: USERS.general }]);
    ok('Start', await start(USERS.general, other.workOrderId));
    refused('un mecánico no puede usar el motivo de Safety', await reportBlocker(USERS.general, other.workOrderId, namedJob(await adminWo(other.workOrderId), 'Lights').id, 'quality_check_failed'), 400, 'BLOCKER_REASON_NOT_ALLOWED');
  });

  it('QC5 | El Manager conserva "Mark QC complete" como respaldo, y puede dar el QC a alguien de Safety', async () => {
    const { truck, workOrderId } = await readyForQc('905');
    const qc = laneJob(await adminWo(workOrderId), 'quality_check');
    ok('asignar QC a Safety 2', await assign(workOrderId, qc.id, USERS.safety2));
    same('Safety 2 lo ve como suyo', inQueue((await queue(safety2)).pending, workOrderId)?.mine, true);
    const roster = ok('roster', await manager.get('/admin/mechanics'));
    truthy('el roster muestra a Safety', (roster.items as Json[]).some((item) => item.email === USERS.safety), roster.items?.map((i: Json) => i.email));
    const pickers = ok('selector de mecánicos', await manager.get('/admin/mechanics?assignable=true'));
    truthy('el selector de Jobs no ofrece a Safety', !(pickers.items as Json[]).some((item) => item.email === USERS.safety));
    ok('Mark QC complete (respaldo del Manager)', await manager.post(`/admin/jobs/${qc.id}/complete`, { ...(await meta(workOrderId)), notes: 'Safety avisó por teléfono.' }));
    await sameNextStepEverywhere('listo para cerrar', workOrderId, truck.id, 'close');
  });
});

async function catalogRow(category: string, job: string) {
  const row = await prisma.catalogJob.findFirstOrThrow({ where: { displayName: job, status: 'active', category: { name: category, status: 'active' } } });
  return { catalogJobId: row.id, categoryId: row.categoryId, displayName: row.displayName };
}

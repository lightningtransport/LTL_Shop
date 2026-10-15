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
    // Q11: los Jobs agregados juntos empatan en addedAt; el orden ya no cambia entre una carga y otra.
    const jobRows = await prisma.workOrderJob.findMany({
      where: { workOrderId: ready.workOrderId, status: 'completed' },
      orderBy: [{ addedAt: 'asc' }, { id: 'asc' }],
      select: { displayName: true },
    });
    same('los Jobs salen en un orden fijo', item.doneJobs, jobRows.map((job) => job.displayName));
    same('y otra carga da el mismo orden', inQueue((await queue()).pending, ready.workOrderId).doneJobs, item.doneJobs);
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
    // Q2: la revisión muestra la devolución anterior con lo que hizo el Manager, y el trabajo nuevo.
    const review = ok('la revisión del camión', await safety2.get(`/qc/${workOrderId}`));
    same('la devolución anterior, con la respuesta del Manager', (review.previousReturns as Json[]).map((item) => [item.note, item.returnedBy, item.resolution]), [['Fuga en la manguera del freno trasero.', 'Safety 1', 'Trabajo agregado.']]);
    same('el trabajo nuevo aparece hecho, con quién', (review.jobs as Json[]).find((job) => job.name === 'Brake Inspection')?.mechanic?.id, await userId(USERS.general));
    ok('Safety 2 lo toma esta vez', await safety2.post(`/qc/${workOrderId}/take`));
    ok('y aprueba', await safety2.post(`/qc/${workOrderId}/approve`));
    same('QC por Safety 2', laneJob(await adminWo(workOrderId), 'quality_check').completedBy?.id, await userId(USERS.safety2));
    same('sin bloqueos', await activeBlocker(workOrderId), null);
    await sameNextStepEverywhere('listo para cerrar', workOrderId, truck.id, 'close');
  });

  it('QC4 | Safety no puede hacer nada más; el motivo "Devuelto por Safety" es solo suyo; un mecánico no entra a la lista de Safety', async () => {
    const { truck, workOrderId } = await readyForQc('905');
    refused('Safety: entrar a Admin', await safety.get('/admin/dashboard'), 403);
    refused('Safety: lista de mecánico', await safety.get('/work-orders?mode=standard'), 403);
    refused('Safety: cerrar el WO', await safety.post(`/admin/work-orders/${workOrderId}/complete`, await meta(workOrderId)), 403);
    refused('Safety: inspeccionar', await safety.post(`/admin/trucks/${truck.id}/work-plan/inspection`, { outcome: 'no_issues_found', idempotencyKey: crypto.randomUUID() }), 403);
    refused('un mecánico no entra a la lista de Safety', await as(USERS.general).get('/qc/queue'), 403);
    // LTR-197 / D29: the Manager now uses this screen as Safety's backup (QC11).

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

describe('Safety: la pantalla nueva (bloque B, D-QC1…D-QC6)', () => {
  beforeEach(resetDb);

  it('QC6 | Let go: Safety suelta el camión que tomó y la otra persona lo puede tomar (D-QC2)', async () => {
    const { workOrderId } = await readyForQc('905');
    ok('Safety 1 lo toma', await safety.post(`/qc/${workOrderId}/take`));
    refused('Safety 2 no puede soltar lo que no tomó', await safety2.post(`/qc/${workOrderId}/release`), 400, 'QC_NOT_TAKEN');
    const released = ok('Safety 1 lo suelta', await safety.post(`/qc/${workOrderId}/release`));
    same('la respuesta ya lo muestra libre', [inQueue(released.pending, workOrderId)?.takenBy, inQueue(released.pending, workOrderId)?.mine], [null, false]);
    same('el Job de QC queda sin dueño', laneJob(await adminWo(workOrderId), 'quality_check').assignedMechanic, null);
    const log = await prisma.activityLog.findFirst({ where: { workOrderId, relevantValue: { path: ['action'], equals: 'quality_check_released' } } });
    truthy('queda en el Activity Log', log);
    ok('Safety 2 lo toma', await safety2.post(`/qc/${workOrderId}/take`));
  });

  it('QC7 | Revisión del camión: qué se hizo, con quién, cuándo y la nota; el PM; solo para camiones de la lista (Q2)', async () => {
    const { workOrderId } = await readyForQc('905');
    const working = await plannedWo('922', [{ category: 'Electrical & Starting', job: 'Lights', assignee: USERS.general }]);
    const review = ok('la revisión', await safety.get(`/qc/${workOrderId}`));
    same('los Jobs hechos', (review.jobs as Json[]).map((job) => job.name).sort(), ['Alignment', 'Detailing', 'PM A Service']);
    truthy('cada uno con quién y cuándo', (review.jobs as Json[]).every((job) => job.mechanic?.name && job.completedAt));
    same('el PM marcado como PM', (review.jobs as Json[]).filter((job) => job.isPm).map((job) => job.name), ['PM A Service']);
    truthy('el PM con millaje y piezas', review.pm && typeof review.pm.observedMileage === 'number' && review.pm.parts.length > 0, review.pm);
    truthy('la inspección con su resultado', ['issues_found', 'no_issues_found', 'not_recorded'].includes(review.inspection?.outcome), review.inspection);
    same('sin bloqueos ni devoluciones', [review.blockers, review.previousReturns], [[], []]);
    same('trae lo de la lista (sin tomar)', [review.displayId, review.takenBy], [inQueue((await queue()).pending, workOrderId)?.displayId, null]);
    refused('un camión con trabajo pendiente no se revisa', await safety.get(`/qc/${working.workOrderId}`), 404, 'QC_NOT_LISTED');
    refused('un mecánico no ve la revisión', await as(USERS.general).get(`/qc/${workOrderId}`), 403);
  });

  it('QC8 | Devolver diciendo qué Job falló: el Manager lo lee al principio de la nota (D-QC3)', async () => {
    const { workOrderId } = await readyForQc('905');
    ok('tomar', await safety.post(`/qc/${workOrderId}/take`));
    const workOrder = await adminWo(workOrderId);
    refused('un Job que no está hecho no sirve', await safety.post(`/qc/${workOrderId}/return`, { notes: 'x', jobId: laneJob(workOrder, 'quality_check').id }), 400, 'QC_JOB_NOT_DONE');
    const reply = ok('devolver por Alignment', await safety.post(`/qc/${workOrderId}/return`, { notes: 'El volante quedó torcido.', jobId: laneJob(workOrder, 'alignment').id }));
    same('la nota empieza con el Job', inQueue(reply.returned, workOrderId)?.note, 'Alignment: El volante quedó torcido.');
    same('el Manager ve lo mismo', ((await adminWo(workOrderId)).reportedBlockers as Json[])[0]?.notes, 'Alignment: El volante quedó torcido.');
  });

  it('QC9 | Done: lo que aprobé y devolví, lo más nuevo primero; cada persona ve lo suyo (D-QC6)', async () => {
    const first = await readyForQc('905');
    const second = await readyForQc('922');
    ok('tomar el 905', await safety.post(`/qc/${first.workOrderId}/take`));
    ok('aprobarlo', await safety.post(`/qc/${first.workOrderId}/approve`));
    ok('tomar el 922', await safety.post(`/qc/${second.workOrderId}/take`));
    ok('devolverlo', await safety.post(`/qc/${second.workOrderId}/return`, { notes: 'Luz trasera fundida.' }));
    const history = ok('historial de Safety 1', await safety.get('/qc/history?days=7'));
    same('lo más nuevo primero', (history.items as Json[]).map((item) => [item.truck.truckNumber, item.outcome, item.note]), [['922', 'returned', 'Luz trasera fundida.'], ['905', 'approved', null]]);
    same('Safety 2 no tiene nada', (ok('historial de Safety 2', await safety2.get('/qc/history')).items as Json[]).length, 0);
    refused('un mecánico no ve el historial', await as(USERS.general).get('/qc/history'), 403);
  });

  it('QC12 | LTR-216: el Manager no completa con un toque el QC que Safety devolvió; solo con confirmación y motivo', async () => {
    const { workOrderId } = await readyForQc('905');
    ok('tomar', await safety.post(`/qc/${workOrderId}/take`));
    ok('devolver', await safety.post(`/qc/${workOrderId}/return`, { notes: 'Sigue jalando a la derecha en la prueba de manejo.' }));
    const qcJobId = laneJob(await adminWo(workOrderId), 'quality_check').id;

    refused('completar sin más: se rechaza y la devolución sigue', await manager.post(`/admin/jobs/${qcJobId}/complete`, { ...(await meta(workOrderId)) }), 409, 'QC_RETURNED_BY_SAFETY');
    same('el bloqueo de Safety sigue abierto', (await activeBlocker(workOrderId))?.blockerReason, 'quality_check_failed');
    refused('confirmar sin motivo no alcanza', await manager.post(`/admin/jobs/${qcJobId}/complete`, { ...(await meta(workOrderId)), overrideSafetyReturn: true, notes: '  ' }), 400, 'QC_OVERRIDE_NOTE_REQUIRED');

    ok('confirmar con motivo', await manager.post(`/admin/jobs/${qcJobId}/complete`, {
      ...(await meta(workOrderId)),
      overrideSafetyReturn: true,
      notes: 'Lo revisé en la prueba de manejo: va derecho.',
    }));
    const workOrder = await adminWo(workOrderId);
    same('QC completado', laneJob(workOrder, 'quality_check').status, 'completed');
    same('la devolución quedó resuelta', await activeBlocker(workOrderId), null);
    const resolved = await prisma.activityLog.findFirst({ where: { workOrderId, eventType: 'blocker_resolved' }, orderBy: { createdAt: 'desc' } });
    same('el historial dice que se completó sobre la devolución, con el motivo',
      (resolved?.newValue as Json | null)?.notes,
      'Quality Check completed by the Manager over the Safety return: Lo revisé en la prueba de manejo: va derecho.');
  });

  it('QC10 | Orden por urgencia: Critical y High antes que el que lleva más tiempo listo (D-QC5)', async () => {
    const older = await readyForQc('905');
    const urgent = await readyForQc('922');
    await prisma.workOrder.update({ where: { id: urgent.workOrderId }, data: { priority: 'critical' } });
    const list = await queue();
    same('el Critical primero aunque esté listo hace menos', (list.pending as Json[]).map((item) => item.workOrderId), [urgent.workOrderId, older.workOrderId]);
    same('la tarjeta trae la prioridad', inQueue(list.pending, urgent.workOrderId)?.priority, 'critical');
    same('y quién hizo cada Job', (inQueue(list.pending, older.workOrderId)?.doneBy as Json[]).map((item) => item.job).sort(), ['Alignment', 'Detailing', 'PM A Service']);
    same('sin Dispatch en este entorno, sin salida ni ubicación', [inQueue(list.pending, older.workOrderId)?.leavesOn, inQueue(list.pending, older.workOrderId)?.location], [null, null]);
  });
});

async function catalogRow(category: string, job: string) {
  const row = await prisma.catalogJob.findFirstOrThrow({ where: { displayName: job, status: 'active', category: { name: category, status: 'active' } } });
  return { catalogJobId: row.id, categoryId: row.categoryId, displayName: row.displayName };
}

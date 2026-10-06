import { beforeEach, describe, it } from 'vitest';
import {
  USERS, Json, activeBlocker, admin, adminCompleteJob, adminWo, as, closeWo, doLane, doPm, laneJob, manager, meta,
  namedJob, ok, plannedWo, prisma, refused, reportBlocker, resetDb, returnToService, same, sameNextStepEverywhere,
  start, completeJob, createWo, truthy, userId,
} from '../harness';

describe('Tablero, Yard, notas y tiempos', () => {
  beforeEach(resetDb);

  it('A19 | Siguiente paso: todas las pantallas dicen lo mismo en cada etapa de un WO', async () => {
    const { truck, workOrderId } = await createWo('905');
    const at = (step: string, expected: string) => sameNextStepEverywhere(step, workOrderId, truck.id, expected);
    await at('recién creado', 'inspect');
    ok('inspección', await manager.post(`/admin/trucks/${truck.id}/work-plan/inspection`, { outcome: 'no_issues_found', idempotencyKey: crypto.randomUUID() }));
    await at('inspeccionado', 'work');
    ok('Start', await start(USERS.alignment, workOrderId));
    const alignment = laneJob(await adminWo(workOrderId), 'alignment');
    ok('bloqueo', await reportBlocker(USERS.alignment, workOrderId, alignment.id));
    await at('bloqueado', 'resolve_blocker');
    ok('resolver', await manager.post(`/admin/work-orders/${workOrderId}/blockers/${(await activeBlocker(workOrderId))!.id}/resolve`));
    ok('pausa', await manager.post(`/admin/work-orders/${workOrderId}/pause`, { reason: 'waiting_for_bay' }));
    await at('pausado', 'resume');
    ok('resume', await manager.post(`/admin/work-orders/${workOrderId}/resume`));
    refused('tras un bloqueo hay que tocar Continue antes de completar', await completeJob(USERS.alignment, workOrderId, alignment.id), 400, 'START_REQUIRED');
    ok('Continue', await start(USERS.alignment, workOrderId));
    ok('completa Alignment', await completeJob(USERS.alignment, workOrderId, alignment.id));
    await doPm(workOrderId, truck.id);
    await doLane(USERS.detailing, workOrderId, 'detailing');
    await at('solo QC', 'qc');
    ok('QC', await adminCompleteJob(workOrderId, laneJob(await adminWo(workOrderId), 'quality_check').id));
    await at('todo hecho', 'close');
    ok('Close', await closeWo(workOrderId));
    ok('Return to Service', await returnToService(workOrderId));
    const trucks = ok('lista de Trucks', await manager.get('/admin/trucks'));
    same('Truck sin WO', (trucks.items as Json[]).find((item) => item.truck.id === truck.id)?.nextStep?.kind, 'create_work_order');
  });

  it('A19b | Siguiente paso de un Truck Ready to Go: igual en Truck, WO, listas y Yard', async () => {
    const { truck, workOrderId } = await plannedWo('905');
    await doPm(workOrderId, truck.id);
    await doLane(USERS.alignment, workOrderId, 'alignment');
    await doLane(USERS.detailing, workOrderId, 'detailing');
    ok('QC', await adminCompleteJob(workOrderId, laneJob(await adminWo(workOrderId), 'quality_check').id));
    ok('Close', await closeWo(workOrderId));
    await sameNextStepEverywhere('Ready to Go', workOrderId, truck.id, 'return_to_service');
  });

  it('A20 | Dashboard "Needs attention": bloqueo, pausa, sin dueño, +24 h', async () => {
    const blocked = await plannedWo('905', [{ category: 'Electrical & Starting', job: 'Battery', assignee: USERS.general }]);
    ok('Start', await start(USERS.general, blocked.workOrderId));
    ok('bloqueo', await reportBlocker(USERS.general, blocked.workOrderId, namedJob(await adminWo(blocked.workOrderId), 'Battery').id));

    const paused = await plannedWo('922');
    ok('Start', await start(USERS.alignment, paused.workOrderId));
    ok('pausa', await manager.post(`/admin/work-orders/${paused.workOrderId}/pause`, { reason: 'waiting_for_parts' }));

    const unassigned = await plannedWo('931', [{ category: 'Electrical & Starting', job: 'Lights' }]);

    const old = await plannedWo('944');
    await prisma.workOrder.update({ where: { id: old.workOrderId }, data: { createdAt: new Date(Date.now() - 25 * 3_600_000) } });

    const healthy = await plannedWo('957');

    const dashboard = ok('Dashboard', await manager.get('/admin/dashboard'));
    const reason = (workOrderId: string) => (dashboard.attention as Json[]).find((item) => item.id === workOrderId)?.attentionReason ?? null;
    same('abiertos', dashboard.counts.open, 5);
    same('pausados', dashboard.counts.waitingPaused, 1);
    same('abiertos hace más de 24 h', dashboard.counts.openOlderThan24h, 1);
    same('motivo del bloqueado', reason(blocked.workOrderId), 'blocker');
    same('motivo del pausado', reason(paused.workOrderId), 'paused');
    same('motivo del que tiene un Job sin dueño', reason(unassigned.workOrderId), 'unassigned');
    same('motivo del viejo', reason(old.workOrderId), 'open_over_24h');
    same('un WO sin problemas aparece al final, como "open"', reason(healthy.workOrderId), 'open');
    same('orden: pausado, bloqueado, sin dueño, +24 h, sano', (dashboard.attention as Json[]).map((item) => item.attentionReason), ['paused', 'blocker', 'unassigned', 'open_over_24h', 'open']);
    const first = (dashboard.attention as Json[])[0];
    truthy('cada aviso trae su siguiente paso', (dashboard.attention as Json[]).every((item) => item.nextStep?.kind), first);
  });

  it('A21 | Yard: tablero por fase y contadores (Movement sin integración)', async () => {
    const fresh = await createWo('905');
    const working = await plannedWo('922', [{ category: 'Electrical & Starting', job: 'Battery', assignee: USERS.general }]);
    const blocked = await plannedWo('931', [{ category: 'Electrical & Starting', job: 'Battery', assignee: USERS.general }]);
    ok('Start', await start(USERS.general, blocked.workOrderId));
    ok('bloqueo', await reportBlocker(USERS.general, blocked.workOrderId, namedJob(await adminWo(blocked.workOrderId), 'Battery').id));
    const ready = await plannedWo('944');
    await doPm(ready.workOrderId, ready.truck.id);
    await doLane(USERS.alignment, ready.workOrderId, 'alignment');
    await doLane(USERS.detailing, ready.workOrderId, 'detailing');
    ok('QC', await adminCompleteJob(ready.workOrderId, laneJob(await adminWo(ready.workOrderId), 'quality_check').id));
    ok('Close', await closeWo(ready.workOrderId));

    const yard = ok('Yard', await manager.get('/admin/yard-operations?limit=100'));
    const phase = (truckId: string) => (yard.items as Json[]).find((item) => item.truck.id === truckId)?.phase ?? null;
    same('solo los Trucks con trabajo están en el tablero', (yard.items as Json[]).length, 4);
    same('recién llegado', phase(fresh.truck.id), 'inspection');
    same('con hallazgos', phase(working.truck.id), 'shop_work');
    same('cerrado', phase(ready.truck.id), 'ready_to_go');
    const { presenceUnknown, matching, total, quick, byPhase, ...buckets } = yard.counts;
    same('Inspection + In the Shop + Ready to Go suman el tablero; Blocked es un subconjunto', buckets, { notStarted: 1, underReview: 2, readyToGo: 1, blocked: 1 });
    // Etapa 6 (D6): "Mostrando N de M" y los filtros rápidos con su conteo.
    same('sin filtro se muestran todos', [matching, total], [4, 4]);
    same('filtros rápidos', quick, { all: 4, blocked: 1, highPriority: 0, outOfShop: 0, leavingSoon: 0 });
    // Etapa 8: el número de cada carril cuenta todas las páginas.
    same('camiones por paso', byPhase, { shop_work: 2, inspection: 1, ready_to_go: 1 });
    // Etapa 8: "Leaving soon" con los números que la web toma de Dispatch (solo camiones con WO abierta).
    const soon = ok('Yard sale pronto', await manager.get(`/admin/yard-operations?limit=100&soonTrucks=922,944&soon=true`));
    same('sale pronto: solo el abierto (el Ready to Go no cuenta)', (soon.items as Json[]).map((item) => item.truck.id), [working.truck.id]);
    same('conteo de sale pronto', soon.counts.quick.leavingSoon, 1);
    const onlyBlocked = ok('Yard bloqueados', await manager.get('/admin/yard-operations?limit=100&blocked=true'));
    same('el filtro "Bloqueados" deja solo el camión bloqueado', (onlyBlocked.items as Json[]).map((item) => item.truck.id), [blocked.truck.id]);
    same('los contadores siguen el filtro: Mostrando 1 de 4', [onlyBlocked.counts.matching, onlyBlocked.counts.total, onlyBlocked.counts.blocked], [1, 4, 1]);
    same('Presencia siempre desconocida', (yard.items as Json[]).every((item) => item.presence?.state === 'unknown'), true);
    truthy('cuenta de presencia desconocida', presenceUnknown >= 4, presenceUnknown);
    same('Movement sin integración', [yard.incomingTrucks.status, yard.upcomingDepartures.status, yard.workLocation.status], ['unavailable', 'unavailable', 'unavailable']);
  });

  it('A22 | Notas y "Pedir trabajo" → Manager marca atendido; WO cerrado rechaza notas', async () => {
    const { truck, workOrderId } = await plannedWo('905');
    const mechanic = as(USERS.alignment);
    ok('nota', await mechanic.post(`/work-orders/${workOrderId}/notes`, { kind: 'note', body: 'Llantas delanteras gastadas.' }));
    ok('pedir trabajo', await mechanic.post(`/work-orders/${workOrderId}/notes`, { kind: 'work_request', body: 'Cambiar llantas delanteras.' }));
    refused('nota vacía', await mechanic.post(`/work-orders/${workOrderId}/notes`, { kind: 'note', body: '   ' }), 400);
    refused('quien no tiene Jobs ahí no escribe notas', await as(USERS.general).post(`/work-orders/${workOrderId}/notes`, { kind: 'note', body: 'Hola' }), 403);

    let workOrder = await adminWo(workOrderId);
    same('las dos entradas, con autor', (workOrder.noteEntries as Json[]).map((note) => note.kind).sort(), ['note', 'work_request']);
    const request = (workOrder.noteEntries as Json[]).find((note) => note.kind === 'work_request');
    let dashboard = ok('Dashboard', await manager.get('/admin/dashboard'));
    same('el pedido aparece en el Dashboard', (dashboard.openWorkRequests as Json[]).length, 1);

    refused('el mecánico no marca atendido', await mechanic.post(`/admin/work-orders/${workOrderId}/notes/${request.id}/handle`), 403);
    ok('marcar atendido', await manager.post(`/admin/work-orders/${workOrderId}/notes/${request.id}/handle`));
    workOrder = await adminWo(workOrderId);
    truthy('queda la fecha de atendido', (workOrder.noteEntries as Json[]).find((note) => note.id === request.id)?.handledAt);
    dashboard = ok('Dashboard', await manager.get('/admin/dashboard'));
    same('sale del Dashboard', (dashboard.openWorkRequests as Json[]).length, 0);
    ok('nota del Manager', await manager.post(`/admin/work-orders/${workOrderId}/notes`, { kind: 'note', body: 'Llantas pedidas.' }));

    await doPm(workOrderId, truck.id);
    await doLane(USERS.alignment, workOrderId, 'alignment');
    await doLane(USERS.detailing, workOrderId, 'detailing');
    ok('QC', await adminCompleteJob(workOrderId, laneJob(await adminWo(workOrderId), 'quality_check').id));
    ok('Close', await closeWo(workOrderId));
    refused('WO cerrado: el mecánico no agrega notas', await mechanic.post(`/work-orders/${workOrderId}/notes`, { kind: 'note', body: 'Tarde.' }), 400, 'WORK_ORDER_CLOSED');
    refused('WO cerrado: el Manager tampoco', await manager.post(`/admin/work-orders/${workOrderId}/notes`, { kind: 'note', body: 'Tarde.' }), 400, 'WORK_ORDER_CLOSED');
  });

  it('A23 | Corrección de tiempos (admin); cada sesión dice de qué mecánico es', async () => {
    const { workOrderId } = await plannedWo('905');
    await doLane(USERS.alignment, workOrderId, 'alignment');
    const session = await prisma.workSession.findFirstOrThrow({ where: { workOrderId } });
    same('la sesión dice de quién es (LTR-184)', ((await adminWo(workOrderId)).laborSessions as Json[])[0]?.mechanic?.id, await userId(USERS.alignment));
    const endedAt = new Date(session.startedAt.getTime() + 45 * 60_000).toISOString();
    const body = async () => ({
      ...(await meta(workOrderId)), workOrderId, targetType: 'work_session', targetId: session.id, endedAt, reason: 'Olvidó cerrar.',
    });
    refused('un mecánico no corrige tiempos', await as(USERS.alignment).post('/admin/time-corrections', await body()), 403);
    refused('la corrección exige motivo', await admin.post('/admin/time-corrections', { ...(await body()), reason: '' }), 400);
    ok('corregir', await admin.post('/admin/time-corrections', await body()));
    const workOrder = await adminWo(workOrderId);
    same('la sesión dura 45 min', (workOrder.laborSessions as Json[])[0].durationMs, 45 * 60_000);
    same('el total del WO se recalcula', workOrder.totalActiveLaborMs, 45 * 60_000);
    truthy('queda en el Activity Log', (workOrder.activityLog as Json[]).some((entry) => entry.eventType === 'manager_correction'), (workOrder.activityLog as Json[]).map((entry) => entry.eventType));

    ok('Start', await start(USERS.detailing, workOrderId));
    const open = await prisma.workSession.findFirstOrThrow({ where: { workOrderId, endedAt: null } });
    refused('no se corrige una sesión abierta', await admin.post('/admin/time-corrections', { ...(await body()), targetId: open.id }), 400);
  });
});

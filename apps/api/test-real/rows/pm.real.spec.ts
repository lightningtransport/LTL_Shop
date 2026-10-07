import { beforeEach, describe, it } from 'vitest';
import {
  USERS, Json, activeBlocker, adminWo, as, completeJob, createPmService, laneJob, laneOf, manager,
  ok, openSessionUsers, plannedWo, prisma, refused, reportBlocker, resetDb, same, sameNextStepEverywhere, savePm, truck,
  truthy, userId,
} from '../harness';

const pm = as(USERS.pm);
describe('Mecánico PM', () => {
  beforeEach(resetDb);

  it('A9 | PM: Create PM service se une al WO abierto; millaje; partes; Finish actualiza millaje', async () => {
    const { truck: row, workOrderId } = await plannedWo('905');
    const joined = ok('Create PM service', await createPmService(row.id));
    same('se une al WO abierto del Truck', joined.id, workOrderId);

    let workOrder = await adminWo(workOrderId);
    const pmJob = laneJob(workOrder, 'pm');
    truthy('el PM quedó empezado', pmJob.startedAt, pmJob);
    same('el PM es de quien lo arrancó', pmJob.assignedMechanic?.id, await userId(USERS.pm));

    const mileage = (row.mileage ?? 0) + 500;
    ok('guardar millaje y parte', await savePm(workOrderId, mileage));
    ok('Finish', await completeJob(USERS.pm, workOrderId, pmJob.id));
    workOrder = await adminWo(workOrderId);
    same('PM completado', laneJob(workOrder, 'pm').status, 'completed');
    same('el millaje del Truck se actualiza', (await truck('905')).mileage, mileage);
    same('queda la auditoría de millaje', await prisma.truckMileageAdjustment.count({ where: { truckId: row.id } }), 1);
    truthy('terminar el PM no completa el WO', ['created', 'in_progress'].includes(workOrder.status), workOrder.status);
  });

  it('A9c | Pantalla nueva del PM: pieza más usada del modelo, millaje y piezas en la lista, último PM (D-PM1)', async () => {
    const first = await plannedWo('905');
    const firstJoin = ok('Create PM service en el 905', await createPmService(first.truck.id));
    const firstMileage = (first.truck.mileage ?? 0) + 500;
    ok('guardar millaje y parte', await savePm(firstJoin.id, firstMileage));
    const saved = ok('leer el PM del 905', await pm.get(`/work-orders/${firstJoin.id}/pm`));
    const usedCategory = (saved.selections as Json[])[0];
    ok('Finish', await completeJob(USERS.pm, firstJoin.id, laneJob(await adminWo(firstJoin.id), 'pm').id));

    // Otro camión de la misma marca y modelo: la pieza que usó el 905 queda como la más usada.
    const row905 = await truck('905');
    await prisma.truck.update({ where: { truckNumber: '922' }, data: { make: row905.make, model: row905.model } });
    const second = await plannedWo('922');
    ok('Create PM service en el 922', await createPmService(second.truck.id));
    const service = ok('leer el PM del 922', await pm.get(`/work-orders/${second.workOrderId}/pm`));
    const category = (service.categories as Json[]).find((item) => item.id === usedCategory.partCategoryId);
    same('la pieza más usada del modelo, en 1 de 1 PM', [category?.mostUsedPartId, category?.mostUsedCount, category?.pmCountForModel], [usedCategory.partId, 1, 1]);

    const list = ok('lista del PM', await pm.get('/work-orders?mode=pm'));
    const running = (list.active as Json[]).find((item) => item.id === second.workOrderId);
    same('el PM en curso trae su millaje y sus piezas', [running?.pmJob?.observedMileage, running?.pmJob?.partsCount], [null, 0]);
    same('el 922 no tiene PM anterior', running?.lastPm, null);
    const done = (list.completed as Json[]).find((item) => item.id === firstJoin.id);
    same('el PM terminado dice millaje y piezas', [done?.pmJob?.observedMileage, done?.pmJob?.partsCount], [firstMileage, 1]);
  });

  it('A9b | Arrancar el PM pone el WO en curso y registra el tiempo del mecánico PM [defecto #1]', async () => {
    const { truck: row, workOrderId } = await plannedWo('973');
    ok('Create PM service', await createPmService(row.id));
    const started = await adminWo(workOrderId);
    same('estado del WO al arrancar el PM', started.status, 'in_progress');
    same('el reloj del mecánico PM corre', await openSessionUsers(workOrderId), [await userId(USERS.pm)]);
    ok('guardar millaje y parte', await savePm(workOrderId, row.mileage ?? 0));
    ok('Finish', await completeJob(USERS.pm, workOrderId, laneJob(started, 'pm').id));
    const finished = await adminWo(workOrderId);
    same('al terminar se detiene su reloj', await openSessionUsers(workOrderId), []);
    same('queda una sesión de trabajo registrada', (finished.laborSessions as Json[]).length, 1);
  });

  it('A10 | PM: Create PM service en Truck sin WO → WO completo con los 4 pasos', async () => {
    const row = await truck('922');
    const created = ok('Create PM service', await createPmService(row.id));
    const workOrder = await adminWo(created.id);
    same('los cuatro pasos', (workOrder.jobs as Json[]).map(laneOf).sort(), ['alignment', 'detailing', 'pm', 'quality_check']);
    truthy('el PM quedó empezado y suyo', laneJob(workOrder, 'pm').startedAt && laneJob(workOrder, 'pm').assignedMechanic?.id === (await userId(USERS.pm)));
    same('Alignment con su dueño por defecto', laneJob(workOrder, 'alignment').assignedMechanic?.id, await userId(USERS.alignment));
    const stored = await prisma.workOrder.findUniqueOrThrow({ where: { id: created.id }, include: { primaryCategory: true } });
    truthy('no crea un WO de PM legacy', stored.primaryCategory.name !== 'PM', stored.primaryCategory.name);
    await sameNextStepEverywhere('WO creado por el PM', created.id, row.id, 'inspect');

    ok('guardar millaje y parte', await savePm(created.id, row.mileage ?? 0));
    ok('Finish', await completeJob(USERS.pm, created.id, laneJob(workOrder, 'pm').id));
    same('PM completado', laneJob(await adminWo(created.id), 'pm').status, 'completed');
  });

  it('A11 | PM: bloquear el PM; D2 un PM en curso por mecánico; cambio PM A ↔ PM B', async () => {
    const first = await plannedWo('931');
    const second = await plannedWo('944');
    ok('Create PM service (Truck 931)', await createPmService(first.truck.id));
    refused('D2: no arranca otro PM con uno en curso', await createPmService(second.truck.id), 409);
    const secondPm = laneJob(await adminWo(second.workOrderId), 'pm');
    refused('D2 también por pm/start', await pm.post(`/work-orders/${second.workOrderId}/jobs/${secondPm.id}/pm/start`), 409);

    const pmJob = laneJob(await adminWo(first.workOrderId), 'pm');
    const pmB = await prisma.catalogJob.findFirstOrThrow({ where: { displayName: 'PM B Service', status: 'active' } });
    ok('cambiar a PM B', await pm.post(`/work-orders/${first.workOrderId}/jobs/${pmJob.id}/pm-service`, { catalogJobId: pmB.id }));
    same('el Job ahora es PM B', laneJob(await adminWo(first.workOrderId), 'pm').displayName, 'PM B Service');
    same('sigue siendo un solo PM', ((await adminWo(first.workOrderId)).jobs as Json[]).filter((job) => laneOf(job) === 'pm').length, 1);

    ok('bloquear el PM', await reportBlocker(USERS.pm, first.workOrderId, pmJob.id));
    await sameNextStepEverywhere('PM bloqueado', first.workOrderId, first.truck.id, 'resolve_blocker');
    ok('guardar millaje y parte', await savePm(first.workOrderId, first.truck.mileage ?? 0));
    refused('un PM bloqueado no se puede terminar', await completeJob(USERS.pm, first.workOrderId, pmJob.id), 400, 'JOB_BLOCKED');
    const blocker = await activeBlocker(first.workOrderId);
    ok('el Manager resuelve', await manager.post(`/admin/work-orders/${first.workOrderId}/blockers/${blocker!.id}/resolve`));
    ok('Finish', await completeJob(USERS.pm, first.workOrderId, pmJob.id));
    ok('terminado el primero, puede arrancar otro', await createPmService(second.truck.id));
    ok('guardar millaje y parte', await savePm(second.workOrderId, second.truck.mileage ?? 0));
    ok('Finish', await completeJob(USERS.pm, second.workOrderId, secondPm.id));
  });

  it.skip('A28 | NO APLICA: WO de PM legacy (pausa, reanudar, terminar): ya no se pueden crear y no queda ninguno abierto', () => {});
});

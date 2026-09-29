import { beforeEach, describe, it } from 'vitest';
import {
  USERS, Json, addShopJobs, adminWo, assign, createWo, inspect, laneJob, laneOf, manager, meta, namedJob, ok,
  plannedWo, prisma, refused, resetDb, same, sameNextStepEverywhere, truckDetail, truthy, unassign, userId,
} from '../harness';

describe('Manager: llega un camión, planear y asignar', () => {
  beforeEach(resetDb);

  it('A1 | M01: crear WO solo con Truck → nace con PM, Alignment, Detailing, QC y dueños por defecto', async () => {
    const { truck, created } = await createWo('905', { priority: 'high', notes: 'Vibra al frenar.' });
    same('estado al nacer', created.status, 'created');

    const detail = await truckDetail(truck.id);
    const jobs = detail.workPlan.jobs as Json[];
    same('pasos obligatorios', jobs.map(laneOf).sort(), ['alignment', 'detailing', 'pm', 'quality_check']);
    const owner = (lane: string) => jobs.find((job) => laneOf(job) === lane)?.assignedMechanic?.id ?? null;
    same('dueño de PM', owner('pm'), await userId(USERS.pm));
    same('dueño de Alignment', owner('alignment'), await userId(USERS.alignment));
    same('dueño de Detailing', owner('detailing'), await userId(USERS.detailing));
    same('Quality Check sin dueño (D15)', owner('quality_check'), null);
    await sameNextStepEverywhere('recién creado', created.id, truck.id, 'inspect');
  });

  it('A2 | M01: inspección "No issues found"', async () => {
    const { truck, workOrderId } = await createWo('922');
    await inspect(truck.id, 'no_issues_found');
    const detail = await truckDetail(truck.id);
    same('resultado de la inspección', detail.workPlan.inspection.outcome, 'no_issues_found');
    await sameNextStepEverywhere('inspección sin hallazgos', workOrderId, truck.id, 'work');
  });

  it('A3 | M01: inspección "Issues found" → agregar Jobs con dueño (D14)', async () => {
    const { truck, workOrderId } = await createWo('931');
    await inspect(truck.id, 'issues_found');
    ok('agregar Jobs con y sin dueño', await addShopJobs(truck.id, workOrderId, [
      { category: 'Air & Brake System', job: 'Brake Inspection', assignee: USERS.general },
      { category: 'Electrical & Starting', job: 'Lights' },
    ]));
    const detail = await truckDetail(truck.id);
    const brake = namedJob(detail.workPlan, 'Brake Inspection');
    same('Brake Inspection es Shop Work', laneOf(brake), 'shop_work');
    same('dueño elegido al agregar', brake.assignedMechanic?.id, await userId(USERS.general));
    same('Lights queda sin dueño', namedJob(detail.workPlan, 'Lights').assignedMechanic, null);
    same('el siguiente paso pide asignar Lights', detail.nextStep, {
      kind: 'assign', workOrderId, jobId: namedJob(detail.workPlan, 'Lights').id, jobName: 'Lights',
    });
    await sameNextStepEverywhere('hallazgos sin asignar', workOrderId, truck.id, 'assign');
  });

  it('A4 | M02: asignar / reasignar / quitar dueño; equipo derivado', async () => {
    const { truck, workOrderId } = await plannedWo('944', [{ category: 'Electrical & Starting', job: 'Lights' }]);
    const lights = namedJob(await adminWo(workOrderId), 'Lights');
    const team = async () => ((await adminWo(workOrderId)).mechanics as Json[])
      .filter((item) => !item.removedAt).map((item) => item.mechanicId);

    ok('asignar', await assign(workOrderId, lights.id, USERS.spare));
    truthy('el dueño entra al equipo', (await team()).includes(await userId(USERS.spare)));
    await sameNextStepEverywhere('todo asignado', workOrderId, truck.id, 'work');

    ok('reasignar', await assign(workOrderId, lights.id, USERS.general));
    const afterReassign = await team();
    truthy('el nuevo dueño entra al equipo', afterReassign.includes(await userId(USERS.general)));
    truthy('el dueño anterior sale del equipo', !afterReassign.includes(await userId(USERS.spare)), afterReassign);

    ok('quitar dueño', await unassign(workOrderId, lights.id));
    same('Job sin dueño', namedJob(await adminWo(workOrderId), 'Lights').assignedMechanic, null);
    truthy('quien ya no tiene Jobs sale del equipo', !(await team()).includes(await userId(USERS.general)));
    await sameNextStepEverywhere('sin dueño otra vez', workOrderId, truck.id, 'assign');
  });

  it('A18 | "Agregar pasos que faltan" en WO viejo', async () => {
    const { truck, workOrderId } = await plannedWo('957');
    const before = await adminWo(workOrderId);
    await prisma.workOrderJob.deleteMany({
      where: { id: { in: [laneJob(before, 'detailing').id, laneJob(before, 'quality_check').id] } },
    });
    const detail = await truckDetail(truck.id);
    same('siguiente paso', detail.nextStep.kind, 'add_missing_steps');
    same('pasos que faltan', [...detail.nextStep.missingLanes].sort(), ['detailing', 'quality_check']);

    ok('agregar pasos que faltan', await manager.post(`/admin/trucks/${truck.id}/work-plan/backfill-mandatory`, {
      expectedVersion: (await meta(workOrderId)).expectedVersion,
    }));
    const after = await truckDetail(truck.id);
    same('los cuatro pasos', (after.workPlan.jobs as Json[]).map(laneOf).sort(), ['alignment', 'detailing', 'pm', 'quality_check']);
    same('Detailing vuelve con su dueño por defecto', laneJob(after.workPlan, 'detailing').assignedMechanic?.id, await userId(USERS.detailing));
  });

  it('A25 | Setup → Shop workflow: cambiar dueño por defecto; dueño inactivo → Unassigned', async () => {
    const spare = await userId(USERS.spare);
    ok('cambiar dueño de Alignment', await manager.put('/admin/setup/workflow-steps', {
      steps: [{ stepKey: 'alignment', defaultMechanicId: spare }],
    }));
    const steps = ok('leer Shop workflow', await manager.get('/admin/setup/workflow-steps')) as Json[];
    same('dueño guardado', steps.find((step) => step.stepKey === 'alignment')?.defaultMechanic?.id, spare);

    refused('Quality Check no acepta dueño', await manager.put('/admin/setup/workflow-steps', {
      steps: [{ stepKey: 'quality_check', defaultMechanicId: spare }],
    }), 400, 'STEP_HAS_NO_OWNER');
    refused('un mecánico Standard no puede ser dueño de PM', await manager.put('/admin/setup/workflow-steps', {
      steps: [{ stepKey: 'pm', defaultMechanicId: spare }],
    }), 400);

    const first = await createWo('968');
    same('WO nuevo usa el dueño nuevo', laneJob(await adminWo(first.workOrderId), 'alignment').assignedMechanic?.id, spare);

    await prisma.user.update({ where: { id: spare }, data: { active: false } });
    const second = await createWo('973');
    same('dueño inactivo → Unassigned', laneJob(await adminWo(second.workOrderId), 'alignment').assignedMechanic, null);
    await sameNextStepEverywhere('WO con paso sin dueño', second.workOrderId, second.truck.id, 'inspect');
    refused('no se puede elegir un dueño inactivo', await manager.put('/admin/setup/workflow-steps', {
      steps: [{ stepKey: 'detailing', defaultMechanicId: spare }],
    }), 400);
  });
});

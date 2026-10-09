import { beforeEach, describe, it } from 'vitest';
import { USERS, Json, createWo, laneJob, adminWo, manager, ok, prisma, refused, resetDb, same, truthy, userId } from '../harness';

/** OPEN_ISSUES §1m: Setup fixes before the redesign (SW1–SW4, JC3, ME1, ME2, ME4). */
describe('Manager: Setup (Shop workflow, catálogo, personas)', () => {
  beforeEach(resetDb);

  it('A37 | SW1: el dueño de un paso deja de poder hacerlo (desactivado) → se ve marcado y no impide guardar los otros pasos', async () => {
    const alignmentOwner = await userId(USERS.alignment);
    const spare = await userId(USERS.spare);
    // LTR-197 / D-SET2: deactivating keeps the person on the team, marked (changing type would take them off).
    ok('el dueño de Alignment se desactiva', await manager.patch(`/admin/mechanics/${alignmentOwner}`, { active: false }));

    const steps = ok('leer Shop workflow', await manager.get('/admin/setup/workflow-steps')) as Json[];
    const alignment = steps.find((step) => step.stepKey === 'alignment');
    same('sigue en el equipo, marcado como no elegible', [alignment?.members[0]?.id, alignment?.members[0]?.eligible], [alignmentOwner, false]);

    ok('cambiar Detailing guarda aunque Alignment tenga a alguien no elegible', await manager.put('/admin/setup/workflow-steps', {
      steps: [{ stepKey: 'detailing', memberIds: [spare] }],
    }));
    ok('reenviar el equipo que no cambió tampoco falla', await manager.put('/admin/setup/workflow-steps', {
      steps: [{ stepKey: 'alignment', memberIds: [alignmentOwner] }, { stepKey: 'detailing', memberIds: [spare] }],
    }));
    refused('agregarlo a otro paso sí se rechaza', await manager.put('/admin/setup/workflow-steps', {
      steps: [{ stepKey: 'detailing', memberIds: [spare, alignmentOwner] }],
    }), 400, 'OWNER_NOT_ELIGIBLE');

    const created = await createWo('968');
    same('WO nuevo: Alignment sin dueño', laneJob(await adminWo(created.workOrderId), 'alignment').assignedMechanic, null);
    same('WO nuevo: Detailing con el dueño nuevo', laneJob(await adminWo(created.workOrderId), 'detailing').assignedMechanic?.id, spare);
  });

  it('A38 | SW2 + JC3: el Job de un paso no se puede desactivar; un Job de una categoría inactiva no se puede activar', async () => {
    const steps = ok('leer Shop workflow', await manager.get('/admin/setup/workflow-steps')) as Json[];
    const detailing = steps.find((step) => step.stepKey === 'detailing');
    same('el paso está activo', detailing?.catalogJob.active, true);
    // LTR-198 / D30: the step's Job is a System Job, so the lock answers first.
    refused('desactivar el Job de un paso', await manager.patch(`/admin/catalog/jobs/${detailing?.catalogJob.id}`, { status: 'inactive' }), 409, 'SYSTEM_JOB_LOCKED');

    // A step whose Job went inactive anyway (data from before this rule) is marked on the screen.
    // `resetDb` keeps the catalog, so everything this row changes there is put back.
    const category = await prisma.jobCategory.create({ data: { name: `Setup test inactive ${Date.now()}`, status: 'inactive', sortOrder: 999 } });
    try {
      await prisma.catalogJob.update({ where: { id: detailing?.catalogJob.id }, data: { status: 'inactive' } });
      const after = ok('leer Shop workflow', await manager.get('/admin/setup/workflow-steps')) as Json[];
      same('el paso se marca como no aplicado', after.find((step) => step.stepKey === 'detailing')?.catalogJob.active, false);

      const job = await prisma.catalogJob.create({ data: { categoryId: category.id, displayName: 'Setup test job', status: 'inactive' } });
      refused('activar un Job de una categoría inactiva', await manager.patch(`/admin/catalog/jobs/${job.id}`, { status: 'active' }), 400, 'CATALOG_CATEGORY_INACTIVE');
    } finally {
      await prisma.catalogJob.update({ where: { id: detailing?.catalogJob.id }, data: { status: 'active' } });
      await prisma.catalogJob.deleteMany({ where: { categoryId: category.id } });
      await prisma.jobCategory.delete({ where: { id: category.id } });
    }
  });

  it('A39 | ME1 + ME4: el trabajo abierto de una persona son sus Jobs por hacer (también para PM); los cerrados coinciden con sus Jobs completados', async () => {
    const pm = await userId(USERS.pm);
    const first = await createWo('905');
    await createWo('922');
    const people = ok('lista de personas', await manager.get('/admin/mechanics?limit=50')) as Json;
    const daniel = (people.items as Json[]).find((item) => item.id === pm);
    same('Daniel (PM) cuenta los WOs con su PM por hacer', daniel?.openWorkOrderCount, 2);

    const detail = ok('detalle de Daniel', await manager.get(`/admin/mechanics/${pm}`));
    same('sus Jobs por hacer', (detail.pendingJobs as Json[]).length, 2);
    same('es dueño por defecto del paso PM', (detail.defaultOwnerOfSteps as Json[]).map((step) => step.stepKey), ['pm']);
    same('sin tiempo corriendo', detail.runningSession, false);

    const pmJob = laneJob(await adminWo(first.workOrderId), 'pm');
    await prisma.workOrderJob.update({ where: { id: pmJob.id }, data: { status: 'completed', completedById: pm, completedAt: new Date() } });
    await prisma.workOrder.update({ where: { id: first.workOrderId }, data: { status: 'cancelled', completedAt: new Date() } });
    const later = ok('detalle de Daniel', await manager.get(`/admin/mechanics/${pm}`));
    same('Jobs completados', later.completedJobCount, 1);
    same('el WO cerrado donde completó un Job aparece', (later.recentClosedWorkOrders as Json[]).map((item) => item.workOrderId), [first.workOrderId]);
    same('ya no cuenta como abierto', later.openWorkOrderCount, 1);
  });

  it('A40 | ME2 + SW3: el detalle de una persona dice antes de confirmar qué bloquea desactivarla y de qué pasos es dueña', async () => {
    const detailingOwner = await userId(USERS.detailing);
    await createWo('931');
    const detail = ok('detalle', await manager.get(`/admin/mechanics/${detailingOwner}`));
    truthy('trae sus Jobs por hacer antes de desactivar', (detail.pendingJobs as Json[]).some((job) => job.truckNumber === '931'));
    same('dueño por defecto de Detailing', (detail.defaultOwnerOfSteps as Json[]).map((step) => step.stepKey), ['detailing']);
    refused('desactivar sigue bloqueado con trabajo abierto', await manager.patch(`/admin/mechanics/${detailingOwner}`, { active: false }), 409, 'MECHANIC_HAS_OPEN_WORK');
  });
});

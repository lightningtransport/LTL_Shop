import { afterEach, beforeEach, describe, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  USERS, Json, adminWo, as, createWo, manager, ok, prisma, refused, resetDb, same, truckDetail, truthy, userId,
} from '../harness';

/**
 * D41: the inspection sheet (HU-M16 Manager, HU-ME7 mechanic with "Can inspect trucks", HU-M17 Setup and People).
 * Every check is answered and the 10 tires read; each defect becomes a Job (merged per catalog Job), cleaning
 * goes to the Detailing step, a tire in "fix" creates Flat Repair or Tires, and afterwards defects are only added.
 */

const POSITIONS = ['LF', 'RF', 'LFO', 'LFI', 'RFI', 'RFO', 'LRO', 'LRI', 'RRI', 'RRO'];
type Defects = Record<string, string>;

async function state(truckId: string, actor = manager): Promise<Json> {
  return ok('leer la inspección', await actor.get(actor === manager ? `/admin/trucks/${truckId}/inspection` : `/inspections/trucks/${truckId}`));
}

/** Every check OK except `defects` (label → note); every tire in range except `tires`. */
function sheet(current: Json, defects: Defects = {}, tires: Record<string, [number, number]> = {}, extra: Record<string, unknown> = {}) {
  return {
    idempotencyKey: randomUUID(),
    items: current.checklist.map((item: Json) => defects[item.label]
      ? { checklistItemId: item.id, result: 'defect', note: defects[item.label] }
      : { checklistItemId: item.id, result: 'ok' }),
    tires: POSITIONS.map((position) => {
      const [psi, tread] = tires[position] ?? [position === 'LF' || position === 'RF' ? 110 : 95, 9];
      return { position, psi, tread };
    }),
    ...extra,
  };
}

function jobsNamed(workOrder: Json, name: string) {
  return workOrder.jobs.filter((job: Json) => job.displayName === name && job.status !== 'cancelled');
}

describe('Inspección con la hoja y las llantas (D41)', () => {
  beforeEach(resetDb);

  it('A82 | La hoja crea un Job por Job del catálogo: dos luces → un Lights, la limpieza va a Detailing y una llanta baja crea Flat Repair; queda Issues found', async () => {
    const { truck: row, workOrderId } = await createWo('905');
    const before = await state(row.id);
    same('53 puntos activos', before.checklist.length, 53);
    same('umbrales del taller', [before.limits.steerTargetPsi, before.limits.driveTargetPsi], [110, 95]);
    truthy('el Manager puede asignar', before.canAssign);

    const general = await userId(USERS.general);
    const brakes = before.checklist.find((item: Json) => item.label === 'Brakes').catalogJob;
    const saved = ok('guardar la hoja', await manager.post(`/admin/trucks/${row.id}/inspection`, sheet(before, {
      'Fog / hazard lamps': 'Lente del hazard izquierdo roto.',
      'Brake lights': 'Luz de freno derecha apagada.',
      Brakes: 'Pastillas bajo 1/4" en el eje trasero.',
      'Interior clean': 'Barro en el piso de la cabina.',
    }, { LFO: [72, 8], LRO: [92, 3] }, { assignments: [{ catalogJobId: brakes.id, assignedMechanicId: general }], notes: 'El chofer dice que jala a la derecha.' })));

    const wo = await adminWo(workOrderId);
    same('un solo Lights con las dos luces', jobsNamed(wo, 'Lights').length, 1);
    same('Brake Inspection con su dueño', jobsNamed(wo, 'Brake Inspection')[0]?.assignedMechanic?.id ?? jobsNamed(wo, 'Brake Inspection')[0]?.assignedMechanicId, general);
    same('Flat Repair por la llanta a 72 PSI', jobsNamed(wo, 'Flat Repair').length, 1);
    same('la llanta en "watch" no crea Job', jobsNamed(wo, 'Tires').length, 0);
    same('Detailing no se repite', jobsNamed(wo, 'Detailing').length, 1);

    const report = saved.inspection;
    truthy('Issues found', report.issuesFound);
    const lights = report.jobs.find((job: Json) => job.displayName === 'Lights');
    same('Lights tiene las dos fuentes', lights.sources.map((source: Json) => source.label).sort(), ['Brake lights', 'Fog / hazard lamps']);
    const detailing = report.jobs.find((job: Json) => job.displayName === 'Detailing');
    same('la limpieza queda en Detailing', detailing.sources.map((source: Json) => source.label), ['Interior clean']);
    same('LFO en fix, LRO en watch', report.tires.filter((tire: Json) => tire.status !== 'ok').map((tire: Json) => `${tire.position}:${tire.status}`), ['LFO:fix', 'LRO:watch']);
    same('la nota queda en el reporte', report.notes, 'El chofer dice que jala a la derecha.');

    const plan = await truckDetail(row.id);
    same('el paso Inspection dice Issues found', plan.workPlan?.inspection?.outcome ?? plan.inspection?.outcome, 'issues_found');
  });

  it('A83 | Sin defectos ni llantas fuera de rango queda No issues found; la segunda vez dice quién ya inspeccionó', async () => {
    const { truck: row } = await createWo('968');
    const before = await state(row.id);
    const saved = ok('guardar sin defectos', await manager.post(`/admin/trucks/${row.id}/inspection`, sheet(before)));
    same('No issues found', saved.inspection.issuesFound, false);
    same('sin Jobs', saved.inspection.jobs.length, 0);
    refused('no se guarda dos veces', await manager.post(`/admin/trucks/${row.id}/inspection`, sheet(before)), 409, 'INSPECTION_ALREADY_SAVED');
  });

  it('A84 | No se guarda incompleta: faltan puntos, faltan llantas o un defecto sin nota', async () => {
    const { truck: row } = await createWo('922');
    const before = await state(row.id);
    const full = sheet(before);
    refused('falta un punto', await manager.post(`/admin/trucks/${row.id}/inspection`, { ...full, items: full.items.slice(1) }), 400, 'INSPECTION_INCOMPLETE');
    refused('faltan llantas', await manager.post(`/admin/trucks/${row.id}/inspection`, { ...full, tires: full.tires.slice(1) }), 400);
    const noNote = sheet(before);
    noNote.items[0] = { checklistItemId: noNote.items[0].checklistItemId, result: 'defect' };
    refused('defecto sin nota', await manager.post(`/admin/trucks/${row.id}/inspection`, noNote), 400, 'INSPECTION_DEFECT_NOTE_REQUIRED');
    const retry = sheet(before);
    ok('guardar', await manager.post(`/admin/trucks/${row.id}/inspection`, retry));
    ok('el mismo pedido otra vez no duplica', await manager.post(`/admin/trucks/${row.id}/inspection`, retry));
    same('una sola inspección', await prisma.truckInspection.count({ where: { truckId: row.id } }), 1);
  });

  it('A85 | Add defects solo agrega: un OK pasa a defecto y crea su Job o suma su nota; un defecto guardado no cambia', async () => {
    const { truck: row, workOrderId } = await createWo('931');
    const before = await state(row.id);
    const saved = ok('guardar', await manager.post(`/admin/trucks/${row.id}/inspection`, sheet(before, { 'Brake lights': 'Luz de freno apagada.' })));
    const itemId = (label: string) => saved.inspection.items.find((item: Json) => item.label === label).id;

    const later = ok('agregar defectos', await manager.post(`/admin/trucks/${row.id}/inspection/defects`, {
      idempotencyKey: randomUUID(),
      defects: [
        { inspectionItemId: itemId('Interior lights'), note: 'Luz de cabina apagada.' },
        { inspectionItemId: itemId('Mirrors'), note: 'Espejo derecho flojo.' },
      ],
    }));
    const wo = await adminWo(workOrderId);
    same('sigue un solo Lights', jobsNamed(wo, 'Lights').length, 1);
    same('Mirrors es nuevo', jobsNamed(wo, 'Mirrors').length, 1);
    const lights = later.inspection.jobs.find((job: Json) => job.displayName === 'Lights');
    same('Lights suma la nota agregada', lights.sources.map((source: Json) => `${source.label}:${source.addedLater}`).sort(), ['Brake lights:false', 'Interior lights:true']);
    truthy('el punto dice quién lo agregó', later.inspection.items.find((item: Json) => item.label === 'Mirrors').addedLater);
    refused('un defecto guardado no se vuelve a marcar', await manager.post(`/admin/trucks/${row.id}/inspection/defects`, {
      idempotencyKey: randomUUID(),
      defects: [{ inspectionItemId: itemId('Brake lights'), note: 'otra vez' }],
    }), 409, 'INSPECTION_ITEM_ALREADY_DEFECT');
  });
});

describe('El mecánico con "Can inspect trucks" (D41, HU-ME7)', () => {
  const general = as(USERS.general);
  const dropPermission = () => prisma.userCapability.deleteMany({ where: { user: { email: USERS.general }, capability: 'INSPECTION_PERFORM' } });
  // resetDb does not reset capabilities: start and end without the permission, whatever the database had.
  beforeEach(async () => { await resetDb(); await dropPermission(); });
  afterEach(dropPermission);

  it('A86 | Sin el permiso no ve "To inspect" ni guarda; con el permiso inspecciona y sus Jobs nacen sin dueño', async () => {
    const { truck: row, workOrderId } = await createWo('944');
    refused('sin permiso no hay cola', await general.get('/inspections/queue'), 403, 'INSPECTION_NOT_ALLOWED');

    const id = await userId(USERS.general);
    ok('el Manager enciende el permiso en People', await manager.patch(`/admin/mechanics/${id}`, { canInspect: true }));
    const queue = ok('cola To inspect', await general.get('/inspections/queue'));
    truthy('el 944 espera inspección', queue.some((item: Json) => item.truckNumber === '944'));

    const before = await state(row.id, general);
    same('el mecánico no asigna', before.canAssign, false);
    refused('no puede elegir dueño', await general.post(`/inspections/trucks/${row.id}`, sheet(before, { Brakes: 'Pastillas gastadas.' }, {}, {
      assignments: [{ catalogJobId: before.checklist.find((item: Json) => item.label === 'Brakes').catalogJob.id, assignedMechanicId: id }],
    })), 403, 'INSPECTION_ASSIGN_MANAGER_ONLY');
    const saved = ok('guarda la hoja', await general.post(`/inspections/trucks/${row.id}`, sheet(before, { Brakes: 'Pastillas gastadas.' })));
    same('dice quién inspeccionó', saved.inspection.inspectedBy.isMechanic, true);
    const brake = jobsNamed(await adminWo(workOrderId), 'Brake Inspection')[0];
    same('el Job nace sin dueño', brake?.assignedMechanic ?? null, null);
    const after = ok('cola después', await general.get('/inspections/queue'));
    same('el 944 sale de la cola', after.some((item: Json) => item.truckNumber === '944'), false);
    refused('fuera de la hoja sigue sin agregar Jobs (A26)', await general.post(`/admin/trucks/${row.id}/work-plan/jobs`, {}), 403);
  });

  it('A87 | Safety no recibe el permiso, y cambiar a Safety lo quita', async () => {
    const safety = await userId(USERS.safety);
    refused('Safety no inspecciona', await manager.patch(`/admin/mechanics/${safety}`, { canInspect: true }), 400, 'INSPECT_NOT_FOR_SAFETY');
    const id = await userId(USERS.general);
    ok('encender', await manager.patch(`/admin/mechanics/${id}`, { canInspect: true }));
    truthy('tiene el permiso', await prisma.userCapability.findFirst({ where: { userId: id, capability: 'INSPECTION_PERFORM' } }));
    ok('apagar', await manager.patch(`/admin/mechanics/${id}`, { canInspect: false }));
    same('ya no lo tiene', await prisma.userCapability.count({ where: { userId: id, capability: 'INSPECTION_PERFORM' } }), 0);
  });
});

describe('Setup → Inspection checklist (D41, HU-M17)', () => {
  beforeEach(resetDb);
  let snapshot: Json[] = [];
  beforeEach(async () => {
    snapshot = await prisma.inspectionChecklistItem.findMany();
  });
  afterEach(async () => {
    for (const row of snapshot) {
      await prisma.inspectionChecklistItem.update({ where: { id: row.id }, data: { label: row.label, active: row.active, sortOrder: row.sortOrder, catalogJobId: row.catalogJobId, workflowStepKey: row.workflowStepKey } });
    }
    await prisma.inspectionChecklistItem.deleteMany({ where: { id: { notIn: snapshot.map((row) => row.id) } } });
    await prisma.inspectionSettings.update({ where: { id: 1 }, data: { steerTargetPsi: 110, driveTargetPsi: 95, steerMinTread: 4, driveMinTread: 2, watchPct: 10, fixPct: 20 } });
  });

  it('A88 | El Manager agrega, renombra y desactiva puntos y cambia umbrales; la inspección guardada no cambia y el mecánico no edita', async () => {
    const { truck: row } = await createWo('957');
    const before = await state(row.id);
    ok('guardar una inspección antes', await manager.post(`/admin/trucks/${row.id}/inspection`, sheet(before)));

    const list = ok('leer la lista', await manager.get('/admin/inspection-checklist'));
    truthy('el Manager edita', list.canEdit);
    const mudflaps = await prisma.catalogJob.findFirstOrThrow({ where: { displayName: 'Mudflaps' } });
    const items = list.items.map((item: Json) => ({
      id: item.id,
      section: item.section,
      label: item.label === 'Mirrors' ? 'Side mirrors' : item.label,
      catalogJobId: item.catalogJob?.id ?? null,
      workflowStepKey: item.workflowStepKey,
      active: item.label === 'Deer guard' ? false : item.active,
    }));
    items.push({ section: 'exterior', label: 'Mud flaps', catalogJobId: mudflaps.id, workflowStepKey: null, active: true });
    const limits = { ...list.limits, driveTargetPsi: 100 };
    refused('el mecánico no edita', await as(USERS.general).put('/admin/inspection-checklist', { items, limits }), 403);
    refused('no se deja fuera un punto', await manager.put('/admin/inspection-checklist', { items: items.slice(1), limits }), 400, 'CHECKLIST_INCOMPLETE');
    const saved = ok('guardar la lista', await manager.put('/admin/inspection-checklist', { items, limits }));
    same('54 puntos, 53 activos', [saved.items.length, saved.items.filter((item: Json) => item.active).length], [54, 53]);
    same('umbral nuevo', saved.limits.driveTargetPsi, 100);

    const after = await state(row.id);
    truthy('la inspección guardada sigue diciendo Mirrors', after.inspection.items.some((item: Json) => item.label === 'Mirrors'));
    same('la próxima hoja tiene 53 activos', after.checklist.length, 53);
    refused('desactivar en el catálogo un Job que usa la hoja', await manager.patch(`/admin/catalog/jobs/${mudflaps.id}`, { status: 'inactive' }), 409, 'CATALOG_JOB_IN_INSPECTION_CHECKLIST');
  });
});

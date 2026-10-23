import { afterEach, beforeEach, describe, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  USERS, Json, adminWo, as, createWo, inspect, manager, ok, prisma, refused, resetDb, same, truckDetail, truthy, userId,
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
    // IN-7: it stays, marked as inspected by me, so Add defects is one tap away while the Work Order is open.
    truthy('el 944 sigue como inspeccionado por mí', after.find((item: Json) => item.truckNumber === '944')?.inspectedAt);
    refused('fuera de la hoja sigue sin agregar Jobs (A26)', await general.post(`/admin/trucks/${row.id}/work-plan/jobs`, {}), 403);
  });

  it('A89 | En "To inspect" quedan los camiones que inspeccioné (Add defects, IN-7); no los que inspeccionó otro', async () => {
    const id = await userId(USERS.general);
    ok('permiso', await manager.patch(`/admin/mechanics/${id}`, { canInspect: true }));
    const mine = await createWo('957');
    const theirs = await createWo('973');
    const sheetMine = await state(mine.truck.id, general);
    ok('el mecánico inspecciona el 957', await general.post(`/inspections/trucks/${mine.truck.id}`, sheet(sheetMine)));
    ok('el Manager inspecciona el 973', await manager.post(`/admin/trucks/${theirs.truck.id}/inspection`, sheet(await state(theirs.truck.id))));
    const queue = ok('cola', await general.get('/inspections/queue'));
    truthy('el 957 sigue, inspeccionado por mí', queue.find((item: Json) => item.truckNumber === '957')?.inspectedAt);
    same('el 973 no aparece', queue.some((item: Json) => item.truckNumber === '973'), false);
    const report = await state(mine.truck.id, general);
    const horn = report.inspection.items.find((item: Json) => item.label === 'Horn');
    ok('agrega un defecto desde ahí', await general.post(`/inspections/trucks/${mine.truck.id}/defects`, {
      idempotencyKey: randomUUID(),
      defects: [{ inspectionItemId: horn.id, note: 'No suena.' }],
    }));
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

describe('Inspecciones de antes de la hoja (IN-8)', () => {
  beforeEach(resetDb);

  it('A90 | Una visita inspeccionada con los botones viejos lo dice y deja llenar la hoja', async () => {
    const { truck: row } = await createWo('986');
    await inspect(row.id, 'issues_found');
    const before = await state(row.id);
    same('sin hoja guardada', before.inspection, null);
    same('dice el resultado viejo', before.legacyInspection?.outcome, 'issues_found');
    truthy('con quién', before.legacyInspection?.byName);
    const general = await userId(USERS.general);
    ok('permiso', await manager.patch(`/admin/mechanics/${general}`, { canInspect: true }));
    const queue = ok('cola', await as(USERS.general).get('/inspections/queue'));
    same('no está en "To inspect"', queue.some((item: Json) => item.truckNumber === '986'), false);
    await prisma.userCapability.deleteMany({ where: { userId: general, capability: 'INSPECTION_PERFORM' } });
    const saved = ok('llenar la hoja igual', await manager.post(`/admin/trucks/${row.id}/inspection`, sheet(before, { Brakes: 'Pastillas gastadas.' })));
    same('ya no es vieja', saved.legacyInspection, null);
    truthy('reporte guardado', saved.inspection);
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
    await prisma.inspectionSettings.update({ where: { id: 1 }, data: { steerTargetPsi: 110, driveTargetPsi: 95, steerMinTread: 4, driveMinTread: 2, watchPct: 10, fixPct: 20, treadWatchMargin: 2 } });
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

describe('Las llantas de la inspección van a Alignment y dicen qué llanta y por qué (D54)', () => {
  beforeEach(resetDb);

  it('A152 | Flat Repair y Tires nacen con el mecánico de Alignment, que ve la posición, los PSI o el tread y el motivo; "Assign later" a propósito los deja sin dueño', async () => {
    const { truck: row, workOrderId } = await createWo('931');
    const alignment = await userId(USERS.alignment);
    const before = await state(row.id);
    same('la hoja dice a quién van', before.tireJobsGoTo?.mechanic?.id, alignment);
    ok('guardar con una llanta baja y una gastada', await manager.post(`/admin/trucks/${row.id}/inspection`, sheet(before, {}, { LFO: [72, 8], RRO: [95, 1] })));

    const wo = await adminWo(workOrderId);
    const ownerOf = (job: Json) => job?.assignedMechanic?.id ?? job?.assignedMechanicId ?? null;
    same('Flat Repair va a Alignment', ownerOf(jobsNamed(wo, 'Flat Repair')[0]), alignment);
    same('Tires va a Alignment', ownerOf(jobsNamed(wo, 'Tires')[0]), alignment);

    const mine = ok('el mecánico de Alignment abre el camión', await as(USERS.alignment).get(`/work-orders/${workOrderId}`));
    const flat = mine.jobs.find((job: Json) => job.displayName === 'Flat Repair');
    same('ve qué llanta y por qué (presión)', flat.tireFindings, [{ position: 'LFO', psi: 72, targetPsi: 95, tread: 8, minTread: 2, reason: 'low_pressure' }]);
    const tires = mine.jobs.find((job: Json) => job.displayName === 'Tires');
    same('ve qué llanta y por qué (gastada)', tires.tireFindings.map((finding: Json) => `${finding.position}:${finding.reason}`), ['RRO:worn']);

    const other = await createWo('968');
    const sheet2 = await state(other.truck.id);
    ok('guardar con "Assign later" en Flat Repair', await manager.post(`/admin/trucks/${other.truck.id}/inspection`, sheet(sheet2, {}, { LFO: [72, 8] }, {
      assignments: [{ catalogJobId: sheet2.tireJobs.flatRepair.id, assignedMechanicId: null }],
    })));
    same('queda sin dueño', ownerOf(jobsNamed(await adminWo(other.workOrderId), 'Flat Repair')[0]), null);
  });

  it('A153 | Con dos en el equipo de Alignment la llanta espera en su cola; la inspección de un mecánico también manda las llantas a Alignment', async () => {
    const spare = await userId(USERS.spare);
    const step = await prisma.shopWorkflowStep.findUniqueOrThrow({ where: { stepKey: 'alignment' }, select: { id: true } });
    await prisma.shopWorkflowStepMember.create({ data: { stepId: step.id, userId: spare } });
    const general = await userId(USERS.general);
    await prisma.userCapability.deleteMany({ where: { userId: general, capability: 'INSPECTION_PERFORM' } });
    ok('permiso de inspeccionar', await manager.patch(`/admin/mechanics/${general}`, { canInspect: true }));
    try {
      const { truck: row, workOrderId } = await createWo('944');
      const before = await state(row.id, as(USERS.general));
      same('la hoja dice cola de Alignment', before.tireJobsGoTo?.queue, true);
      ok('el mecánico guarda con una llanta baja y frenos', await as(USERS.general).post(`/inspections/trucks/${row.id}`, sheet(before, { Brakes: 'Pastillas gastadas.' }, { RF: [80, 9] })));
      const wo = await adminWo(workOrderId);
      const flat = jobsNamed(wo, 'Flat Repair')[0];
      same('Flat Repair sin dueño, en la cola de Alignment', [flat?.assignedMechanic ?? null, flat?.workflowStepKey], [null, 'alignment']);
      same('Brake Inspection sigue naciendo sin dueño', jobsNamed(wo, 'Brake Inspection')[0]?.assignedMechanic ?? null, null);
      const queue = ok('la cola del otro de Alignment', await as(USERS.spare).get('/team-queue'));
      truthy('Flat Repair está en su cola', JSON.stringify(queue).includes('Flat Repair'));
    } finally {
      await prisma.userCapability.deleteMany({ where: { userId: general, capability: 'INSPECTION_PERFORM' } });
    }
  });
});

describe('Tread en el mínimo crea el Job Tires; el margen de Watch se edita en Setup (D57)', () => {
  beforeEach(resetDb);
  afterEach(async () => {
    await prisma.inspectionSettings.update({ where: { id: 1 }, data: { treadWatchMargin: 2 } });
  });

  it('A162 | Steer a 4/32 y drive a 2/32 (justo el mínimo) crean Tires; steer 5/32 y drive 3/32 quedan en Watch; 7/32 es OK', async () => {
    const { truck: row, workOrderId } = await createWo('905');
    const before = await state(row.id);
    same('el margen viene del taller', before.limits.treadWatchMargin, 2);
    const saved = ok('guardar con las llantas en el mínimo', await manager.post(`/admin/trucks/${row.id}/inspection`, sheet(before, {}, {
      LF: [110, 4], RF: [110, 5], LFO: [95, 2], LFI: [95, 3], RFI: [95, 5], RRO: [95, 7],
    })));
    same('estado por llanta', saved.inspection.tires.filter((tire: Json) => tire.status !== 'ok').map((tire: Json) => `${tire.position}:${tire.status}`), ['LF:fix', 'RF:watch', 'LFO:fix', 'LFI:watch']);
    const wo = await adminWo(workOrderId);
    same('un Job Tires', jobsNamed(wo, 'Tires').length, 1);
    same('sin Flat Repair', jobsNamed(wo, 'Flat Repair').length, 0);
    const mine = ok('el mecánico de Alignment abre el camión', await as(USERS.alignment).get(`/work-orders/${workOrderId}`));
    const tires = mine.jobs.find((job: Json) => job.displayName === 'Tires');
    same('las dos en el mínimo, gastadas', tires.tireFindings.map((finding: Json) => `${finding.position}:${finding.tread}/${finding.minTread}:${finding.reason}`).sort(), ['LF:4/4:worn', 'LFO:2/2:worn']);
  });

  it('A163 | El Manager cambia el margen en Setup: vale para la hoja nueva y la inspección guardada no se reclasifica', async () => {
    const { truck: row } = await createWo('957');
    const first = await state(row.id);
    ok('guardar con steer a 6/32 (Watch con margen 2)', await manager.post(`/admin/trucks/${row.id}/inspection`, sheet(first, {}, { LF: [110, 6] })));

    const list = ok('leer la lista', await manager.get('/admin/inspection-checklist'));
    same('margen de fábrica', list.limits.treadWatchMargin, 2);
    const items = list.items.map((item: Json) => ({ id: item.id, section: item.section, label: item.label, catalogJobId: item.catalogJob?.id ?? null, workflowStepKey: item.workflowStepKey, active: item.active }));
    refused('el margen no es negativo', await manager.put('/admin/inspection-checklist', { items, limits: { ...list.limits, treadWatchMargin: -1 } }), 400);
    const saved = ok('margen 1', await manager.put('/admin/inspection-checklist', { items, limits: { ...list.limits, treadWatchMargin: 1 } }));
    same('margen guardado', saved.limits.treadWatchMargin, 1);

    const after = await state(row.id);
    same('la hoja nueva usa el margen nuevo', after.limits.treadWatchMargin, 1);
    same('la lectura guardada sigue en Watch', after.inspection.tires.find((tire: Json) => tire.position === 'LF').status, 'watch');

    const other = await createWo('968');
    const sheet2 = await state(other.truck.id);
    const next = ok('guardar otra con steer a 6/32', await manager.post(`/admin/trucks/${other.truck.id}/inspection`, sheet(sheet2, {}, { LF: [110, 6], RF: [110, 5] })));
    same('con margen 1: 6/32 OK y 5/32 Watch', next.inspection.tires.filter((tire: Json) => tire.status !== 'ok').map((tire: Json) => `${tire.position}:${tire.status}`), ['RF:watch']);
  });
});

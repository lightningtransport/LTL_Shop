/**
 * D45 / ST-4 (LTR-224): a tire worn past the minimum at the inspection puts a tire to change on the Tires Job: steer
 * always New, drive Recap proposed. The Manager confirms; with one on the shelf it leaves the stock at the average
 * cost to that truck, with none it stays "to buy". The truck remembers what each position has mounted.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { Json, USERS, adminWo, as, assign, createWo, manager, ok, prisma, refused, resetDb, same, truthy } from '../harness';

const RUN = Date.now();
const POSITIONS = ['LF', 'RF', 'LFO', 'LFI', 'RFI', 'RFO', 'LRO', 'LRI', 'RRI', 'RRO'];
const STOCK = '/admin/parts-costs/stock';

/** Every check OK; every tire in range except `tires` (position → [psi, tread]). */
async function inspect(truckId: string, tires: Record<string, [number, number]>) {
  const current = ok('leer la inspección', await manager.get(`/admin/trucks/${truckId}/inspection`));
  return ok('guardar la hoja', await manager.post(`/admin/trucks/${truckId}/inspection`, {
    idempotencyKey: randomUUID(),
    items: current.checklist.map((item: Json) => ({ checklistItemId: item.id, result: 'ok' })),
    tires: POSITIONS.map((position) => {
      const [psi, tread] = tires[position] ?? [position === 'LF' || position === 'RF' ? 110 : 95, 9];
      return { position, psi, tread };
    }),
  }));
}

async function tirePart(name: string, tireType: 'new' | 'recap') {
  const category = await prisma.partCategory.findFirstOrThrow({ where: { kind: 'tire' }, orderBy: { sortOrder: 'asc' } });
  return ok(`llanta ${name}`, await manager.post('/admin/parts-costs/parts', { categoryId: category.id, displayName: `${name} ${RUN}`, tireSize: '11R22.5', tireType })).id as string;
}

const tiresJob = (wo: Json) => wo.jobs.find((job: Json) => job.displayName === 'Tires' && job.status !== 'cancelled');

async function cleanup() {
  await resetDb();
  const parts = (await prisma.part.findMany({ where: { displayName: { contains: String(RUN) } }, select: { id: true } })).map((row) => row.id);
  const movements = (await prisma.stockMovement.findMany({ where: { partId: { in: parts } }, select: { id: true } })).map((row) => row.id);
  await prisma.jobTireChange.deleteMany({ where: { partId: { in: parts } } });
  await prisma.truckCostEntry.deleteMany({ where: { sourceId: { in: movements }, reversesEntryId: { not: null } } });
  await prisma.truckCostEntry.deleteMany({ where: { sourceId: { in: movements } } });
  await prisma.stockMovement.deleteMany({ where: { id: { in: movements }, reversesId: { not: null } } });
  await prisma.stockMovement.deleteMany({ where: { id: { in: movements } } });
  await prisma.part.deleteMany({ where: { id: { in: parts } } });
}

describe('Manager: llantas desde la inspección (D45, ST-4)', () => {
  beforeEach(resetDb);
  afterAll(cleanup);

  it('A122 | La inspección pone en el Job Tires la llanta a cambiar: steer New, drive Recap; la presión sola no', async () => {
    const { truck, workOrderId } = await createWo('905');
    // RF 3/32 (steer min 4) and LRO 1/32 (drive min 2) → Tires; LFO at 70 PSI → Flat Repair only.
    await inspect(truck.id, { RF: [110, 3], LRO: [95, 1], LFO: [70, 9] });
    const wo = await adminWo(workOrderId);
    const job = tiresJob(wo);
    same('una llanta por posición gastada', job.tires.map((tire: Json) => [tire.position, tire.axle, tire.tireType, tire.status]), [['RF', 'steer', 'new', 'proposed'], ['LRO', 'drive', 'recap', 'proposed']]);
    same('con su lectura', job.tires.map((tire: Json) => tire.reading?.tread), [3, 1]);
    const flat = wo.jobs.find((item: Json) => item.displayName === 'Flat Repair');
    same('Flat Repair no trae llantas', flat.tires, []);
  });

  it('A123 | El Manager confirma: steer siempre New; la recap sale del stock al promedio, la nueva sin stock queda "to buy"', async () => {
    const [recap, fresh] = await Promise.all([tirePart('Recap 11R22.5', 'recap'), tirePart('New 11R22.5', 'new')]);
    ok('conteo de recaps', await manager.post(`${STOCK}/count`, { partId: recap, counted: 2, unitCostCents: 21000, reason: 'Conteo inicial' }));
    const { truck, workOrderId } = await createWo('905');
    await inspect(truck.id, { RF: [110, 3], LRO: [95, 1] });
    const job = tiresJob(await adminWo(workOrderId));
    const path = `/admin/parts-costs/jobs/${job.id}/tires`;

    refused('steer en recap', await manager.post(path, { tires: [{ position: 'RF', tireType: 'recap', partId: recap }] }), 400, 'STEER_NEEDS_NEW');
    refused('una parte que no es de ese tipo', await manager.post(path, { tires: [{ position: 'LRO', tireType: 'recap', partId: fresh }] }), 400, 'TIRE_PART_MISMATCH');
    refused('una posición sin llanta propuesta', await manager.post(path, { tires: [{ position: 'LF', tireType: 'new', partId: fresh }] }), 400, 'TIRE_NOT_PROPOSED');
    refused('el mecánico no confirma', await as(USERS.general).post(path, { tires: [{ position: 'LRO', tireType: 'recap', partId: recap }] }), 403);

    const result = ok('confirmar', await manager.post(path, { tires: [{ position: 'RF', tireType: 'new', partId: fresh }, { position: 'LRO', tireType: 'recap', partId: recap }] }));
    same('una sale del stock, otra por comprar', [result.issued, result.toBuy], [1, 1]);
    const after = tiresJob(await adminWo(workOrderId));
    same('estados', after.tires.map((tire: Json) => [tire.position, tire.status, tire.valueCents ?? null]), [['RF', 'to_buy', null], ['LRO', 'issued', 21000]]);
    same('el costo de la WO cuenta la recap', (await adminWo(workOrderId)).costs?.partsCents, 21000);
    const shelf = ok('stock', await manager.get(`${STOCK}/${recap}`));
    same('queda una recap', shelf.item.onHand, '1.00');
    refused('otra vez la misma', await manager.post(path, { tires: [{ position: 'LRO', tireType: 'recap', partId: recap }] }), 409, 'TIRE_ALREADY_ISSUED');

    ok('asignar Tires', await assign(workOrderId, job.id, USERS.general));
    const mechanic = ok('el mecánico', await as(USERS.general).get(`/work-orders/${workOrderId}`));
    const mine = mechanic.jobs.find((item: Json) => item.displayName === 'Tires');
    same('el mecánico ve qué poner, sin costo', mine.tires, [
      { position: 'RF', tireType: 'new', tireSize: '11R22.5', status: 'to_buy' },
      { position: 'LRO', tireType: 'recap', tireSize: '11R22.5', status: 'issued' },
    ]);
    truthy('sin montos', !/cents/i.test(JSON.stringify(mine)));
  });

  it('A124 | Llega la nueva y se toma después; la tarjeta del camión sabe qué tiene cada posición; devuelta, vuelve a "to buy"', async () => {
    const fresh = await tirePart('New steer 11R22.5', 'new');
    const { truck, workOrderId } = await createWo('905');
    await inspect(truck.id, { LF: [110, 2] });
    const job = tiresJob(await adminWo(workOrderId));
    const path = `/admin/parts-costs/jobs/${job.id}/tires`;
    ok('confirmar sin stock', await manager.post(path, { tires: [{ position: 'LF', tireType: 'new', partId: fresh }] }));
    ok('llega la nueva', await manager.post(`${STOCK}/count`, { partId: fresh, counted: 1, unitCostCents: 45000, reason: 'Llegó la factura' }));
    const taken = ok('tomarla', await manager.post(path, { tires: [{ position: 'LF', tireType: 'new', partId: fresh }] }));
    same('ahora sale del stock', taken.issued, 1);

    const state = ok('estado de la inspección', await manager.get(`/admin/trucks/${truck.id}/inspection`));
    same('LF tiene montada la nueva', state.installedTires.filter((tire: Json) => tire.position === 'LF').map((tire: Json) => [tire.tireType, tire.tireSize]), [['new', '11R22.5']]);
    const wo = await adminWo(workOrderId);
    same('la próxima vez propone esa medida en steer', tiresJob(wo).tires[0].suggestedSize, '11R22.5');

    const issue = tiresJob(wo).stockParts.find((part: Json) => !part.returned);
    ok('devolver al stock', await manager.post(`${STOCK}/movements/${issue.movementId}/return`, { reason: 'Era otra medida' }));
    same('vuelve a "to buy"', tiresJob(await adminWo(workOrderId)).tires.map((tire: Json) => tire.status), ['to_buy']);
    const again = ok('estado', await manager.get(`/admin/trucks/${truck.id}/inspection`));
    same('LF ya no la tiene montada', again.installedTires.some((tire: Json) => tire.position === 'LF' && tire.workOrderDisplayId === wo.displayId), false);
  });
});

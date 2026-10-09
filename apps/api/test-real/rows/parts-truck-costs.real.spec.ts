/**
 * LTR-200 / D32 (PC-4): Truck → Costs reads the cost ledger — totals by kind and month in a period, every movement
 * with reversals, and labor as hours only. Mechanics and Safety never see it; a PM writes nothing (D-PC4).
 * Every row works with its own vendor and puts back what it adds.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { Json, USERS, as, doPm, manager, ok, plannedWo, prisma, refused, resetDb, same, truck, truthy } from '../harness';

const RUN = Date.now();

async function vendor(tag: string) {
  return ok(`proveedor ${tag}`, await manager.post('/admin/parts-costs/vendors', { name: `${tag} ${RUN}`, doesParts: true, doesRepairs: true })).id as string;
}

function costs(truckId: string, query = '') {
  return manager.get(`/admin/parts-costs/trucks/${truckId}/costs${query}`);
}

async function cleanup() {
  await resetDb();
  const vendors = await prisma.vendor.findMany({ where: { name: { contains: String(RUN) } }, select: { id: true } });
  const vendorIds = vendors.map((row) => row.id);
  const repairs = await prisma.outsideRepair.findMany({ where: { vendorId: { in: vendorIds } }, select: { id: true } });
  const purchases = await prisma.partPurchase.findMany({ where: { vendorId: { in: vendorIds } }, select: { id: true } });
  const sources = [...repairs, ...purchases].map((row) => row.id);
  await prisma.truckCostEntry.deleteMany({ where: { sourceId: { in: sources }, reversesEntryId: { not: null } } });
  await prisma.truckCostEntry.deleteMany({ where: { sourceId: { in: sources } } });
  await prisma.outsideRepair.deleteMany({ where: { id: { in: repairs.map((row) => row.id) } } });
  await prisma.partPurchase.deleteMany({ where: { id: { in: purchases.map((row) => row.id) } } });
  await prisma.vendor.deleteMany({ where: { id: { in: vendorIds } } });
}

describe('Manager: costos del camión (D32, PC-4)', () => {
  beforeEach(resetDb);
  afterAll(cleanup);

  it('A66 | Totales por tipo y por mes = suma del libro en el período; anular una compra los baja', async () => {
    const vendorId = await vendor('Costs');
    const t957 = await truck('957');
    const before = ok('costos antes', await costs(t957.id, '?from=2026-08-01&to=2026-09-30'));
    const purchase = ok('compra de agosto', await manager.post('/admin/parts-costs/purchases', {
      vendorId, invoiceNumber: `C1-${RUN}`, invoiceDate: '2026-08-14', taxCents: 100,
      lines: [{ description: 'Fuel filter', quantity: 2, unitCostCents: 2450, truckId: t957.id }],
    }, { 'Idempotency-Key': randomUUID() }));
    ok('reparación de septiembre', await manager.post('/admin/parts-costs/outside-repairs', {
      truckId: t957.id, vendorId, invoiceNumber: `C2-${RUN}`, invoiceDate: '2026-09-03', description: 'Windshield', amountCents: 41000,
    }, { 'Idempotency-Key': randomUUID() }));
    ok('reparación de octubre (fuera del período)', await manager.post('/admin/parts-costs/outside-repairs', {
      truckId: t957.id, vendorId, invoiceNumber: `C3-${RUN}`, invoiceDate: '2026-10-02', description: 'Mirror', amountCents: 9900,
    }, { 'Idempotency-Key': randomUUID() }));

    let view = ok('costos ago–sep', await costs(t957.id, '?from=2026-08-01&to=2026-09-30'));
    same('partes y reparaciones del período', [view.totals.partsCents - before.totals.partsCents, view.totals.outsideCents - before.totals.outsideCents], [5000, 41000]);
    same('el total es la suma', view.totals.totalCents, view.totals.partsCents + view.totals.outsideCents);
    const month = (key: string) => (view.months as Json[]).find((item) => item.month === key);
    truthy('agosto trae la compra y septiembre la reparación', month('2026-08')?.partsCents >= 5000 && month('2026-09')?.outsideCents >= 41000);
    truthy('octubre no entra', !(view.months as Json[]).some((item) => item.month === '2026-10'));
    const line = (view.entries as Json[]).find((item) => item.sourceId === purchase.id);
    same('el movimiento dice qué fue', [line?.kind, line?.amountCents, line?.reversal], ['part_purchase', 5000, null]);

    ok('anular la compra', await manager.post(`/admin/parts-costs/purchases/${purchase.id}/void`, { reason: 'Duplicada' }));
    view = ok('costos después de anular', await costs(t957.id, '?from=2026-08-01&to=2026-09-30'));
    same('las partes vuelven a lo de antes', view.totals.partsCents, before.totals.partsCents);
    const reversal = (view.entries as Json[]).find((item) => item.sourceId === purchase.id && item.reversal);
    same('la anulación sale como reversa negativa', [reversal?.reversal, reversal?.amountCents], ['voided', -5000]);
    truthy('todo el tiempo incluye octubre', (ok('todo', await costs(t957.id)).months as Json[]).some((item: Json) => item.month === '2026-10'));
  });

  it('A67 | La mano de obra son las horas de las sesiones cerradas del camión en el período, sin monto', async () => {
    const t931 = await truck('931');
    const { workOrderId } = await plannedWo('931');
    const today = new Date();
    const day = today.toISOString().slice(0, 10);
    const sessionStart = new Date(today.getTime() - 3 * 60 * 60 * 1000);
    await prisma.workSession.create({ data: { workOrderId, startedAt: sessionStart, endedAt: new Date(sessionStart.getTime() + 90 * 60 * 1000), userId: null } });
    await prisma.workSession.create({ data: { workOrderId, startedAt: new Date(), endedAt: null, userId: null } });
    const view = ok('costos de hoy', await costs(t931.id, `?from=${day}&to=${day}`));
    const closed = await prisma.workSession.findMany({ where: { workOrder: { truckId: t931.id }, endedAt: { not: null }, startedAt: { gte: new Date(`${day}T00:00:00Z`) } } });
    const expected = Math.round((closed.reduce((sum, item) => sum + (item.endedAt!.getTime() - item.startedAt.getTime()), 0) / 3_600_000) * 100) / 100;
    same('horas de las sesiones cerradas (la abierta no cuenta)', view.laborHours, expected);
    truthy('incluye la hora y media cargada', view.laborHours >= 1.5);
    truthy('no hay monto de mano de obra', !(view.entries as Json[]).some((item) => item.kind === 'labor'));
  });

  it('A68 | Mecánicos y Safety no ven los costos del camión; terminar un PM no escribe en el libro (D-PC4)', async () => {
    const t905 = await truck('905');
    for (const email of [USERS.general, USERS.pm, USERS.safety]) {
      refused(`${email}: costos`, await as(email).get(`/admin/parts-costs/trucks/${t905.id}/costs`), 403);
    }
    const rowsBefore = await prisma.truckCostEntry.count({ where: { truckId: t905.id } });
    const { workOrderId } = await plannedWo('905');
    await doPm(workOrderId, t905.id);
    same('el PM no escribió nada', await prisma.truckCostEntry.count({ where: { truckId: t905.id } }), rowsBefore);
    refused('un camión que no existe', await costs(randomUUID()), 404);
  });
});

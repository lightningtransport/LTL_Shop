/**
 * D45 / ST-1 (LTR-221): a purchase line can name the Job of its truck it was bought for (changes P16, D37). The Job
 * shows its parts (cost to the Manager only, D32), the ledger row carries the Work Order, and a Job of another truck
 * or a cancelled one is refused.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { Json, USERS, adminWo, as, manager, meta, namedJob, ok, plannedWo, prisma, refused, resetDb, same } from '../harness';

const RUN = Date.now();
const PURCHASES = '/admin/parts-costs/purchases';

async function vendor(tag: string) {
  return ok(`proveedor ${tag}`, await manager.post('/admin/parts-costs/vendors', { name: `${tag} ${RUN}` })).id as string;
}

function save(body: Json, key: string = randomUUID()) {
  return manager.post(PURCHASES, body, { 'Idempotency-Key': key });
}

async function ledger(purchaseId: string) {
  return prisma.truckCostEntry.findMany({ where: { sourceType: 'part_purchase', sourceId: purchaseId }, orderBy: [{ createdAt: 'asc' }, { amountCents: 'desc' }] });
}

async function cleanup() {
  await resetDb();
  const vendors = await prisma.vendor.findMany({ where: { name: { contains: String(RUN) } }, select: { id: true } });
  const purchases = await prisma.partPurchase.findMany({ where: { vendorId: { in: vendors.map((row) => row.id) } }, select: { id: true } });
  const ids = purchases.map((row) => row.id);
  await prisma.truckCostEntry.deleteMany({ where: { sourceType: 'part_purchase', sourceId: { in: ids }, reversesEntryId: { not: null } } });
  await prisma.truckCostEntry.deleteMany({ where: { sourceType: 'part_purchase', sourceId: { in: ids } } });
  await prisma.partPurchase.deleteMany({ where: { id: { in: ids } } });
  await prisma.vendor.deleteMany({ where: { id: { in: vendors.map((row) => row.id) } } });
}

describe('Manager: la compra se ata al Job de su camión (D45, ST-1)', () => {
  beforeEach(resetDb);
  afterAll(cleanup);

  it('A111 | Una línea se ata al Job de su camión: el Job muestra la parte, el costo va al camión con su WO', async () => {
    const vendorId = await vendor('FleetPride');
    const { truck: t968, workOrderId } = await plannedWo('968', [{ category: 'Fuel System', job: 'Fuel Filters', assignee: USERS.general }]);
    const job = namedJob(await adminWo(workOrderId), 'Fuel Filters');

    const offered = ok('Jobs del camión', await manager.get(`/admin/parts-costs/truck-jobs?truckId=${t968.id}`)) as Json[];
    same('ofrece el Job, abierto', offered.filter((item) => item.id === job.id).map((item) => [item.workOrderId, item.open]), [[workOrderId, true]]);

    const saved = ok('guardar', await save({
      vendorId,
      invoiceNumber: `J-${RUN}`,
      invoiceDate: '2026-10-16',
      taxCents: 300,
      freightCents: 0,
      lines: [
        { description: 'Fuel filter', quantity: 2, unitCostCents: 2400, truckId: t968.id, workOrderJobId: job.id },
        { description: 'Shop towels', quantity: 1, unitCostCents: 1200, truckId: t968.id },
      ],
    }));
    const detail = ok('detalle', await manager.get(`${PURCHASES}/${saved.id}`));
    same('la línea dice su Job', detail.lines.map((line: Json) => line.job?.id ?? null), [job.id, null]);
    same('el camión recibe lo mismo que antes (D-PC2)', detail.truckShares.map((share: Json) => share.amountCents), [6300]);

    // 48 + 12 = 60 of lines; tax 3.00 split 4:1 → 2.40 and 0.60.
    const rows = await ledger(saved.id);
    same('una fila con el WO y otra sin WO; la suma no cambia', rows.map((row) => [row.amountCents, row.workOrderId]).sort((left, right) => Number(right[0]) - Number(left[0])), [[5040, workOrderId], [1260, null]]);
    same('el costo del WO cuenta la parte', (await adminWo(workOrderId)).costs?.partsCents, 5040);

    const managerJob = namedJob(await adminWo(workOrderId), 'Fuel Filters');
    same('el Manager ve la parte con su costo', managerJob.parts, [{ purchaseId: saved.id, description: 'Fuel filter', partNumber: null, quantity: '2.00', vendorName: `FleetPride ${RUN}`, lineTotalCents: 4800 }]);
    const mechanicWo = ok('el mecánico abre su WO', await as(USERS.general).get(`/work-orders/${workOrderId}`));
    same('el mecánico ve la parte sin costo', namedJob(mechanicWo, 'Fuel Filters').parts, [{ description: 'Fuel filter', partNumber: null, quantity: '2.00' }]);
  });

  it('A112 | Un Job de otro camión, uno cancelado o un Job sin camión: no se guarda', async () => {
    const vendorId = await vendor('TruckPro');
    const { truck: t968, workOrderId } = await plannedWo('968', [
      { category: 'Fuel System', job: 'Fuel Filters', assignee: USERS.general },
      { category: 'Fuel System', job: 'Fuel Lines', assignee: USERS.general },
    ]);
    const other = await plannedWo('905', [{ category: 'Fuel System', job: 'Fuel Filters', assignee: USERS.general }]);
    const otherJob = namedJob(await adminWo(other.workOrderId), 'Fuel Filters');
    const base = { vendorId, invoiceNumber: `X-${RUN}`, invoiceDate: '2026-10-16' };
    const line = { description: 'Fuel filter', quantity: 1, unitCostCents: 2400 };

    refused('Job de otro camión', await save({ ...base, lines: [{ ...line, truckId: t968.id, workOrderJobId: otherJob.id }] }), 400, 'JOB_NOT_ON_TRUCK');
    refused('Job sin camión', await save({ ...base, lines: [{ ...line, workOrderJobId: otherJob.id }] }), 400);

    const lines = namedJob(await adminWo(workOrderId), 'Fuel Lines');
    ok('cancelar Fuel Lines', await manager.post(`/admin/jobs/${lines.id}/cancel`, { ...(await meta(workOrderId)), reason: 'No hacía falta.' }));
    refused('Job cancelado', await save({ ...base, lines: [{ ...line, truckId: t968.id, workOrderJobId: lines.id }] }), 400, 'JOB_CANCELLED');
    const offered = ok('Jobs del camión', await manager.get(`/admin/parts-costs/truck-jobs?truckId=${t968.id}`)) as Json[];
    same('no ofrece el cancelado', offered.some((item) => item.id === lines.id), false);
    same('nada se guardó', await prisma.partPurchase.count({ where: { vendorId } }), 0);
  });

  it('A113 | Cambiar el Job de una línea escribe reversas; editar solo las notas no toca el costo', async () => {
    const vendorId = await vendor('Rush');
    const { truck: t968, workOrderId } = await plannedWo('968', [
      { category: 'Fuel System', job: 'Fuel Filters', assignee: USERS.general },
      { category: 'Fuel System', job: 'Fuel Lines', assignee: USERS.general },
    ]);
    const wo = await adminWo(workOrderId);
    const filters = namedJob(wo, 'Fuel Filters');
    const fuelLines = namedJob(wo, 'Fuel Lines');
    const body = { vendorId, invoiceNumber: `C-${RUN}`, invoiceDate: '2026-10-16', lines: [{ description: 'Fuel hose', quantity: 1, unitCostCents: 3000, truckId: t968.id, workOrderJobId: filters.id }] };
    const saved = ok('guardar', await save(body));

    ok('solo notas', await manager.patch(`${PURCHASES}/${saved.id}`, { ...body, notes: 'Pagada con tarjeta' }));
    same('sin reversas', (await ledger(saved.id)).length, 1);

    ok('cambiar al Job correcto', await manager.patch(`${PURCHASES}/${saved.id}`, { ...body, lines: [{ ...body.lines[0], workOrderJobId: fuelLines.id }] }));
    const rows = await ledger(saved.id);
    same('reversa y fila nueva, todo con el WO', rows.map((row) => [row.amountCents, row.workOrderId, Boolean(row.reversesEntryId)]).sort(), [[-3000, workOrderId, true], [3000, workOrderId, false], [3000, workOrderId, false]].sort());
    const after = await adminWo(workOrderId);
    same('la parte se mueve de Job', [namedJob(after, 'Fuel Filters').parts?.length ?? 0, namedJob(after, 'Fuel Lines').parts?.length ?? 0], [0, 1]);

    ok('anular', await manager.post(`${PURCHASES}/${saved.id}/void`, { reason: 'Cargada dos veces' }));
    same('anulada, el Job ya no la muestra', namedJob(await adminWo(workOrderId), 'Fuel Lines').parts, []);
  });
});

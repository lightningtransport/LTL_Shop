/**
 * D45 / ST-5 (LTR-225, P29): when the Manager completes a PM Work Order, each part the mechanic picked leaves the
 * shelf (one unit, average cost) and costs the truck on that Work Order; a part not on the shelf is not charged. The
 * oil change is a flat price set by the Manager. Reopening or cancelling undoes both, like labor.
 *
 * A133 FAILS on purpose until LTR-242 is fixed: a PM part already bought straight to the truck is charged again from
 * the shelf. The repo has no expected-failing marker; the row stays red, marked ❌ in docs/USER_FLOWS.md.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, it } from 'vitest';
import { USERS, adminCompleteJob, adminWo, as, closeWo, doPm, laneJob, manager, meta, ok, plannedWo, prisma, refused, resetDb, same } from '../harness';

const STOCK = '/admin/parts-costs/stock';
const RUN = Date.now();
const today = () => new Date().toISOString().slice(0, 10);
let started = new Date();

async function clear() {
  await resetDb();
  const movements = (await prisma.stockMovement.findMany({ where: { createdAt: { gte: started } }, select: { id: true } })).map((row) => row.id);
  await prisma.truckCostEntry.deleteMany({ where: { OR: [{ sourceId: { in: movements } }, { sourceType: 'pm_oil_change' }], reversesEntryId: { not: null } } });
  await prisma.truckCostEntry.deleteMany({ where: { OR: [{ sourceId: { in: movements } }, { sourceType: 'pm_oil_change' }] } });
  await prisma.stockMovement.deleteMany({ where: { id: { in: movements }, reversesId: { not: null } } });
  await prisma.stockMovement.deleteMany({ where: { id: { in: movements } } });
  await prisma.pmOilPrice.deleteMany({});
}

/** A PM Work Order whose mechanic finished the PM; the Manager closes the other lanes but not the Work Order. */
async function pmReadyToClose(truckNumber: string) {
  const { truck, workOrderId } = await plannedWo(truckNumber);
  await doPm(workOrderId, truck.id);
  for (const lane of ['alignment', 'detailing', 'quality_check'] as const) {
    ok(`Manager completa ${lane}`, await adminCompleteJob(workOrderId, laneJob(await adminWo(workOrderId), lane).id));
  }
  const picked = await prisma.pmServicePart.findFirstOrThrow({ where: { pmService: { workOrderId } }, select: { partId: true } });
  return { truck, workOrderId, partId: picked.partId };
}

/** Purchases of row A133, tagged by a vendor named with RUN. */
async function clearPurchases() {
  const vendors = (await prisma.vendor.findMany({ where: { name: { contains: String(RUN) } }, select: { id: true } })).map((row) => row.id);
  const ids = (await prisma.partPurchase.findMany({ where: { vendorId: { in: vendors } }, select: { id: true } })).map((row) => row.id);
  await prisma.truckCostEntry.deleteMany({ where: { sourceType: 'part_purchase', sourceId: { in: ids }, reversesEntryId: { not: null } } });
  await prisma.truckCostEntry.deleteMany({ where: { sourceType: 'part_purchase', sourceId: { in: ids } } });
  await prisma.stockMovement.deleteMany({ where: { purchaseId: { in: ids }, reversesId: { not: null } } });
  await prisma.stockMovement.deleteMany({ where: { purchaseId: { in: ids } } });
  await prisma.partPurchase.deleteMany({ where: { id: { in: ids } } });
  await prisma.vendor.deleteMany({ where: { id: { in: vendors } } });
}

const ledger = (workOrderId: string) => prisma.truckCostEntry.findMany({ where: { workOrderId, kind: 'part_purchase' } });
const net = (rows: Array<{ amountCents: number }>) => rows.reduce((sum, row) => sum + row.amountCents, 0);

describe('Manager: el PM descuenta del stock y cobra el cambio de aceite (D45, ST-5)', () => {
  beforeEach(async () => { started = new Date(); await clear(); });
  afterEach(clear);
  afterAll(clearPurchases);

  it('A125 | Al completar el WO, la parte del PM sale del estante y el aceite se cobra; reabrir lo deshace', async () => {
    const { workOrderId, partId } = await pmReadyToClose('931');
    ok('hay 3 en el estante a $24', await manager.post(`${STOCK}/count`, { partId, counted: 3, unitCostCents: 2400, reason: 'Conteo inicial' }));
    ok('precio del aceite desde hoy', await manager.post('/admin/parts-costs/pm-oil-prices', { amountCents: 18500, effectiveFrom: today() }));
    same('antes de cerrar, nada', net(await ledger(workOrderId)), 0);

    ok('cerrar el WO', await closeWo(workOrderId));
    same('quedan 2', ok('stock', await manager.get(`${STOCK}/${partId}`)).item.onHand, '2.00');
    const rows = await ledger(workOrderId);
    same('el filtro ($24) y el aceite ($185) en esa WO', rows.map((row) => [row.sourceType, row.amountCents]).sort(), [['pm_oil_change', 18500], ['stock_issue', 2400]]);
    same('el costo de la WO los cuenta', (await adminWo(workOrderId)).costs?.partsCents, 20900);

    ok('reabrir', await manager.post(`/admin/work-orders/${workOrderId}/reopen`, { ...(await meta(workOrderId)), reason: 'Falta un ajuste' }));
    same('el filtro vuelve al estante', ok('stock', await manager.get(`${STOCK}/${partId}`)).item.onHand, '3.00');
    same('y el camión recibe las reversas', net(await ledger(workOrderId)), 0);

    for (const lane of ['alignment', 'detailing', 'quality_check'] as const) {
      const job = laneJob(await adminWo(workOrderId), lane);
      if (job.status !== 'completed') ok(`completa ${lane}`, await adminCompleteJob(workOrderId, job.id));
    }
    ok('cerrar otra vez', await closeWo(workOrderId));
    same('sale una sola vez', ok('stock', await manager.get(`${STOCK}/${partId}`)).item.onHand, '2.00');
    same('se cobra una sola vez', net(await ledger(workOrderId)), 20900);
  });

  it('A126 | Una parte del PM que no está en el estante no se cobra; sin precio de aceite, no hay cargo de aceite', async () => {
    const { workOrderId, partId } = await pmReadyToClose('905');
    ok('cerrar el WO', await closeWo(workOrderId));
    same('el estante sigue en cero', ok('stock', await manager.get(`${STOCK}/${partId}`)).item.onHand, '0.00');
    same('nada en el costo del camión por partes del PM', net(await ledger(workOrderId)), 0);
  });

  it('A127 | El precio del aceite empieza hoy o después, uno por día; mecánicos y Safety no lo ven', async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    refused('desde ayer', await manager.post('/admin/parts-costs/pm-oil-prices', { amountCents: 18500, effectiveFrom: yesterday }), 400, 'PM_OIL_PRICE_PAST');
    ok('desde hoy', await manager.post('/admin/parts-costs/pm-oil-prices', { amountCents: 18500, effectiveFrom: today() }));
    refused('el mismo día', await manager.post('/admin/parts-costs/pm-oil-prices', { amountCents: 19000, effectiveFrom: today() }), 409, 'PM_OIL_PRICE_DATE_TAKEN');
    same('el precio de hoy', ok('precios', await manager.get('/admin/parts-costs/pm-oil-prices')).current?.amountCents, 18500);
    for (const email of [USERS.general, USERS.pm, USERS.safety]) refused(`${email}: ver precios`, await as(email).get('/admin/parts-costs/pm-oil-prices'), 403);
  });

  it('A133 | Una parte del PM comprada directo al camión no se cobra otra vez al cerrar, aunque también haya en el estante', async () => {
    const { truck, workOrderId, partId } = await pmReadyToClose('931');
    const pmJob = laneJob(await adminWo(workOrderId), 'pm');
    const vendorId = ok('proveedor', await manager.post('/admin/parts-costs/vendors', { name: `FleetPride ${RUN}` })).id as string;
    const buy = (body: Record<string, unknown>) => manager.post('/admin/parts-costs/purchases', { vendorId, invoiceDate: today(), taxCents: 0, freightCents: 0, ...body }, { 'Idempotency-Key': randomUUID() });
    ok('compra 2 filtros al estante a $24', await buy({ invoiceNumber: `S-${RUN}`, lines: [{ partId, quantity: 2, unitCostCents: 2400, destination: 'stock' }] }));
    ok('compra 1 filtro directo al camión, para el Job de PM, a $30', await buy({ invoiceNumber: `T-${RUN}`, lines: [{ partId, quantity: 1, unitCostCents: 3000, truckId: truck.id, workOrderJobId: pmJob.id }] }));
    same('antes de cerrar, la WO ya tiene el filtro una vez', (await adminWo(workOrderId)).costs?.partsCents, 3000);

    ok('cerrar el WO', await closeWo(workOrderId));
    same('el costo de la WO cuenta el filtro una sola vez', (await adminWo(workOrderId)).costs?.partsCents, 3000);
    same('el estante no se toca: el filtro del PM ya vino del camión', ok('stock', await manager.get(`${STOCK}/${partId}`)).item.onHand, '2.00');
    same('el camión no recibe un stock_issue por ese filtro', (await ledger(workOrderId)).filter((row) => row.sourceType === 'stock_issue').length, 0);
  });
});

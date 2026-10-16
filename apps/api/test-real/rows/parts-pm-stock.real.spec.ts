/**
 * D45 / ST-5 (LTR-225, P29): when the Manager completes a PM Work Order, each part the mechanic picked leaves the
 * shelf (one unit, average cost) and costs the truck on that Work Order; a part not on the shelf is not charged. The
 * oil change is a flat price set by the Manager. Reopening or cancelling undoes both, like labor.
 */
import { afterEach, beforeEach, describe, it } from 'vitest';
import { USERS, adminCompleteJob, adminWo, as, closeWo, doPm, laneJob, manager, meta, ok, plannedWo, prisma, refused, resetDb, same } from '../harness';

const STOCK = '/admin/parts-costs/stock';
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

const ledger = (workOrderId: string) => prisma.truckCostEntry.findMany({ where: { workOrderId, kind: 'part_purchase' } });
const net = (rows: Array<{ amountCents: number }>) => rows.reduce((sum, row) => sum + row.amountCents, 0);

describe('Manager: el PM descuenta del stock y cobra el cambio de aceite (D45, ST-5)', () => {
  beforeEach(async () => { started = new Date(); await clear(); });
  afterEach(clear);

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
});

/**
 * D45 / ST-3 (LTR-223): the Shop's stock. A purchase line "To stock" enters it (with its share of tax and freight),
 * the Manager counts the shelf (P25), a part leaves to a Job at the average cost (P27) and costs that truck on that
 * Work Order, "Return to stock" undoes it, and a purchase whose stock already left cannot be voided.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { Json, USERS, adminWo, as, manager, meta, namedJob, ok, plannedWo, prisma, refused, resetDb, same } from '../harness';

const RUN = Date.now();
const STOCK = '/admin/parts-costs/stock';

async function vendor(tag: string) {
  return ok(`proveedor ${tag}`, await manager.post('/admin/parts-costs/vendors', { name: `${tag} ${RUN}` })).id as string;
}

async function part(name: string, extra: Json = {}) {
  const category = await prisma.partCategory.findFirstOrThrow({ where: { kind: extra.tireSize ? 'tire' : 'repair' }, orderBy: { sortOrder: 'asc' } });
  return ok(`parte ${name}`, await manager.post('/admin/parts-costs/parts', { categoryId: category.id, displayName: `${name} ${RUN}`, ...extra })).id as string;
}

function buy(body: Json) {
  return manager.post('/admin/parts-costs/purchases', body, { 'Idempotency-Key': randomUUID() });
}

async function onHand(partId: string) {
  const detail = ok('stock de la parte', await manager.get(`${STOCK}/${partId}`));
  return [detail.item.onHand, detail.item.valueCents, detail.item.avgCostCents];
}

async function cleanup() {
  await resetDb();
  const parts = (await prisma.part.findMany({ where: { displayName: { contains: String(RUN) } }, select: { id: true } })).map((row) => row.id);
  const movements = (await prisma.stockMovement.findMany({ where: { partId: { in: parts } }, select: { id: true } })).map((row) => row.id);
  const vendors = (await prisma.vendor.findMany({ where: { name: { contains: String(RUN) } }, select: { id: true } })).map((row) => row.id);
  const purchases = (await prisma.partPurchase.findMany({ where: { vendorId: { in: vendors } }, select: { id: true } })).map((row) => row.id);
  const sources = [...movements, ...purchases];
  await prisma.truckCostEntry.deleteMany({ where: { sourceId: { in: sources }, reversesEntryId: { not: null } } });
  await prisma.truckCostEntry.deleteMany({ where: { sourceId: { in: sources } } });
  await prisma.stockMovement.deleteMany({ where: { id: { in: movements }, reversesId: { not: null } } });
  await prisma.stockMovement.deleteMany({ where: { id: { in: movements } } });
  await prisma.partPurchase.deleteMany({ where: { id: { in: purchases } } });
  await prisma.part.deleteMany({ where: { id: { in: parts } } });
  await prisma.vendor.deleteMany({ where: { id: { in: vendors } } });
}

describe('Manager: el stock del taller (D45, ST-3)', () => {
  beforeEach(resetDb);
  afterAll(cleanup);

  it('A117 | Una línea "To stock" entra al stock con su parte del impuesto; "Shop supplies" no; un "Other" no entra', async () => {
    const vendorId = await vendor('FleetPride');
    const pump = await part('Water pump', { minStock: 3 });
    const base = { vendorId, invoiceDate: '2026-10-16' };
    refused('un "Other" no va al stock', await buy({ ...base, invoiceNumber: `X-${RUN}`, lines: [{ description: 'Rags', quantity: 1, unitCostCents: 500, destination: 'stock' }] }), 400);
    ok('compra', await buy({
      ...base, invoiceNumber: `S-${RUN}`, taxCents: 300,
      lines: [
        { partId: pump, quantity: 2, unitCostCents: 10000, destination: 'stock' },
        { description: 'Shop towels', quantity: 1, unitCostCents: 10000, destination: 'shop_supplies' },
      ],
    }));
    // Tax 3.00 split 2:1 between the two lines without a truck: the pumps carry 2.00.
    same('dos bombas, $202.00, promedio $101.00', await onHand(pump), ['2.00', 20200, 10100]);
    const list = ok('Stock', await manager.get(`${STOCK}?low=true`));
    same('bajo el mínimo (3) sale en Low', list.items.filter((item: Json) => item.partId === pump).map((item: Json) => item.low), [true]);
    for (const email of [USERS.general, USERS.pm, USERS.safety]) refused(`${email}: ver el stock`, await as(email).get(STOCK), 403);
  });

  it('A118 | El Manager cuenta el estante: lo que sobra entra a su costo, lo que falta sale al promedio', async () => {
    const recap = await part('Recap', { tireSize: '11R22.5', tireType: 'recap' });
    refused('sin costo no entra', await manager.post(`${STOCK}/count`, { partId: recap, counted: 4, reason: 'Conteo inicial' }), 400, 'STOCK_COST_REQUIRED');
    ok('conteo inicial (P25)', await manager.post(`${STOCK}/count`, { partId: recap, counted: 4, unitCostCents: 20000, reason: 'Conteo inicial' }));
    same('4 recaps a $200', await onHand(recap), ['4.00', 80000, 20000]);
    refused('el mismo número', await manager.post(`${STOCK}/count`, { partId: recap, counted: '4', reason: 'Otra vez' }), 400, 'STOCK_COUNT_SAME');
    ok('falta una', await manager.post(`${STOCK}/count`, { partId: recap, counted: 3, reason: 'Una rota' }));
    same('3 recaps, siguen a $200', await onHand(recap), ['3.00', 60000, 20000]);
  });

  it('A119 | Sale a un Job al costo promedio: cuesta al camión en esa WO; el Job la muestra; sin stock o Job cancelado, no', async () => {
    const vendorId = await vendor('Recaps');
    const recap = await part('Recap drive', { tireSize: '11R22.5', tireType: 'recap' });
    ok('enero: 2 a $200', await buy({ vendorId, invoiceNumber: `E-${RUN}`, invoiceDate: '2026-01-10', lines: [{ partId: recap, quantity: 2, unitCostCents: 20000, destination: 'stock' }] }));
    ok('marzo: 2 a $260', await buy({ vendorId, invoiceNumber: `M-${RUN}`, invoiceDate: '2026-03-10', lines: [{ partId: recap, quantity: 2, unitCostCents: 26000, destination: 'stock' }] }));
    same('promedio $230 (P27)', (await onHand(recap))[2], 23000);

    const { truck: t968, workOrderId } = await plannedWo('968', [
      { category: 'Tires & Wheels', job: 'Tires', assignee: USERS.general },
      { category: 'Fuel System', job: 'Fuel Filters', assignee: USERS.general },
    ]);
    const wo = await adminWo(workOrderId);
    const tires = namedJob(wo, 'Tires');
    const issued = ok('sacar una para Tires', await manager.post(`${STOCK}/issue`, { partId: recap, quantity: 1, workOrderJobId: tires.id }));
    same('cuesta $230', issued.valueCents, 23000);
    same('quedan 3 a $230', await onHand(recap), ['3.00', 69000, 23000]);
    const rows = await prisma.truckCostEntry.findMany({ where: { sourceType: 'stock_issue', sourceId: issued.id } });
    same('el camión la carga en esa WO, como parte', rows.map((row) => [row.truckId, row.amountCents, row.workOrderId, row.kind]), [[t968.id, 23000, workOrderId, 'part_purchase']]);
    same('el costo de la WO la cuenta', (await adminWo(workOrderId)).costs?.partsCents, 23000);
    same('el Manager la ve en el Job con su valor', namedJob(await adminWo(workOrderId), 'Tires').stockParts.map((row: Json) => [row.quantity, row.valueCents, row.returned]), [['1.00', 23000, false]]);
    const mechanic = ok('el mecánico', await as(USERS.general).get(`/work-orders/${workOrderId}`));
    same('el mecánico la ve sin costo', namedJob(mechanic, 'Tires').parts, [{ description: `Recap drive ${RUN}`, partNumber: null, quantity: '1.00' }]);

    refused('más de lo que hay', await manager.post(`${STOCK}/issue`, { partId: recap, quantity: 4, workOrderJobId: tires.id }), 409, 'NOT_ENOUGH_STOCK');
    const filters = namedJob(wo, 'Fuel Filters');
    ok('cancelar Fuel Filters', await manager.post(`/admin/jobs/${filters.id}/cancel`, { ...(await meta(workOrderId)), reason: 'No hacía falta.' }));
    refused('Job cancelado', await manager.post(`${STOCK}/issue`, { partId: recap, quantity: 1, workOrderJobId: filters.id }), 400, 'JOB_CANCELLED');
    refused('el mecánico no saca del stock', await as(USERS.general).post(`${STOCK}/issue`, { partId: recap, quantity: 1, workOrderJobId: tires.id }), 403);
  });

  it('A120 | Return to stock: vuelve al mismo costo, el camión recibe la reversa; una sola vez', async () => {
    const recap = await part('Recap ret', { tireSize: '11R22.5', tireType: 'recap' });
    ok('conteo', await manager.post(`${STOCK}/count`, { partId: recap, counted: 2, unitCostCents: 21000, reason: 'Conteo inicial' }));
    const { workOrderId } = await plannedWo('968', [{ category: 'Tires & Wheels', job: 'Tires', assignee: USERS.general }]);
    const tires = namedJob(await adminWo(workOrderId), 'Tires');
    const issued = ok('sacar', await manager.post(`${STOCK}/issue`, { partId: recap, quantity: 1, workOrderJobId: tires.id }));
    refused('devolver pide motivo', await manager.post(`${STOCK}/movements/${issued.id}/return`, { reason: ' ' }), 400);
    ok('devolver', await manager.post(`${STOCK}/movements/${issued.id}/return`, { reason: 'Era otra medida' }));
    same('vuelven a ser 2 a $210', await onHand(recap), ['2.00', 42000, 21000]);
    const rows = await prisma.truckCostEntry.findMany({ where: { sourceType: 'stock_issue', sourceId: issued.id } });
    same('fila y su reversa', rows.map((row) => row.amountCents).sort((a, b) => a - b), [-21000, 21000]);
    same('el Job la marca devuelta', namedJob(await adminWo(workOrderId), 'Tires').stockParts.map((row: Json) => row.returned), [true]);
    refused('otra vez', await manager.post(`${STOCK}/movements/${issued.id}/return`, { reason: 'Otra vez' }), 409, 'STOCK_ALREADY_RETURNED');
    const mechanic = ok('el mecánico', await as(USERS.general).get(`/work-orders/${workOrderId}`));
    same('el mecánico ya no la ve', namedJob(mechanic, 'Tires').parts, []);
  });

  it('A144 | Return to stock devuelve 1 de 2: vuelve al mismo costo y el camión paga solo la que queda; después la otra (D47, LTR-247)', async () => {
    const recap = await part('Recap partial', { tireSize: '11R22.5', tireType: 'recap' });
    ok('conteo', await manager.post(`${STOCK}/count`, { partId: recap, counted: 3, unitCostCents: 20000, reason: 'Conteo inicial' }));
    const { workOrderId } = await plannedWo('968', [{ category: 'Tires & Wheels', job: 'Tires', assignee: USERS.general }]);
    const tires = namedJob(await adminWo(workOrderId), 'Tires');
    const issued = ok('sacar 2', await manager.post(`${STOCK}/issue`, { partId: recap, quantity: 2, workOrderJobId: tires.id }));
    refused('más de las que salieron', await manager.post(`${STOCK}/movements/${issued.id}/return`, { reason: 'Sobraron', quantity: 3 }), 400, 'RETURN_MORE_THAN_ISSUED');
    ok('devolver 1', await manager.post(`${STOCK}/movements/${issued.id}/return`, { reason: 'Sobró una', quantity: 1 }));
    same('vuelven a ser 2 a $200', await onHand(recap), ['2.00', 40000, 20000]);
    same('la WO paga una', (await adminWo(workOrderId)).costs?.partsCents, 20000);
    const left = namedJob(await adminWo(workOrderId), 'Tires').stockParts.filter((row: Json) => !row.returned);
    same('el Job tiene 1 sin devolver', left.map((row: Json) => [row.quantity, row.valueCents]), [['1.00', 20000]]);
    ok('devolver la otra', await manager.post(`${STOCK}/movements/${left[0].movementId}/return`, { reason: 'No hacía falta' }));
    same('vuelven las 3', (await onHand(recap))[0], '3.00');
    same('la WO no paga nada', (await adminWo(workOrderId)).costs?.partsCents, 0);
  });

  it('A121 | Una compra cuyo stock ya salió no se anula ni se corrige a menos; devuelto, sí', async () => {
    const vendorId = await vendor('TruckPro');
    const pump = await part('Pump void');
    const body = { vendorId, invoiceNumber: `V-${RUN}`, invoiceDate: '2026-10-16', lines: [{ partId: pump, quantity: 1, unitCostCents: 15000, destination: 'stock' }] };
    const purchase = ok('compra', await buy(body));
    const { workOrderId } = await plannedWo('968', [{ category: 'Fuel System', job: 'Fuel Filters', assignee: USERS.general }]);
    const job = namedJob(await adminWo(workOrderId), 'Fuel Filters');
    const issued = ok('sacar', await manager.post(`${STOCK}/issue`, { partId: pump, quantity: 1, workOrderJobId: job.id }));

    refused('anular', await manager.post(`/admin/parts-costs/purchases/${purchase.id}/void`, { reason: 'Equivocada' }), 409, 'STOCK_ALREADY_USED');
    refused('pasarla a Shop supplies', await manager.patch(`/admin/parts-costs/purchases/${purchase.id}`, { ...body, lines: [{ ...body.lines[0], destination: 'shop_supplies' }] }), 409, 'STOCK_ALREADY_USED');
    ok('corregir el precio sí', await manager.patch(`/admin/parts-costs/purchases/${purchase.id}`, { ...body, lines: [{ ...body.lines[0], unitCostCents: 16000 }] }));
    same('la compra sigue sin anular', Boolean((await prisma.partPurchase.findUniqueOrThrow({ where: { id: purchase.id } })).voidedAt), false);

    ok('devolver', await manager.post(`${STOCK}/movements/${issued.id}/return`, { reason: 'No se usó' }));
    ok('ahora sí se anula', await manager.post(`/admin/parts-costs/purchases/${purchase.id}/void`, { reason: 'Equivocada' }));
    same('el estante queda en cero', (await onHand(pump))[0], '0.00');
  });
});

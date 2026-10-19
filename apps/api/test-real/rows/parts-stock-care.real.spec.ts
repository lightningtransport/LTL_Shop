/**
 * D47 / HU-M20 (LTR-246): the Manager takes care of the stock. One Parts screen is the inventory; the stock moves
 * with three actions that each mean one thing:
 * - Count stock (in bulk): type what is on the shelf; more comes in at its cost, fewer leave at the average.
 * - Add to stock: parts that came in without an invoice, with their cost.
 * - Remove from stock: how many leave, and why (Damaged, Lost, Other).
 *
 * These rows are written before the code (docs and tests first): until LTR-246 lands, the new routes answer 404 and
 * the rows fail on purpose. The contract they pin:
 * - `POST /admin/parts-costs/stock/count-batch` `{ lines: [{ partId, counted?, unitCostCents? }], note? }` → `{ changed }`;
 *   all or nothing; a line with no `counted` or the same number is skipped; a part that goes up with no average and
 *   no reference cost and no cost typed refuses the whole count (`STOCK_COST_REQUIRED`, naming the parts).
 * - `POST /admin/parts-costs/stock/add` `{ partId, quantity, unitCostCents, note? }`.
 * - `POST /admin/parts-costs/stock/remove` `{ partId, quantity, reason: 'damaged' | 'lost' | 'other', note? }`;
 *   `other` needs a note; never more than on hand (`NOT_ENOUGH_STOCK`); no truck is charged.
 * - Movements carry `reasonCode`: `count` · `received` · `damaged` · `lost` · `other` (null for purchases and Jobs).
 * - `GET /admin/parts-costs/stock?all=true` lists every active part, also the ones that never moved (0 on hand),
 *   in-stock and Low first.
 */
import { afterAll, beforeEach, describe, it } from 'vitest';
import { Json, USERS, as, manager, ok, prisma, refused, resetDb, same } from '../harness';

const RUN = Date.now();
const STOCK = '/admin/parts-costs/stock';

async function part(name: string, extra: Json = {}) {
  const category = await prisma.partCategory.findFirstOrThrow({ where: { kind: 'repair' }, orderBy: { sortOrder: 'asc' } });
  return ok(`parte ${name}`, await manager.post('/admin/parts-costs/parts', { categoryId: category.id, displayName: `${name} ${RUN}`, ...extra })).id as string;
}

async function stock(partId: string) {
  const detail = ok('stock de la parte', await manager.get(`${STOCK}/${partId}`));
  return { item: detail.item, movements: detail.movements as Json[] };
}

async function onHand(partId: string) {
  const { item } = await stock(partId);
  return [item.onHand, item.valueCents, item.avgCostCents];
}

async function truckCharges(movementIds: string[]) {
  return prisma.truckCostEntry.count({ where: { sourceId: { in: movementIds } } });
}

async function cleanup() {
  await resetDb();
  const parts = (await prisma.part.findMany({ where: { displayName: { contains: String(RUN) } }, select: { id: true } })).map((row) => row.id);
  await prisma.stockMovement.deleteMany({ where: { partId: { in: parts }, reversesId: { not: null } } });
  await prisma.stockMovement.deleteMany({ where: { partId: { in: parts } } });
  await prisma.part.deleteMany({ where: { id: { in: parts } } });
}

describe('Manager: cuidar el stock (D47, HU-M20)', () => {
  beforeEach(resetDb);
  afterAll(cleanup);

  it('A135 | Primer día: cuenta tres partes en 0 de una vez; una sin costo frena todo hasta que se lo pone', async () => {
    const pump = await part('Pump count', { unitCostCents: 9000 });
    const belt = await part('Belt count', { unitCostCents: 2500 });
    const valve = await part('Valve count');
    const lines = [{ partId: pump, counted: 2 }, { partId: belt, counted: '4' }, { partId: valve, counted: 3 }];
    const refusedCount = refused('la válvula no tiene costo', await manager.post(`${STOCK}/count-batch`, { lines, note: 'Primer día' }), 400, 'STOCK_COST_REQUIRED');
    same('nombra la parte sin costo', JSON.stringify(refusedCount).includes(valve), true);
    same('no guardó nada', [await onHand(pump), await onHand(belt)], [['0.00', 0, null], ['0.00', 0, null]]);
    const saved = ok('con el costo de la válvula', await manager.post(`${STOCK}/count-batch`, { lines: [...lines.slice(0, 2), { partId: valve, counted: 3, unitCostCents: 4000 }], note: 'Primer día' }));
    same('tres cambiaron', saved.changed, 3);
    same('las bombas entran a su costo de referencia', await onHand(pump), ['2.00', 18000, 9000]);
    same('la válvula entra al costo escrito', await onHand(valve), ['3.00', 12000, 4000]);
    same('el motivo es Count', (await stock(belt)).movements.map((row) => [row.kind, row.reasonCode, row.quantity]), [['adjust', 'count', '4.00']]);
    for (const email of [USERS.general, USERS.pm, USERS.safety]) refused(`${email}: contar`, await as(email).post(`${STOCK}/count-batch`, { lines }), 403);
  });

  it('A136 | Cuenta 8 de una parte que tenía 10: salen 2 al promedio y ningún camión paga', async () => {
    const filter = await part('Filter count');
    ok('hay 10 a $12.50', await manager.post(`${STOCK}/add`, { partId: filter, quantity: 10, unitCostCents: 1250 }));
    const saved = ok('cuenta 8', await manager.post(`${STOCK}/count-batch`, { lines: [{ partId: filter, counted: 8 }] }));
    same('una cambió', saved.changed, 1);
    same('quedan 8 a $12.50', await onHand(filter), ['8.00', 10000, 1250]);
    const { movements } = await stock(filter);
    const out = movements.find((row) => row.reasonCode === 'count');
    same('salieron 2 por $25', [out?.quantity, out?.valueCents], ['-2.00', -2500]);
    same('ningún camión paga', await truckCharges(movements.map((row) => row.id)), 0);
  });

  it('A137 | Una fila vacía o con el mismo número no cambia nada', async () => {
    const hose = await part('Hose count');
    ok('hay 5', await manager.post(`${STOCK}/add`, { partId: hose, quantity: 5, unitCostCents: 3000 }));
    const before = (await stock(hose)).movements.length;
    const saved = ok('vacía y la misma', await manager.post(`${STOCK}/count-batch`, { lines: [{ partId: hose }, { partId: hose, counted: '' }, { partId: hose, counted: 5 }] }));
    same('nada cambió', saved.changed, 0);
    same('ningún movimiento nuevo', (await stock(hose)).movements.length, before);
  });

  it('A138 | Add to stock: llegaron 2 sin factura a $12.50; el promedio se recalcula', async () => {
    const filter = await part('Filter add');
    ok('hay 2 a $10', await manager.post(`${STOCK}/add`, { partId: filter, quantity: 2, unitCostCents: 1000 }));
    refused('sin costo no entra', await manager.post(`${STOCK}/add`, { partId: filter, quantity: 2 }), 400);
    ok('llegan 2 a $12.50', await manager.post(`${STOCK}/add`, { partId: filter, quantity: 2, unitCostCents: 1250, note: 'El proveedor mandó 2 de más' }));
    same('4 a $11.25', await onHand(filter), ['4.00', 4500, 1125]);
    same('motivo Received con su nota', (await stock(filter)).movements.filter((row) => row.valueCents === 2500).map((row) => [row.reasonCode, row.reason]), [['received', 'El proveedor mandó 2 de más']]);
    refused('el mecánico no agrega', await as(USERS.general).post(`${STOCK}/add`, { partId: filter, quantity: 1, unitCostCents: 1000 }), 403);
  });

  it('A139 | Remove from stock: salen 2 dañadas al promedio, con su motivo; ningún camión paga', async () => {
    const filter = await part('Filter remove');
    ok('hay 10 a $12.50', await manager.post(`${STOCK}/add`, { partId: filter, quantity: 10, unitCostCents: 1250 }));
    ok('salen 2 dañadas', await manager.post(`${STOCK}/remove`, { partId: filter, quantity: 2, reason: 'damaged', note: 'Caja aplastada' }));
    same('quedan 8 a $12.50', await onHand(filter), ['8.00', 10000, 1250]);
    const { movements } = await stock(filter);
    same('Damaged en Movements', movements.filter((row) => row.valueCents < 0).map((row) => [row.reasonCode, row.quantity, row.reason]), [['damaged', '-2.00', 'Caja aplastada']]);
    same('ningún camión paga', await truckCharges(movements.map((row) => row.id)), 0);
    refused('"Other" pide nota', await manager.post(`${STOCK}/remove`, { partId: filter, quantity: 1, reason: 'other' }), 400);
    ok('Lost sin nota', await manager.post(`${STOCK}/remove`, { partId: filter, quantity: 1, reason: 'lost' }));
    same('quedan 7', (await onHand(filter))[0], '7.00');
  });

  it('A140 | No se saca más de lo que hay', async () => {
    const filter = await part('Filter too many');
    ok('hay 3', await manager.post(`${STOCK}/add`, { partId: filter, quantity: 3, unitCostCents: 1250 }));
    refused('sacar 4', await manager.post(`${STOCK}/remove`, { partId: filter, quantity: 4, reason: 'lost' }), 409, 'NOT_ENOUGH_STOCK');
    same('siguen 3', (await onHand(filter))[0], '3.00');
  });

  it('A141 | Con el mínimo en 4 y 3 en stock, la parte sale Low en Parts', async () => {
    const filter = await part('Filter min');
    ok('hay 3', await manager.post(`${STOCK}/add`, { partId: filter, quantity: 3, unitCostCents: 1250 }));
    ok('mínimo 4', await manager.patch(`/admin/parts-costs/parts/${filter}`, { minStock: 4 }));
    const list = ok('Parts (inventario)', await manager.get(`${STOCK}?all=true`));
    same('sale Low', list.items.filter((item: Json) => item.partId === filter).map((item: Json) => [item.onHand, item.minStock, item.low]), [['3.00', 4, true]]);
  });

  it('A142 | Una parte nueva sale en Parts con 0 en stock, sin moverse; lo que hay sale primero', async () => {
    const stocked = await part('Wiper stocked');
    ok('hay 1', await manager.post(`${STOCK}/add`, { partId: stocked, quantity: 1, unitCostCents: 900 }));
    const fresh = await part('Wiper new');
    const list = ok('Parts (inventario)', await manager.get(`${STOCK}?all=true`));
    const ids = list.items.map((item: Json) => item.partId);
    same('la nueva está, con 0', list.items.filter((item: Json) => item.partId === fresh).map((item: Json) => [item.onHand, item.low]), [['0.00', false]]);
    same('la que tiene stock va antes', ids.indexOf(stocked) < ids.indexOf(fresh), true);
  });
});

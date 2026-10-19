/**
 * LTR-201 / D34 (LB-1): the shop's labor rate. A completed Work Order writes its labor (hours of closed sessions ×
 * the rate of each day) to the truck's costs; a new rate, a reopen or a cancel corrects it with reversals.
 * Rates are shop-wide, so every row removes the rates it adds; ledger rows are read by this Work Order only.
 */
import { afterEach, beforeEach, describe, it } from 'vitest';
import { laborAmount } from '@ltl-shop/shared';
import {
  Json, USERS, adminCompleteJob, adminWo, as, closeWo, doPm, laneJob, manager, meta, ok, plannedWo, prisma, refused, resetDb, same, truthy,
} from '../harness';

const today = () => new Date().toISOString().slice(0, 10);
/**
 * LTR-249: the work in `completedWo` starts 3 h ago, and a rate applies from the day the work started. Between
 * 00:00 and 03:00 UTC that is yesterday's UTC date, so the rates these rows set "from today" start that day, and the
 * cost ranges go from that day to today.
 */
const workDay = () => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Rates are shop-wide and labor rows would show in other rows' truck costs: both go after each row. */
async function clearRates() {
  // A77 sends an internal invoice with labor on it; its lines point at labor rows, so it goes first.
  await prisma.internalInvoice.deleteMany({ where: { lines: { some: { costEntry: { sourceType: 'work_order_labor' } } } } });
  await prisma.laborRate.deleteMany({});
  await prisma.truckCostEntry.deleteMany({ where: { sourceType: 'work_order_labor', reversesEntryId: { not: null } } });
  await prisma.truckCostEntry.deleteMany({ where: { sourceType: 'work_order_labor' } });
}

async function setRate(rateCentsPerHour: number, effectiveFrom: string) {
  return ok(`tarifa ${rateCentsPerHour} desde ${effectiveFrom}`, await manager.post('/admin/parts-costs/labor-rates', { rateCentsPerHour, effectiveFrom }));
}

/** A Work Order on the truck, with 2 h of closed work, finished and closed by the Manager (as A13b). */
async function completedWo(truckNumber: string) {
  const { truck, workOrderId } = await plannedWo(truckNumber);
  await doPm(workOrderId, truck.id);
  const start = new Date(Date.now() - 3 * 60 * 60 * 1000);
  await prisma.workSession.create({ data: { workOrderId, startedAt: start, endedAt: new Date(start.getTime() + 2 * 60 * 60 * 1000), userId: null } });
  for (const lane of ['alignment', 'detailing', 'quality_check'] as const) {
    ok(`Manager completa ${lane}`, await adminCompleteJob(workOrderId, laneJob(await adminWo(workOrderId), lane).id));
  }
  ok('Close Work Order', await closeWo(workOrderId));
  return { truck, workOrderId };
}

async function labor(workOrderId: string) {
  const rows = await prisma.truckCostEntry.findMany({ where: { sourceType: 'work_order_labor', sourceId: workOrderId }, orderBy: { createdAt: 'asc' } });
  return { rows, net: rows.reduce((sum, row) => sum + row.amountCents, 0) };
}

async function expectedCents(workOrderId: string, rateCentsPerHour: number) {
  const sessions = await prisma.workSession.findMany({ where: { workOrderId, endedAt: { not: null } } });
  return laborAmount(sessions.map((item) => ({ startedAt: item.startedAt, endedAt: item.endedAt! })), [{ rateCentsPerHour, effectiveFrom: '2000-01-01' }]).amountCents;
}

describe('Manager: tarifa de mano de obra (D34, LB-1)', () => {
  beforeEach(async () => { await resetDb(); await clearRates(); });
  afterEach(clearRates);

  it('A69 | Al completar un WO, su mano de obra (horas × tarifa) entra al costo del camión con su WO', async () => {
    await setRate(9500, '2020-01-01');
    const { truck, workOrderId } = await completedWo('931');
    const expected = await expectedCents(workOrderId, 9500);
    truthy('hay al menos 2 h de trabajo', expected >= 19000, expected);
    const { rows } = await labor(workOrderId);
    same('una fila de mano de obra con su WO', rows.map((row) => [row.kind, row.amountCents, row.workOrderId, row.truckId]), [['labor', expected, workOrderId, truck.id]]);
    const costs = ok('costos del camión', await manager.get(`/admin/parts-costs/trucks/${truck.id}/costs?from=${workDay()}&to=${today()}`));
    same('Costs suma la mano de obra', [costs.laborRateSet, costs.totals.laborCents >= expected], [true, true]);
    // PCA10: the Work Order itself says what it has cost so far (Manager only; a mechanic gets no costs).
    same('la WO dice su mano de obra', (await adminWo(workOrderId)).costs?.laborCents, expected);
    truthy('el movimiento dice el WO y las horas', (costs.entries as Array<{ kind: string; description: string }>).some((entry) => entry.kind === 'labor' && entry.description.includes('h ×')));
  });

  it('A70 | Una tarifa nueva recalcula con reversas; reabrir el WO la saca y volver a cerrarlo la pone', async () => {
    await setRate(9500, '2020-01-01');
    const { workOrderId } = await completedWo('905');
    const at9500 = await expectedCents(workOrderId, 9500);
    const changed = await setRate(12000, workDay());
    truthy('recalcula los WO afectados', changed.recalculatedWorkOrders >= 1, changed);
    let state = await labor(workOrderId);
    same('reversa + fila nueva con la tarifa de hoy', [state.rows.length, state.net], [3, await expectedCents(workOrderId, 12000)]);
    truthy('la fila original no cambió', state.rows[0].amountCents === at9500);
    refused('otra tarifa el mismo día', await manager.post('/admin/parts-costs/labor-rates', { rateCentsPerHour: 1, effectiveFrom: workDay() }), 409, 'LABOR_RATE_DATE_TAKEN');

    ok('reabrir', await manager.post(`/admin/work-orders/${workOrderId}/reopen`, { ...(await meta(workOrderId)), reason: 'Falta un ajuste' }));
    state = await labor(workOrderId);
    same('reabierto: la mano de obra sale', state.net, 0);
    ok('cerrar otra vez', await closeWo(workOrderId));
    state = await labor(workOrderId);
    same('cerrado: vuelve', state.net, await expectedCents(workOrderId, 12000));
  });

  it('A77 | Antes de guardar, la tarifa dice cuántos WOs recalcula; la última se puede quitar mientras nada facturado la use (PCA7)', async () => {
    await setRate(9500, '2020-01-01');
    const { truck, workOrderId } = await completedWo('931');
    const before = (await labor(workOrderId)).net;

    const preview = ok('vista previa', await manager.get(`/admin/parts-costs/labor-rates/preview?effectiveFrom=${workDay()}`));
    same('dice que recalcula este WO y que nada está facturado', [preview.workOrders >= 1, preview.invoiced], [true, 0]);

    const wrong = await setRate(15000, workDay());
    same('la tarifa equivocada recalculó el WO', (await labor(workOrderId)).net, await expectedCents(workOrderId, 15000));
    const listed = ok('tarifas', await manager.get('/admin/parts-costs/labor-rates'));
    same('solo la última se puede quitar', (listed.rates as Json[]).map((rate) => [rate.rateCentsPerHour, rate.deletable]), [[15000, true], [9500, false]]);
    refused('la anterior no se quita', await manager.del(`/admin/parts-costs/labor-rates/${(listed.rates as Json[])[1].id}`), 409, 'LABOR_RATE_NOT_LATEST');

    const removed = ok('quitar la equivocada', await manager.del(`/admin/parts-costs/labor-rates/${wrong.id}`));
    same('vuelve a la tarifa anterior, con reversas', [(await labor(workOrderId)).net, removed.recalculatedWorkOrders >= 1], [before, true]);

    // Con la mano de obra en una factura enviada, la tarifa ya no se quita.
    const again = await setRate(12000, workDay());
    const month = today().slice(0, 7);
    const invoiceId = ok('borrador', await manager.post('/admin/parts-costs/internal-invoices', { truckId: truck.id, month })).id;
    ok('enviar', await manager.post(`/admin/parts-costs/internal-invoices/${invoiceId}/send`, {}));
    const after = ok('vista previa con factura', await manager.get(`/admin/parts-costs/labor-rates/preview?effectiveFrom=${workDay()}`));
    same('la vista previa avisa que hay WOs facturados', after.invoiced >= 1, true);
    refused('no se quita una tarifa ya facturada', await manager.del(`/admin/parts-costs/labor-rates/${again.id}`), 409, 'LABOR_RATE_IN_USE');
    same('la lista tampoco la ofrece', ((ok('tarifas', await manager.get('/admin/parts-costs/labor-rates')).rates as Json[])[0]).deletable, false);
    await prisma.internalInvoice.deleteMany({ where: { truckId: truck.id } });
  });

  it('A71 | Sin tarifa no hay monto (solo horas); mecánicos y Safety no ven ni cambian la tarifa', async () => {
    const { truck, workOrderId } = await completedWo('922');
    same('sin tarifa no escribe mano de obra', (await labor(workOrderId)).rows.length, 0);
    const costs = ok('costos', await manager.get(`/admin/parts-costs/trucks/${truck.id}/costs?from=${workDay()}&to=${today()}`));
    same('Costs dice que falta la tarifa y muestra las horas', [costs.laborRateSet, costs.laborHours > 0, costs.totals.laborCents], [false, true, 0]);
    same('la lista de tarifas está vacía', ok('tarifas', await manager.get('/admin/parts-costs/labor-rates')).current, null);
    for (const email of [USERS.general, USERS.pm, USERS.safety]) {
      refused(`${email}: ver`, await as(email).get('/admin/parts-costs/labor-rates'), 403);
      refused(`${email}: cambiar`, await as(email).post('/admin/parts-costs/labor-rates', { rateCentsPerHour: 1, effectiveFrom: today() }), 403);
    }
  });
});

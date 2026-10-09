/**
 * LTR-201 / D34 (LB-1): the shop's labor rate. A completed Work Order writes its labor (hours of closed sessions ×
 * the rate of each day) to the truck's costs; a new rate, a reopen or a cancel corrects it with reversals.
 * Rates are shop-wide, so every row removes the rates it adds; ledger rows are read by this Work Order only.
 */
import { afterEach, beforeEach, describe, it } from 'vitest';
import { laborAmount } from '@ltl-shop/shared';
import {
  USERS, adminCompleteJob, adminWo, as, closeWo, doPm, laneJob, manager, meta, ok, plannedWo, prisma, refused, resetDb, same, truthy,
} from '../harness';

const today = () => new Date().toISOString().slice(0, 10);

/** Rates are shop-wide and labor rows would show in other rows' truck costs: both go after each row. */
async function clearRates() {
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
    const costs = ok('costos del camión', await manager.get(`/admin/parts-costs/trucks/${truck.id}/costs?from=${today()}&to=${today()}`));
    same('Costs suma la mano de obra', [costs.laborRateSet, costs.totals.laborCents >= expected], [true, true]);
    truthy('el movimiento dice el WO y las horas', (costs.entries as Array<{ kind: string; description: string }>).some((entry) => entry.kind === 'labor' && entry.description.includes('h ×')));
  });

  it('A70 | Una tarifa nueva recalcula con reversas; reabrir el WO la saca y volver a cerrarlo la pone', async () => {
    await setRate(9500, '2020-01-01');
    const { workOrderId } = await completedWo('905');
    const at9500 = await expectedCents(workOrderId, 9500);
    const changed = await setRate(12000, today());
    truthy('recalcula los WO afectados', changed.recalculatedWorkOrders >= 1, changed);
    let state = await labor(workOrderId);
    same('reversa + fila nueva con la tarifa de hoy', [state.rows.length, state.net], [3, await expectedCents(workOrderId, 12000)]);
    truthy('la fila original no cambió', state.rows[0].amountCents === at9500);
    refused('otra tarifa el mismo día', await manager.post('/admin/parts-costs/labor-rates', { rateCentsPerHour: 1, effectiveFrom: today() }), 409, 'LABOR_RATE_DATE_TAKEN');

    ok('reabrir', await manager.post(`/admin/work-orders/${workOrderId}/reopen`, { ...(await meta(workOrderId)), reason: 'Falta un ajuste' }));
    state = await labor(workOrderId);
    same('reabierto: la mano de obra sale', state.net, 0);
    ok('cerrar otra vez', await closeWo(workOrderId));
    state = await labor(workOrderId);
    same('cerrado: vuelve', state.net, await expectedCents(workOrderId, 12000));
  });

  it('A71 | Sin tarifa no hay monto (solo horas); mecánicos y Safety no ven ni cambian la tarifa', async () => {
    const { truck, workOrderId } = await completedWo('922');
    same('sin tarifa no escribe mano de obra', (await labor(workOrderId)).rows.length, 0);
    const costs = ok('costos', await manager.get(`/admin/parts-costs/trucks/${truck.id}/costs?from=${today()}&to=${today()}`));
    same('Costs dice que falta la tarifa y muestra las horas', [costs.laborRateSet, costs.laborHours > 0, costs.totals.laborCents], [false, true, 0]);
    same('la lista de tarifas está vacía', ok('tarifas', await manager.get('/admin/parts-costs/labor-rates')).current, null);
    for (const email of [USERS.general, USERS.pm, USERS.safety]) {
      refused(`${email}: ver`, await as(email).get('/admin/parts-costs/labor-rates'), 403);
      refused(`${email}: cambiar`, await as(email).post('/admin/parts-costs/labor-rates', { rateCentsPerHour: 1, effectiveFrom: today() }), 403);
    }
  });
});

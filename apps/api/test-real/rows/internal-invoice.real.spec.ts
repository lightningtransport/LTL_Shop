/**
 * LTR-201 / D34 (LB-2): the internal invoice to Finance, per truck and month. It takes what the truck's ledger has
 * uncharged up to the end of the month; lines can come off (they wait for the next one); once sent it never changes
 * and a later correction lands on the next invoice; void frees its lines. Uses Truck 986 only and removes its rows.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { Json, USERS, as, manager, ok, prisma, refused, same, truck, truthy } from '../harness';

const RUN = Date.now();
const INVOICES = '/admin/parts-costs/internal-invoices';
let truckId = '';
let vendorId = '';

async function cleanTruck() {
  await prisma.internalInvoice.deleteMany({ where: { truckId } });
  const purchases = await prisma.partPurchase.findMany({ where: { vendorId }, select: { id: true } });
  const repairs = await prisma.outsideRepair.findMany({ where: { vendorId }, select: { id: true } });
  const sources = [...purchases, ...repairs].map((row) => row.id);
  await prisma.truckCostEntry.deleteMany({ where: { sourceId: { in: sources }, reversesEntryId: { not: null } } });
  await prisma.truckCostEntry.deleteMany({ where: { sourceId: { in: sources } } });
  await prisma.outsideRepair.deleteMany({ where: { vendorId } });
  await prisma.partPurchase.deleteMany({ where: { vendorId } });
}

async function purchase(invoiceNumber: string, invoiceDate: string, cents: number) {
  return ok(`compra ${invoiceNumber}`, await manager.post('/admin/parts-costs/purchases', {
    vendorId, invoiceNumber: `${invoiceNumber}-${RUN}`, invoiceDate, lines: [{ description: `Part ${invoiceNumber}`, quantity: 1, unitCostCents: cents, truckId }],
  }, { 'Idempotency-Key': randomUUID() })).id as string;
}

async function repair(invoiceNumber: string, invoiceDate: string, cents: number) {
  return ok(`reparación ${invoiceNumber}`, await manager.post('/admin/parts-costs/outside-repairs', {
    truckId, vendorId, invoiceNumber: `${invoiceNumber}-${RUN}`, invoiceDate, description: `Repair ${invoiceNumber}`, amountCents: cents,
  }, { 'Idempotency-Key': randomUUID() })).id as string;
}

async function draft(month: string) {
  return ok(`borrador ${month}`, await manager.post(INVOICES, { truckId, month })).id as string;
}

const detail = async (id: string) => ok('detalle', await manager.get(`${INVOICES}/${id}`));
const amounts = (invoice: Json) => (invoice.lines as Json[]).map((line) => line.amountCents).sort((left, right) => left - right);

describe('Manager: factura interna a Finanzas (D34, LB-2)', () => {
  beforeEach(async () => {
    truckId = (await truck('986')).id;
    vendorId ||= ok('proveedor', await manager.post('/admin/parts-costs/vendors', { name: `Invoices ${RUN}`, doesParts: true, doesRepairs: true })).id;
    await cleanTruck();
  });
  afterAll(async () => {
    await cleanTruck();
    await prisma.vendor.deleteMany({ where: { id: vendorId } });
  });

  it('A72 | El borrador trae lo no cobrado del camión hasta fin de mes, con subtotales; cada movimiento se cobra una vez', async () => {
    await purchase('P1', '2026-09-10', 5000);
    await repair('R1', '2026-10-05', 10000);
    await repair('R2', '2026-11-02', 7000);
    const id = await draft('2026-10');
    let invoice = await detail(id);
    same('septiembre (sin cobrar) y octubre; noviembre no', amounts(invoice), [5000, 10000]);
    same('subtotales y total', [invoice.subtotals.partsCents, invoice.subtotals.outsideCents, invoice.totalCents, invoice.status, invoice.number], [5000, 10000, 15000, 'draft', null]);
    refused('otro borrador del mismo mes', await manager.post(INVOICES, { truckId, month: '2026-10' }), 409, 'INTERNAL_INVOICE_DRAFT_EXISTS');

    await purchase('P2', '2026-10-20', 1500);
    same('el borrador avisa que hay algo nuevo', (await detail(id)).availableCount, 1);
    ok('traer lo nuevo', await manager.post(`${INVOICES}/${id}/refresh`));
    invoice = await detail(id);
    same('ahora con la compra nueva', invoice.totalCents, 16500);
  });

  it('A73 | Una línea que se saca queda sin cobrar: no vuelve al traer lo nuevo y entra en la factura siguiente', async () => {
    await purchase('P3', '2026-10-01', 2000);
    await repair('R3', '2026-10-09', 30000);
    const id = await draft('2026-10');
    const line = ((await detail(id)).lines as Json[]).find((item) => item.amountCents === 30000);
    ok('sacar la reparación', await manager.post(`${INVOICES}/${id}/lines/${line.id}/remove`));
    let invoice = await detail(id);
    same('baja el total y queda como sacada', [invoice.totalCents, invoice.removedLines.length], [2000, 1]);
    ok('traer lo nuevo', await manager.post(`${INVOICES}/${id}/refresh`));
    same('no vuelve sola', (await detail(id)).totalCents, 2000);
    ok('enviar', await manager.post(`${INVOICES}/${id}/send`));
    const next = await draft('2026-11');
    invoice = await detail(next);
    same('la factura siguiente la trae', amounts(invoice), [30000]);
  });

  it('A74 | Enviada: número SHOP, congelada; una corrección posterior cae en la siguiente; Finanzas la acepta', async () => {
    const purchaseId = await purchase('P4', '2026-10-03', 8000);
    const id = await draft('2026-10');
    const sent = ok('enviar', await manager.post(`${INVOICES}/${id}/send`));
    truthy('número SHOP-AAAA-NNNN', /^SHOP-\d{4}-\d{4}$/.test(sent.number), sent.number);
    refused('enviada no cambia', await manager.post(`${INVOICES}/${id}/refresh`), 409, 'INVOICE_NOT_DRAFT');
    refused('enviada no se borra', await manager.del(`${INVOICES}/${id}`), 409, 'INVOICE_NOT_DRAFT');

    ok('anular la compra ya cobrada', await manager.post(`/admin/parts-costs/purchases/${purchaseId}/void`, { reason: 'Era de otro camión' }));
    same('la enviada no cambió', (await detail(id)).totalCents, 8000);
    const next = await draft('2026-11');
    same('la reversa entra en la siguiente, en negativo', amounts(await detail(next)), [-8000]);

    ok('Finanzas la aceptó', await manager.post(`${INVOICES}/${id}/accept`));
    same('aceptada', (await detail(id)).status, 'accepted');
    refused('aceptar otra vez', await manager.post(`${INVOICES}/${id}/accept`), 409, 'INVOICE_NOT_SENT');
  });

  it('A78 | La compra, la reparación y los movimientos dicen en qué factura se cobraron; la corrección de algo facturado dice de cuál viene (PCA4)', async () => {
    const purchaseId = await purchase('CH1', '2026-10-03', 10000);
    const repairId = await repair('CH2', '2026-10-04', 5000);
    same('sin factura: nada cobrado', [ok('compra', await manager.get(`/admin/parts-costs/purchases/${purchaseId}`)).chargedOn, ok('reparación', await manager.get(`/admin/parts-costs/outside-repairs/${repairId}`)).chargedOn], [[], []]);

    const first = await draft('2026-10');
    same('en borrador: la compra lo dice', (ok('compra', await manager.get(`/admin/parts-costs/purchases/${purchaseId}`)).chargedOn as Json[]).map((row) => [row.id, row.status]), [[first, 'draft']]);
    const sent = ok('enviar', await manager.post(`${INVOICES}/${first}/send`, {}));
    same('enviada: compra y reparación la nombran', [
      (ok('compra', await manager.get(`/admin/parts-costs/purchases/${purchaseId}`)).chargedOn as Json[]).map((row) => [row.number, row.status]),
      (ok('reparación', await manager.get(`/admin/parts-costs/outside-repairs/${repairId}`)).chargedOn as Json[]).map((row) => [row.number, row.status]),
    ], [[[sent.number, 'sent']], [[sent.number, 'sent']]]);
    const costs = ok('costos', await manager.get(`/admin/parts-costs/trucks/${truckId}/costs?from=2026-10-01&to=2026-10-31`));
    same('cada movimiento sabe en qué factura está', (costs.entries as Json[]).map((entry) => entry.chargedOn?.number), [sent.number, sent.number]);

    // Corregir la compra ya facturada: la siguiente factura trae el crédito y dice de qué factura viene.
    ok('corregir el monto', await manager.patch(`/admin/parts-costs/purchases/${purchaseId}`, {
      vendorId, invoiceNumber: `CH1-${RUN}`, invoiceDate: '2026-10-03', lines: [{ description: 'Part CH1', quantity: 1, unitCostCents: 12000, truckId }],
    }));
    const second = await detail(await draft('2026-11'));
    const credit = (second.lines as Json[]).find((line) => line.amountCents === -10000);
    same('el crédito dice de qué factura viene', credit?.correctsInvoice?.number, sent.number);
    same('el cargo nuevo no corrige nada', (second.lines as Json[]).find((line) => line.amountCents === 12000)?.correctsInvoice, null);
  });

  it('A75 | Anular una enviada libera sus movimientos; el número no se reusa; mecánicos y Safety no entran', async () => {
    await repair('R5', '2026-10-12', 12000);
    const first = await draft('2026-10');
    const firstNumber = ok('enviar', await manager.post(`${INVOICES}/${first}/send`)).number as string;
    refused('anular pide motivo', await manager.post(`${INVOICES}/${first}/void`, {}), 400);
    ok('anular', await manager.post(`${INVOICES}/${first}/void`, { reason: 'Monto equivocado' }));
    const again = await draft('2026-10');
    same('los movimientos vuelven a estar disponibles', amounts(await detail(again)), [12000]);
    const secondNumber = ok('enviar la nueva', await manager.post(`${INVOICES}/${again}/send`)).number as string;
    truthy('otro número', secondNumber !== firstNumber && secondNumber > firstNumber, [firstNumber, secondNumber]);
    refused('un mes sin nada que cobrar', await manager.post(INVOICES, { truckId, month: '2026-12' }), 400, 'NOTHING_TO_CHARGE');
    for (const email of [USERS.general, USERS.pm, USERS.safety]) {
      refused(`${email}: facturas`, await as(email).get(INVOICES), 403);
      refused(`${email}: crear`, await as(email).post(INVOICES, { truckId, month: '2026-10' }), 403);
    }
  });
});

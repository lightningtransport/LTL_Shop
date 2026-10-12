/**
 * LTR-200 / D32 (PC-3): the Manager loads an outside shop's invoice for a truck and ties it to the Job sent out
 * (D24). Sending out and "Returned" work as before; the invoice keeps the Job. One vendor + invoice number among
 * purchases and outside repairs. Outside repairs are not Work Orders, so every row works with its own vendor.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { Json, USERS, adminWo, as, laneJob, manager, meta, namedJob, ok, plannedWo, prisma, refused, resetDb, same, truck, truthy, userId } from '../harness';

const RUN = Date.now();
const REPAIRS = '/admin/parts-costs/outside-repairs';

async function vendor(tag: string) {
  return ok(`proveedor ${tag}`, await manager.post('/admin/parts-costs/vendors', { name: `${tag} ${RUN}`, doesParts: true, doesRepairs: true })).id as string;
}

function saveRepair(body: Json, key: string = randomUUID()) {
  return manager.post(REPAIRS, body, { 'Idempotency-Key': key });
}

async function sendOut(workOrderId: string, jobId: string, kind: 'part' | 'truck') {
  return manager.post(`/admin/work-orders/${workOrderId}/jobs/${jobId}/external`, { ...(await meta(workOrderId)), kind, note: 'Va al taller de radiadores; vuelve el viernes.' });
}

async function returned(workOrderId: string, jobId: string) {
  return manager.post(`/admin/work-orders/${workOrderId}/jobs/${jobId}/external/return`, { ...(await meta(workOrderId)), outcome: 'assign', mechanicId: await userId(USERS.general) });
}

async function ledger(repairId: string) {
  return prisma.truckCostEntry.findMany({ where: { sourceType: 'outside_repair', sourceId: repairId }, orderBy: { createdAt: 'asc' } });
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

describe('Manager: reparaciones externas con su factura (D32, PC-3)', () => {
  beforeEach(resetDb);
  afterAll(cleanup);

  it('A63 | La factura se liga al Job enviado afuera y va al camión; el Job lo muestra; un Job de otro camión no', async () => {
    const vendorId = await vendor('Diesel Pro');
    const { truck: t968, workOrderId } = await plannedWo('968', [{ category: 'Air & Brake System', job: 'Air Dryer', assignee: USERS.general }]);
    const job = namedJob(await adminWo(workOrderId), 'Air Dryer');
    ok('enviar a taller externo: sale la pieza', await sendOut(workOrderId, job.id, 'part'));

    const offered = ok('Jobs para ligar', await manager.get(`/admin/parts-costs/external-jobs?truckId=${t968.id}`)) as Json[];
    same('ofrece el Job afuera, con qué salió', offered.map((item) => [item.jobId, item.out, item.kind]), [[job.id, true, 'part']]);

    const other = await plannedWo('905', [{ category: 'Air & Brake System', job: 'Air Dryer', assignee: USERS.general }]);
    const otherJob = namedJob(await adminWo(other.workOrderId), 'Air Dryer');
    const base = { truckId: t968.id, vendorId, invoiceNumber: `R-${RUN}`, invoiceDate: '2026-10-08', description: 'Radiator recore', amountCents: 184000 };
    refused('un Job de otro camión', await saveRepair({ ...base, workOrderJobId: otherJob.id }), 400, 'JOB_NOT_ON_TRUCK');
    refused('un Job que nunca salió', await saveRepair({ ...base, workOrderJobId: laneJob(await adminWo(workOrderId), 'detailing').id }), 400, 'JOB_NEVER_EXTERNAL');

    const saved = ok('guardar ligada al Job', await saveRepair({ ...base, workOrderJobId: job.id }));
    const detail = ok('detalle', await manager.get(`${REPAIRS}/${saved.id}`));
    same('ligada al Job y su WO', [detail.job?.id, detail.job?.workOrderId, detail.job?.kind], [job.id, workOrderId, 'part']);
    const rows = await ledger(saved.id);
    same('una fila en el 968 con el WO', rows.map((row) => [row.truckId, row.amountCents, row.workOrderId, row.kind]), [[t968.id, 184000, workOrderId, 'outside_repair']]);
    const wo = await adminWo(workOrderId);
    same('el Job muestra la factura al Manager', namedJob(wo, 'Air Dryer').outsideInvoices, [{ id: saved.id, amountCents: 184000, vendorName: `Diesel Pro ${RUN}` }]);
  });

  it('A64 | Enviar a taller externo y Regresó siguen igual, con la factura cargada antes o después', async () => {
    const vendorId = await vendor('Body Shop');
    const { truck: t922, workOrderId } = await plannedWo('922', [
      { category: 'Air & Brake System', job: 'Air Dryer', assignee: USERS.general },
      { category: 'Electrical & Starting', job: 'Battery', assignee: USERS.general },
    ]);
    let wo = await adminWo(workOrderId);
    const radiator = namedJob(wo, 'Air Dryer');
    const battery = namedJob(wo, 'Battery');

    // Factura cargada mientras está afuera, después Regresó.
    ok('sale el camión', await sendOut(workOrderId, radiator.id, 'truck'));
    const first = ok('factura con el Job afuera', await saveRepair({ truckId: t922.id, vendorId, invoiceNumber: `B1-${RUN}`, invoiceDate: '2026-10-07', description: 'Hood', amountCents: 50000, workOrderJobId: radiator.id }));
    ok('Regresó → asignar', await returned(workOrderId, radiator.id));
    wo = await adminWo(workOrderId);
    same('de vuelta: con dueño y ya no externo', [namedJob(wo, 'Air Dryer').assignedMechanic?.id, namedJob(wo, 'Air Dryer').external], [await userId(USERS.general), null]);
    same('la factura sigue ligada', ok('detalle', await manager.get(`${REPAIRS}/${first.id}`)).job?.id, radiator.id);

    // Regresó sin factura, y la factura llega después: el Job sale entre los de los últimos 90 días.
    ok('sale la pieza', await sendOut(workOrderId, battery.id, 'part'));
    ok('Regresó sin factura', await returned(workOrderId, battery.id));
    const offered = ok('Jobs para ligar', await manager.get(`/admin/parts-costs/external-jobs?truckId=${t922.id}`)) as Json[];
    const back = offered.find((item) => item.jobId === battery.id);
    same('el Job que ya volvió se ofrece, con su regreso', [back?.out, back?.kind, Boolean(back?.returnedAt)], [false, 'part', true]);
    ok('factura después de Regresó', await saveRepair({ truckId: t922.id, vendorId, invoiceNumber: `B2-${RUN}`, invoiceDate: '2026-10-08', description: 'Battery test', amountCents: 4500, workOrderJobId: battery.id }));
    same('el Job no cambió de estado', namedJob(await adminWo(workOrderId), 'Battery').status, 'to_do');
  });

  it('A76 | El Job que volvió sin factura se sigue ofreciendo meses después, y la WO lo marca hasta que la tenga (PCA3)', async () => {
    const vendorId = await vendor('Late Shop');
    const { truck: t931, workOrderId } = await plannedWo('931', [{ category: 'Air & Brake System', job: 'Air Dryer', assignee: USERS.general }]);
    const job = namedJob(await adminWo(workOrderId), 'Air Dryer');
    ok('sale la pieza', await sendOut(workOrderId, job.id, 'part'));
    ok('Regresó sin factura', await returned(workOrderId, job.id));
    // La factura llega cuatro meses después: el rastro del Activity Log queda viejo.
    await prisma.activityLog.updateMany({ where: { entityType: 'work_order_job', entityId: job.id }, data: { createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000) } });

    const offered = ok('Jobs para ligar', await manager.get(`/admin/parts-costs/external-jobs?truckId=${t931.id}`)) as Json[];
    const back = offered.find((item) => item.jobId === job.id);
    same('el Job se ofrece sin ventana de tiempo, ya de regreso', [back?.out, back?.kind], [false, 'part']);
    const before = namedJob(await adminWo(workOrderId), 'Air Dryer');
    same('la WO dice que salió, que volvió y que no tiene factura', [before.wentExternal, before.external, (before.outsideInvoices as Json[] | undefined)?.length ?? 0], [true, null, 0]);

    ok('la factura entra ligada al Job', await saveRepair({ truckId: t931.id, vendorId, invoiceNumber: `L1-${RUN}`, invoiceDate: '2026-10-09', description: 'Air dryer rebuild', amountCents: 90000, workOrderJobId: job.id }));
    const after = namedJob(await adminWo(workOrderId), 'Air Dryer');
    same('la WO ya muestra la factura y sigue diciendo que salió', [after.wentExternal, (after.outsideInvoices as Json[]).length], [true, 1]);
  });

  it('A65 | Factura repetida entre compra y reparación; corregir y anular con reversas; mecánicos y Safety no entran', async () => {
    const vendorId = await vendor('TruckPro');
    const t905 = await truck('905');
    const t931 = await truck('931');
    ok('una compra', await manager.post('/admin/parts-costs/purchases', {
      vendorId, invoiceNumber: 'INV 7001', invoiceDate: '2026-10-01', lines: [{ description: 'Mud flaps', quantity: 1, unitCostCents: 3000 }],
    }, { 'Idempotency-Key': randomUUID() }));
    const base = { truckId: t905.id, vendorId, invoiceNumber: 'inv-7001', invoiceDate: '2026-10-02', description: 'Welding', amountCents: 12000 };
    const clash = await saveRepair(base);
    refused('la misma factura que una compra', clash, 409, 'DUPLICATE_INVOICE');
    same('dice que es una compra', clash.json.kind, 'part_purchase');
    const check = ok('aviso al salir del campo', await manager.get(`/admin/parts-costs/invoices/check?vendorId=${vendorId}&number=INV7001`));
    same('el aviso también', check.kind, 'part_purchase');

    const saved = ok('otro número', await saveRepair({ ...base, invoiceNumber: `W-${RUN}` }));
    refused('una compra con el número de la reparación', await manager.post('/admin/parts-costs/purchases', {
      vendorId, invoiceNumber: `w ${RUN}`, invoiceDate: '2026-10-03', lines: [{ description: 'x', quantity: 1, unitCostCents: 1 }],
    }, { 'Idempotency-Key': randomUUID() }), 409, 'DUPLICATE_INVOICE');

    ok('corregir: otro camión y monto', await manager.patch(`${REPAIRS}/${saved.id}`, { ...base, invoiceNumber: `W-${RUN}`, truckId: t931.id, amountCents: 15000 }));
    let rows = await ledger(saved.id);
    const sum = (truckId: string) => rows.filter((row) => row.truckId === truckId).reduce((total, row) => total + row.amountCents, 0);
    same('reversa + fila nueva', [rows.length, sum(t905.id), sum(t931.id)], [3, 0, 15000]);
    refused('anular pide motivo', await manager.post(`${REPAIRS}/${saved.id}/void`, {}), 400);
    ok('anular', await manager.post(`${REPAIRS}/${saved.id}/void`, { reason: 'Factura de otro cliente' }));
    rows = await ledger(saved.id);
    same('todo en 0', [rows.length, sum(t931.id)], [4, 0]);
    refused('una anulada no se corrige', await manager.patch(`${REPAIRS}/${saved.id}`, { ...base, invoiceNumber: `W-${RUN}` }), 409, 'REPAIR_VOIDED');
    const list = ok('lista', await manager.get(`${REPAIRS}?vendorId=${vendorId}`));
    same('anulada en la lista, sin sumar', [list.items[0].voidedAt !== null, list.totals.totalCents], [true, 0]);

    for (const email of [USERS.general, USERS.pm, USERS.safety]) {
      refused(`${email}: reparaciones`, await as(email).get(REPAIRS), 403);
      refused(`${email}: Jobs afuera`, await as(email).get(`/admin/parts-costs/external-jobs?truckId=${t905.id}`), 403);
    }
  });
});

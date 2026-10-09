/**
 * LTR-200 / D32 (PC-2): the Manager loads parts invoices. The API computes the totals, refuses a repeated invoice
 * and a second send, and writes each truck's share in the Truck cost ledger, which is only ever added to.
 * Purchases are not Work Orders, so `resetDb` keeps them: every row works with its own vendor.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, describe, it } from 'vitest';
import { Json, USERS, as, manager, ok, prisma, refused, same, truck, truthy } from '../harness';

const RUN = Date.now();
const PURCHASES = '/admin/parts-costs/purchases';

async function vendor(tag: string) {
  return ok(`proveedor ${tag}`, await manager.post('/admin/parts-costs/vendors', { name: `${tag} ${RUN}` })).id as string;
}

async function fuelFilter() {
  return prisma.part.findFirstOrThrow({ where: { active: true, category: { name: 'Fuel Filter' } }, orderBy: { displayName: 'asc' } });
}

function save(body: Json, key: string = randomUUID()) {
  return manager.post(PURCHASES, body, { 'Idempotency-Key': key });
}

/** What the ledger says each truck got from this purchase (live rows plus reversals). */
async function ledger(purchaseId: string) {
  const rows = await prisma.truckCostEntry.findMany({ where: { sourceType: 'part_purchase', sourceId: purchaseId }, orderBy: { createdAt: 'asc' } });
  const byTruck = new Map<string, number>();
  for (const row of rows) byTruck.set(row.truckId, (byTruck.get(row.truckId) ?? 0) + row.amountCents);
  return { rows, byTruck };
}

async function cleanup() {
  const vendors = await prisma.vendor.findMany({ where: { name: { contains: String(RUN) } }, select: { id: true } });
  const purchases = await prisma.partPurchase.findMany({ where: { vendorId: { in: vendors.map((row) => row.id) } }, select: { id: true } });
  const ids = purchases.map((row) => row.id);
  const entries = await prisma.truckCostEntry.findMany({ where: { sourceType: 'part_purchase', sourceId: { in: ids } }, select: { id: true, reversesEntryId: true } });
  await prisma.truckCostEntry.deleteMany({ where: { id: { in: entries.filter((row) => row.reversesEntryId).map((row) => row.id) } } });
  await prisma.truckCostEntry.deleteMany({ where: { id: { in: entries.map((row) => row.id) } } });
  await prisma.partPurchase.deleteMany({ where: { id: { in: ids } } });
  await prisma.attachment.deleteMany({ where: { fileName: { contains: String(RUN) } } });
  await prisma.vendor.deleteMany({ where: { id: { in: vendors.map((row) => row.id) } } });
}

describe('Manager: compras de partes con su factura (D32, PC-2)', () => {
  afterAll(cleanup);

  it('A57 | Compra de 3 líneas con impuesto y flete: la API calcula el total y rechaza uno que no cuadra', async () => {
    const vendorId = await vendor('FleetPride');
    const part = await fuelFilter();
    const body = {
      vendorId,
      invoiceNumber: '88412093',
      invoiceDate: '2026-10-06',
      taxCents: 437,
      freightCents: 1500,
      lines: [
        { partId: part.id, quantity: '2', unitCostCents: 2410 },
        { description: 'Brake pads (axle set)', quantity: 1, unitCostCents: 8999 },
        { description: 'Bulk oil 15W-40', quantity: '5.5', unitCostCents: 1299 },
      ],
    };
    refused('un total que no cuadra', await save({ ...body, expectedTotalCents: 100 }), 400, 'TOTAL_MISMATCH');
    // 2 × 24.10 + 89.99 + 5.5 × 12.99 (71.445 → 71.45) = 209.64; + 4.37 + 15.00 = 229.01
    const saved = ok('guardar', await save({ ...body, expectedTotalCents: 22901 }));
    const detail = ok('detalle', await manager.get(`${PURCHASES}/${saved.id}`));
    same('totales', [detail.subtotalCents, detail.totalCents, detail.lines.length], [20964, 22901, 3]);
    same('la línea del catálogo copia nombre y número', [detail.lines[0].description, detail.lines[0].partNumber], [part.displayName, part.partNumber]);
    same('la cantidad con decimales', detail.lines[2].quantity, '5.50');
    same('sin camión no escribe en ningún camión (D-PC5)', [detail.noTruckCents, (await ledger(saved.id)).rows.length], [22901, 0]);
    const catalog = ok('catálogo', await manager.get('/admin/parts-costs/parts'));
    const row = (catalog.categories as Json[]).flatMap((category) => category.parts).find((item: Json) => item.id === part.id);
    same('el catálogo dice el último pagado (D-PC6)', [row.lastPaid?.unitCostCents, row.lastPaid?.vendorName], [2410, `FleetPride ${RUN}`]);
  });

  it('A58 | La misma factura del mismo proveedor: el aviso lo dice y guardar responde 409; anulada la primera, sí', async () => {
    const vendorId = await vendor('TruckPro');
    const line = { description: 'Mud flaps', quantity: 2, unitCostCents: 3500 };
    const first = ok('primera', await save({ vendorId, invoiceNumber: 'INV 5521', invoiceDate: '2026-10-01', lines: [line] }));
    const check = ok('aviso al salir del campo', await manager.get(`/admin/parts-costs/invoices/check?vendorId=${vendorId}&number=${encodeURIComponent('inv-5521')}`));
    same('dice cuál es', [check.exists, check.id, check.totalCents], [true, first.id, 7000]);
    const again = await save({ vendorId, invoiceNumber: 'inv5521', invoiceDate: '2026-10-02', lines: [line] });
    refused('guardar otra vez', again, 409, 'DUPLICATE_INVOICE');
    same('la respuesta trae la que ya existe', again.json.id, first.id);
    const otherVendor = await vendor('Rush');
    ok('el mismo número con otro proveedor, sí', await save({ vendorId: otherVendor, invoiceNumber: 'INV 5521', invoiceDate: '2026-10-02', lines: [line] }));
    refused('anular pide motivo', await manager.post(`${PURCHASES}/${first.id}/void`, { reason: ' ' }), 400);
    ok('anular la primera', await manager.post(`${PURCHASES}/${first.id}/void`, { reason: 'Cargada con el monto equivocado' }));
    ok('ahora sí se carga', await save({ vendorId, invoiceNumber: 'INV 5521', invoiceDate: '2026-10-01', lines: [line] }));
  });

  it('A59 | Dos envíos con la misma Idempotency-Key guardan una sola compra', async () => {
    const vendorId = await vendor('Premier');
    const key = randomUUID();
    const body = { vendorId, invoiceNumber: `W-${RUN}`, invoiceDate: '2026-10-03', lines: [{ description: 'Windshield', quantity: 1, unitCostCents: 41000 }] };
    const [one, two] = await Promise.all([save(body, key), save(body, key)]);
    same('las dos responden la misma compra', ok('uno', one).id, ok('dos', two).id);
    same('una sola en la base', await prisma.partPurchase.count({ where: { vendorId } }), 1);
    refused('sin clave no se guarda', await manager.post(PURCHASES, body), 400, 'IDEMPOTENCY_KEY_REQUIRED');
  });

  it('A60 | Una factura de dos camiones: cada uno recibe su parte con el impuesto repartido y la suma cuadra', async () => {
    const vendorId = await vendor('Split');
    const [t606, t918] = await Promise.all([truck('905'), truck('922')]);
    const saved = ok('guardar', await save({
      vendorId,
      invoiceNumber: `S-${RUN}`,
      invoiceDate: '2026-10-04',
      taxCents: 1001,
      freightCents: 0,
      lines: [
        { description: 'Air filter', quantity: 1, unitCostCents: 10000, truckId: t606.id },
        { description: 'Belt', quantity: 2, unitCostCents: 10000, truckId: t918.id },
        { description: 'Shop rags', quantity: 1, unitCostCents: 10000 },
      ],
    }));
    const detail = ok('detalle', await manager.get(`${PURCHASES}/${saved.id}`));
    const { rows, byTruck } = await ledger(saved.id);
    same('una fila por camión', rows.length, 2);
    // 1001 de impuesto en 1:2:1 → 250 / 500 / 250, y el centavo que sobra va al más grande (el 922).
    same('cada camión con su parte', [byTruck.get(t606.id), byTruck.get(t918.id)], [10250, 20501]);
    same('lo sin camión', detail.noTruckCents, 10250);
    same('camiones + sin camión = total', byTruck.get(t606.id)! + byTruck.get(t918.id)! + detail.noTruckCents, detail.totalCents);
    same('la lista dice a qué camiones va', ok('lista', await manager.get(`${PURCHASES}?truckId=${t918.id}`)).items.map((item: Json) => item.id), [saved.id]);
    truthy('el filtro "sin camión" la incluye', ok('sin camión', await manager.get(`${PURCHASES}?truckId=none&vendorId=${vendorId}`)).items.length === 1);
  });

  it('A61 | Corregir y anular escriben reversas; ninguna fila del libro cambia', async () => {
    const vendorId = await vendor('Edit');
    const t905 = await truck('905');
    const t922 = await truck('922');
    const body = { vendorId, invoiceNumber: `E-${RUN}`, invoiceDate: '2026-10-05', lines: [{ description: 'Hose', quantity: 1, unitCostCents: 5000, truckId: t905.id }] };
    const saved = ok('guardar', await save(body));
    const [original] = (await ledger(saved.id)).rows;

    ok('corregir: otro camión y otro monto', await manager.patch(`${PURCHASES}/${saved.id}`, { ...body, lines: [{ description: 'Hose', quantity: 2, unitCostCents: 5000, truckId: t922.id }] }));
    let state = await ledger(saved.id);
    same('reversa + fila nueva', state.rows.length, 3);
    same('el 905 queda en 0 y el 922 con 100.00', [state.byTruck.get(t905.id), state.byTruck.get(t922.id)], [0, 10000]);
    const untouched = await prisma.truckCostEntry.findUniqueOrThrow({ where: { id: original.id } });
    same('la fila original no cambió', [untouched.amountCents, untouched.truckId], [original.amountCents, original.truckId]);

    ok('anular', await manager.post(`${PURCHASES}/${saved.id}/void`, { reason: 'Era de otro taller' }));
    state = await ledger(saved.id);
    same('todo en 0, con 4 filas', [state.rows.length, state.byTruck.get(t922.id)], [4, 0]);
    const voided = ok('detalle anulado', await manager.get(`${PURCHASES}/${saved.id}`));
    same('dice quién, cuándo y por qué', [Boolean(voided.voidedAt), voided.voidReason, voided.voidedBy?.name !== undefined], [true, 'Era de otro taller', true]);
    refused('una anulada no se corrige', await manager.patch(`${PURCHASES}/${saved.id}`, body), 409, 'PURCHASE_VOIDED');
    const listed = ok('lista', await manager.get(`${PURCHASES}?vendorId=${vendorId}`));
    same('la lista la muestra anulada y no la suma', [listed.items[0].voidedAt !== null, listed.totals.totalCents], [true, 0]);
  });

  it('A62 | La factura adjunta: tipo y tamaño se revisan; mecánicos y Safety no ven ni cargan compras', async () => {
    refused('un archivo que no es PDF ni imagen', await manager.post('/admin/parts-costs/attachments', { fileName: `x-${RUN}.exe`, contentType: 'application/x-msdownload', sizeBytes: 100 }), 400);
    refused('más de 10 MB', await manager.post('/admin/parts-costs/attachments', { fileName: `big-${RUN}.pdf`, contentType: 'application/pdf', sizeBytes: 11 * 1024 * 1024 }), 400);
    const form = ok('datos del formulario', await manager.get(`${PURCHASES}/form-data`));
    truthy('trae los camiones', (form.trucks as Json[]).some((item) => item.truckNumber === '905'));
    if (!form.filesEnabled) {
      // This environment has no Supabase Storage: the screen hides the file field and the API says why.
      refused('sin Storage configurado', await manager.post('/admin/parts-costs/attachments', { fileName: `ok-${RUN}.pdf`, contentType: 'application/pdf', sizeBytes: 2048 }), 503, 'FILES_NOT_CONFIGURED');
    }
    for (const email of [USERS.general, USERS.pm, USERS.safety]) {
      refused(`${email}: compras`, await as(email).get(PURCHASES), 403);
      refused(`${email}: cargar`, await as(email).post(PURCHASES, {}, { 'Idempotency-Key': randomUUID() }), 403);
    }
  });
});

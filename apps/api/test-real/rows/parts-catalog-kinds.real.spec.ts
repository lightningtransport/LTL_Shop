/**
 * D45 / ST-2 (LTR-222): the catalog has repair parts and tires, not only the PM. A tire carries its size and New or
 * Recap; a part number belongs to one part; the Manager adds repair and tire categories. The PM picker shows only
 * PM categories and refuses anything else. `resetDb` keeps the catalog, so the row removes what it adds.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { Json, USERS, as, createPmService, manager, ok, plannedWo, prisma, refused, resetDb, same, truthy } from '../harness';

const RUN = Date.now();
const pm = as(USERS.pm);

async function cleanup() {
  await resetDb();
  const parts = await prisma.part.findMany({ where: { displayName: { contains: String(RUN) } }, select: { id: true } });
  const vendors = await prisma.vendor.findMany({ where: { name: { contains: String(RUN) } }, select: { id: true } });
  const purchases = await prisma.partPurchase.findMany({ where: { vendorId: { in: vendors.map((row) => row.id) } }, select: { id: true } });
  await prisma.partPurchase.deleteMany({ where: { id: { in: purchases.map((row) => row.id) } } });
  await prisma.part.deleteMany({ where: { id: { in: parts.map((row) => row.id) } } });
  await prisma.partCategory.deleteMany({ where: { name: { contains: String(RUN) } } });
  await prisma.vendor.deleteMany({ where: { id: { in: vendors.map((row) => row.id) } } });
}

async function category(kind: 'repair' | 'tire') {
  return prisma.partCategory.findFirstOrThrow({ where: { kind, active: true }, orderBy: { sortOrder: 'asc' } });
}

async function catalog(query = '') {
  return ok('catálogo', await manager.get(`/admin/parts-costs/parts${query}`)) as { categories: Json[] };
}

describe('Manager: repuestos y llantas en el catálogo (D45, ST-2)', () => {
  beforeEach(resetDb);
  afterAll(cleanup);

  it('A114 | Un repuesto y una llanta (medida, New o Recap) entran al catálogo; el PM no los ve ni los acepta', async () => {
    const [repair, tires] = await Promise.all([category('repair'), category('tire')]);
    const pump = ok('repuesto', await manager.post('/admin/parts-costs/parts', { categoryId: repair.id, partNumber: `WP-${RUN}`, displayName: `Water pump ${RUN}`, minStock: 1 }));
    refused('llanta sin medida', await manager.post('/admin/parts-costs/parts', { categoryId: tires.id, displayName: `Recap ${RUN}`, tireType: 'recap' }), 400, 'TIRE_FIELDS_REQUIRED');
    const recap = ok('llanta', await manager.post('/admin/parts-costs/parts', { categoryId: tires.id, displayName: `Recap drive ${RUN}`, tireSize: ' 11r22.5 ', tireType: 'recap', minStock: 4 }));

    const tireRows = (await catalog('?kind=tire')).categories;
    same('el filtro Tires trae solo categorías de llantas', [...new Set(tireRows.map((row) => row.kind))], ['tire']);
    const saved = tireRows.flatMap((row) => row.parts).find((part: Json) => part.id === recap.id);
    same('la llanta guarda medida, tipo y mínimo', [saved.tireSize, saved.tireType, saved.minStock], ['11R22.5', 'recap', 4]);
    const all = (await catalog()).categories;
    truthy('sin filtro salen PM, repuestos y llantas', ['pm', 'repair', 'tire'].every((kind) => all.some((row) => row.kind === kind)));
    const pumpRow = all.flatMap((row) => row.parts).find((part: Json) => part.id === pump.id);
    same('un repuesto no lleva datos de llanta', [pumpRow.tireSize, pumpRow.tireType, pumpRow.minStock], [null, null, 1]);

    const { truck, workOrderId } = await plannedWo('905');
    ok('Create PM service', await createPmService(truck.id));
    const service = ok('PM', await pm.get(`/work-orders/${workOrderId}/pm`));
    const offered = (service.categories as Json[]).map((row) => row.id);
    truthy('el PM no ofrece categorías de repuestos ni de llantas', !offered.includes(repair.id) && !offered.includes(tires.id));
    refused('el PM no acepta un repuesto', await pm.post(`/work-orders/${workOrderId}/pm`, { observedMileage: 100000, selections: [{ partCategoryId: repair.id, partId: pump.id }] }), 400);
  });

  it('A115 | Un número de parte es de una sola parte; el Manager agrega categorías; mecánicos y Safety no', async () => {
    const repair = await category('repair');
    const first = ok('primera', await manager.post('/admin/parts-costs/parts', { categoryId: repair.id, partNumber: `AL-${RUN}`, displayName: `Alternator ${RUN}` }));
    const again = await manager.post('/admin/parts-costs/parts', { categoryId: repair.id, partNumber: `al ${RUN}`, displayName: `Alternator reman ${RUN}` });
    refused('el mismo número con otro nombre', again, 409, 'PART_NUMBER_EXISTS');
    same('dice cuál es', [again.json.partId, again.json.partName], [first.id, `Alternator ${RUN}`]);

    const lights = ok('categoría', await manager.post('/admin/parts-costs/part-categories', { name: `Lights ${RUN}`, kind: 'repair' }));
    refused('el mismo nombre', await manager.post('/admin/parts-costs/part-categories', { name: ` lights ${RUN} `, kind: 'tire' }), 409, 'PART_CATEGORY_EXISTS');
    refused('una categoría PM no se agrega aquí', await manager.post('/admin/parts-costs/part-categories', { name: `PM ${RUN}`, kind: 'pm' }), 400);
    const rows = (await catalog('?kind=repair')).categories;
    same('aparece como repuestos', rows.find((row) => row.id === lights.id)?.kind, 'repair');
    for (const email of [USERS.general, USERS.pm, USERS.safety]) {
      refused(`${email}: agregar categoría`, await as(email).post('/admin/parts-costs/part-categories', { name: `X ${RUN}`, kind: 'repair' }), 403);
    }
  });

  it('A116 | Una línea "Other" pasa al catálogo y la siguiente compra la usa con su último precio', async () => {
    const repair = await category('repair');
    const vendorId = ok('proveedor', await manager.post('/admin/parts-costs/vendors', { name: `FleetPride ${RUN}` })).id as string;
    const part = ok('agregar al catálogo', await manager.post('/admin/parts-costs/parts', { categoryId: repair.id, displayName: `Brake chamber ${RUN}` }));
    ok('compra con la parte del catálogo', await manager.post('/admin/parts-costs/purchases', {
      vendorId, invoiceNumber: `O-${RUN}`, invoiceDate: '2026-10-16', lines: [{ partId: part.id, quantity: 2, unitCostCents: 6500 }],
    }, { 'Idempotency-Key': randomUUID() }));
    const row = (await catalog('?kind=repair')).categories.flatMap((item) => item.parts).find((item: Json) => item.id === part.id);
    same('el catálogo dice el último pagado', [row.lastPaid?.unitCostCents, row.lastPaid?.vendorName], [6500, `FleetPride ${RUN}`]);
  });
});

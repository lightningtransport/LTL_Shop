/**
 * LTR-200 / D32 (PC-1): the Manager keeps the PM part catalog — reference cost, usual vendor, "Fits" — and the
 * vendors, without breaking a PM in progress and without the base list undoing it. Mechanics never see costs.
 * `resetDb` keeps the catalog, so every row puts back what it changes.
 */
import { afterAll, beforeEach, describe, it } from 'vitest';
import { applyPmParts } from '../../prisma/pm-parts';
import {
  Json, USERS, adminWo, as, completeJob, createPmService, laneJob, manager, ok, plannedWo, prisma, refused, resetDb,
  same, savePm, truthy,
} from '../harness';

const RUN = Date.now();
const pm = as(USERS.pm);

async function cleanup() {
  await resetDb();
  await prisma.part.deleteMany({ where: { source: 'app', displayName: { contains: String(RUN) } } });
  await prisma.part.updateMany({ where: { defaultVendor: { name: { contains: String(RUN) } } }, data: { defaultVendorId: null } });
  await prisma.vendor.deleteMany({ where: { name: { contains: String(RUN) } } });
}

async function vendor(name: string) {
  return ok(`proveedor ${name}`, await manager.post('/admin/parts-costs/vendors', { name, doesParts: true }));
}

/** The part as it is now, to put it back after the row. */
async function snapshot(partId: string) {
  return prisma.part.findUniqueOrThrow({ where: { id: partId }, include: { fitments: true } });
}

async function restore(part: Awaited<ReturnType<typeof snapshot>>) {
  await prisma.part.update({ where: { id: part.id }, data: { active: part.active, unitCostCents: part.unitCostCents, defaultVendorId: part.defaultVendorId } });
  await prisma.partFitment.deleteMany({ where: { partId: part.id } });
  if (part.fitments.length) await prisma.partFitment.createMany({ data: part.fitments.map(({ make, model }) => ({ partId: part.id, make, model })) });
}

/** What the PM screen offers: per category, its parts and the most used one. */
const offer = (service: Json) => (service.categories as Json[]).map((category) => [category.id, (category.parts as Json[]).map((part) => part.id), category.mostUsedPartId]);

describe('Manager: catálogo de partes y proveedores (D32, PC-1)', () => {
  beforeEach(resetDb);
  afterAll(cleanup);

  it('A53 | Costo, proveedor habitual y "Fits": el PM sigue mostrando lo mismo y nunca recibe un costo', async () => {
    const { truck, workOrderId } = await plannedWo('905');
    ok('Create PM service', await createPmService(truck.id));
    const before = ok('PM antes', await pm.get(`/work-orders/${workOrderId}/pm`));
    const category = (before.categories as Json[]).find((item) => item.parts.length >= 2)!;
    const [picked, other] = category.parts as Json[];
    const pickedBefore = await snapshot(picked.id);
    const otherBefore = await snapshot(other.id);
    const supplier = await vendor(`FleetPride ${RUN}`);
    try {
      ok('costo y proveedor', await manager.patch(`/admin/parts-costs/parts/${picked.id}`, { unitCostCents: 2410, defaultVendorId: supplier.id }));
      const catalog = ok('catálogo', await manager.get('/admin/parts-costs/parts'));
      const row = (catalog.categories as Json[]).flatMap((item) => item.parts).find((part: Json) => part.id === picked.id);
      same('el catálogo trae costo y proveedor', [row.unitCostCents, row.defaultVendor?.name], [2410, `FleetPride ${RUN}`]);

      const after = ok('PM después', await pm.get(`/work-orders/${workOrderId}/pm`));
      same('el PM ofrece las mismas partes y la misma más usada', offer(after), offer(before));
      truthy('el PM no trae ningún costo', !/cost|cents|vendor/i.test(JSON.stringify(after)));

      ok('"Fits" de otra parte: solo Mack', await manager.patch(`/admin/parts-costs/parts/${other.id}`, { fits: [{ make: 'Mack' }] }));
      const fitted = ok('PM con Fits cambiado', await pm.get(`/work-orders/${workOrderId}/pm`));
      const sameCategory = (fitted.categories as Json[]).find((item) => item.id === category.id);
      truthy('el Volvo 905 ya no la ve', !sameCategory.parts.some((part: Json) => part.id === other.id));
    } finally {
      await restore(pickedBefore);
      await restore(otherBefore);
    }
  });

  it('A54 | Una parte elegida en un PM en curso no se desactiva ni pierde ese camión; al terminar el PM, sí', async () => {
    const { truck, workOrderId } = await plannedWo('905');
    ok('Create PM service', await createPmService(truck.id));
    ok('el mecánico elige una parte', await savePm(workOrderId, (truck.mileage ?? 0) + 100));
    const { selections } = ok('PM', await pm.get(`/work-orders/${workOrderId}/pm`));
    const partId = selections[0].partId as string;
    const before = await snapshot(partId);
    try {
      const off = await manager.patch(`/admin/parts-costs/parts/${partId}`, { active: false });
      refused('no se desactiva', off, 409, 'PART_IN_OPEN_PM');
      same('dice en qué camión', off.json.openPms.map((item: Json) => item.truckNumber), ['905']);
      refused('no pierde la marca del 905', await manager.patch(`/admin/parts-costs/parts/${partId}`, { fits: [{ make: 'Mack' }] }), 409, 'PART_IN_OPEN_PM');
      ok('un "Fits" que sigue sirviendo al 905 sí', await manager.patch(`/admin/parts-costs/parts/${partId}`, { fits: [{ make: 'Volvo' }] }));
      const catalog = ok('catálogo', await manager.get('/admin/parts-costs/parts'));
      const row = (catalog.categories as Json[]).flatMap((item) => item.parts).find((part: Json) => part.id === partId);
      same('el catálogo dice que está en el PM del 905', row.openPms.map((item: Json) => item.truckNumber), ['905']);

      ok('el mecánico vuelve a guardar sin error', await savePm(workOrderId, (truck.mileage ?? 0) + 150));
      ok('termina el PM', await completeJob(USERS.pm, workOrderId, laneJob(await adminWo(workOrderId), 'pm').id));
      ok('ahora sí se desactiva', await manager.patch(`/admin/parts-costs/parts/${partId}`, { active: false }));
    } finally {
      await restore(before);
    }
  });

  it('A55 | La lista base no deshace el catálogo del Manager; un proveedor no se repite', async () => {
    const category = await prisma.partCategory.findFirstOrThrow({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
    const seeded = await prisma.part.findFirstOrThrow({ where: { categoryId: category.id, source: 'seed', active: true }, orderBy: { displayName: 'asc' } });
    const before = await snapshot(seeded.id);
    const created = ok('parte nueva del Manager', await manager.post('/admin/parts-costs/parts', {
      categoryId: category.id, partNumber: `PC-${RUN}`, displayName: `Shop Filter ${RUN}`, fits: [{ make: 'Volvo' }], unitCostCents: 1999,
    }));
    refused('la misma parte otra vez', await manager.post('/admin/parts-costs/parts', { categoryId: category.id, partNumber: `pc-${RUN}`, displayName: `shop filter ${RUN}` }), 409, 'PART_EXISTS');
    try {
      ok('desactivar una de la lista base', await manager.patch(`/admin/parts-costs/parts/${seeded.id}`, { active: false, unitCostCents: 500, fits: [{ make: 'Mack' }] }));
      const count = await prisma.part.count();
      const loaded = await applyPmParts(prisma);
      await applyPmParts(prisma);
      same('no crea nada', [loaded.created, await prisma.part.count()], [0, count]);
      const mine = await snapshot(created.id);
      same('la del Manager sigue igual', [mine.active, mine.unitCostCents, mine.source, mine.fitments.map((fit) => fit.make)], [true, 1999, 'app', ['Volvo']]);
      const base = await snapshot(seeded.id);
      same('la de la lista sigue apagada, con su costo y su marca', [base.active, base.unitCostCents, base.fitments.map((fit) => fit.make)], [false, 500, ['Mack']]);
    } finally {
      await restore(before);
    }

    await vendor(`Rush Truck Center ${RUN}`);
    const twin = await manager.post('/admin/parts-costs/vendors', { name: `  rush truck center ${RUN} ` });
    refused('mismo nombre sin mayúsculas', twin, 409, 'VENDOR_NAME_TAKEN');
    same('dice cuál existe', twin.json.vendorName, `Rush Truck Center ${RUN}`);
    refused('un proveedor que no vende ni repara', await manager.post('/admin/parts-costs/vendors', { name: `Nada ${RUN}`, doesParts: false, doesRepairs: false }), 400);
  });

  it('A56 | Mecánicos y Safety no ven el catálogo con costos ni los proveedores', async () => {
    for (const email of [USERS.general, USERS.pm, USERS.safety]) {
      refused(`${email}: catálogo`, await as(email).get('/admin/parts-costs/parts'), 403);
      refused(`${email}: proveedores`, await as(email).get('/admin/parts-costs/vendors'), 403);
      refused(`${email}: crear proveedor`, await as(email).post('/admin/parts-costs/vendors', { name: `Nope ${RUN}` }), 403);
    }
    ok('el System Admin sí', await as(USERS.admin).get('/admin/parts-costs/parts'));
  });
});

/**
 * LTR-57 / D25: the Custom Jobs review inbox. Custom Jobs of one category with the same name (capitals, accents and
 * spaces ignored) are one group; the Manager ties the whole group to a catalog Job, adds it to the catalog, or keeps
 * it as a one-off — and can undo. Work Orders keep their names. Every row uses names with RUN and removes what it adds.
 */
import { afterAll, beforeEach, describe, it } from 'vitest';
import { normalizeCatalogText } from '@ltl-shop/shared';
import { Json, USERS, as, catalogJob, createWo, inspect, manager, meta, ok, prisma, refused, resetDb, same, truthy } from '../harness';

const RUN = Date.now();
const INBOX = '/admin/catalog/custom-jobs';

async function addCustom(truckNumber: string, categoryName: string, displayName: string) {
  const { truck, workOrderId } = await createWo(truckNumber);
  await inspect(truck.id, 'issues_found');
  const category = await prisma.jobCategory.findFirstOrThrow({ where: { name: categoryName } });
  ok(`Custom Job "${displayName}" en ${truckNumber}`, await manager.post(`/admin/trucks/${truck.id}/work-plan/jobs`, {
    ...(await meta(workOrderId)),
    jobs: [{ categoryId: category.id, displayName, customDescription: `Nota ${truckNumber}` }],
  }));
  return { workOrderId, categoryId: category.id };
}

async function group(name: string, status: 'pending' | 'reviewed' = 'pending') {
  const groups = ok('bandeja', await manager.get(`${INBOX}?status=${status}`)) as Json[];
  return groups.find((item) => item.nameNorm === normalizeCatalogText(name));
}

async function cleanup() {
  await resetDb();
  await prisma.jobAlias.deleteMany({ where: { aliasText: { contains: String(RUN) } } });
  await prisma.catalogJob.deleteMany({ where: { displayName: { contains: String(RUN) } } });
}

describe('Manager: bandeja de Custom Jobs (LTR-57, D25)', () => {
  beforeEach(resetDb);
  afterAll(cleanup);

  it('A76 | La bandeja agrupa por categoría y nombre (sin mayúsculas ni espacios), con cuántos, en qué WO y sugerencias', async () => {
    await addCustom('905', 'Electrical & Starting', `Fix dash light ${RUN}`);
    await addCustom('922', 'Electrical & Starting', `  fix DASH light ${RUN} `);
    await addCustom('931', 'Air & Brake System', `Fix dash light ${RUN}`);
    const groups = (ok('bandeja', await manager.get(INBOX)) as Json[]).filter((item) => item.displayName.includes(String(RUN)));
    same('dos grupos: uno por categoría', groups.map((item) => [item.categoryName, item.count]).sort(), [['Air & Brake System', 1], ['Electrical & Starting', 2]]);
    const electrical = groups.find((item) => item.categoryName === 'Electrical & Starting');
    same('el nombre más usado y la otra forma', [electrical.workOrders.length, electrical.otherNames.length], [2, 1]);
    truthy('trae las notas', electrical.descriptions.length === 2, electrical.descriptions);

    const lights = await catalogJob('Electrical & Starting', 'Lights');
    await addCustom('957', 'Electrical & Starting', 'lights');
    const exact = await group('lights');
    same('sugiere el Job del catálogo con el mismo nombre', exact?.suggestions[0]?.catalogJobId, lights.id);
    refused('un mecánico no ve la bandeja', await as(USERS.general).get(INBOX), 403);
  });

  it('A77 | Unir: todo el grupo queda ligado al Job del catálogo de una vez; el nombre queda como alias; el WO no cambia', async () => {
    const first = await addCustom('905', 'Electrical & Starting', `Headlamp swap ${RUN}`);
    await addCustom('922', 'Electrical & Starting', `headlamp  SWAP ${RUN}`);
    const lights = await catalogJob('Electrical & Starting', 'Lights');
    const pending = await group(`Headlamp swap ${RUN}`);
    const done = ok('unir a Lights', await manager.post(`${INBOX}/review`, { categoryId: pending.categoryId, nameNorm: pending.nameNorm, action: 'map', catalogJobId: lights.id }));
    same('dos Jobs, ligados, con alias', [done.updated, done.status, done.aliasAdded], [2, 'mapped', true]);
    const jobs = await prisma.workOrderJob.findMany({ where: { displayName: { contains: String(RUN) } } });
    same('todos ligados a Lights y siguen Custom con su nombre', jobs.map((job) => [job.mappedCatalogJobId, job.reviewStatus, job.isCustom]), [[lights.id, 'mapped', true], [lights.id, 'mapped', true]]);
    truthy('el WO conserva el nombre', jobs.some((job) => job.workOrderId === first.workOrderId && job.displayName === `Headlamp swap ${RUN}`));
    truthy('ya no está en la bandeja', !(await group(`Headlamp swap ${RUN}`)));
    const hits = ok('buscar en el catálogo', await manager.get(`/admin/catalog/search?q=${encodeURIComponent(`headlamp swap ${RUN}`)}`)) as Json[];
    truthy('la búsqueda encuentra Lights por el alias nuevo', hits.some((hit) => hit.jobId === lights.id && hit.matchedAlias));
    same('en Revisados dice a qué Job', (await group(`Headlamp swap ${RUN}`, 'reviewed'))?.mappedTo?.id, lights.id);
  });

  it('A78 | Agregar al catálogo: crea el Job y le liga el grupo; un nombre que ya existe no se acepta', async () => {
    await addCustom('905', 'Electrical & Starting', `Cab heater fan ${RUN}`);
    const pending = await group(`Cab heater fan ${RUN}`);
    refused('un nombre del catálogo', await manager.post(`${INBOX}/review`, { categoryId: pending.categoryId, nameNorm: pending.nameNorm, action: 'add', displayName: 'Lights' }), 409, 'CATALOG_JOB_EXISTS');
    const done = ok('agregar al catálogo', await manager.post(`${INBOX}/review`, { categoryId: pending.categoryId, nameNorm: pending.nameNorm, action: 'add', displayName: `Cab Heater Fan ${RUN}` }));
    same('agregado', [done.status, done.catalogJob.displayName], ['added', `Cab Heater Fan ${RUN}`]);
    const created = await prisma.catalogJob.findUniqueOrThrow({ where: { id: done.catalogJob.id }, include: { category: true } });
    same('en la misma categoría y activo', [created.category.name, created.status], ['Electrical & Starting', 'active']);
    same('el Job del WO queda ligado', (await prisma.workOrderJob.findFirstOrThrow({ where: { displayName: `Cab heater fan ${RUN}` } })).mappedCatalogJobId, created.id);
    refused('un mecánico no revisa', await as(USERS.general).post(`${INBOX}/review`, { categoryId: pending.categoryId, nameNorm: pending.nameNorm, action: 'keep' }), 403);
  });

  it('A79 | Dejar como único: sale de la bandeja sin tocar el catálogo; Deshacer lo devuelve', async () => {
    await addCustom('905', 'Electrical & Starting', `One-off wiring ${RUN}`);
    const pending = await group(`One-off wiring ${RUN}`);
    const catalogBefore = await prisma.catalogJob.count();
    same('dejar como único', ok('keep', await manager.post(`${INBOX}/review`, { categoryId: pending.categoryId, nameNorm: pending.nameNorm, action: 'keep' })).status, 'kept');
    same('el catálogo no cambia', await prisma.catalogJob.count(), catalogBefore);
    truthy('sale de la bandeja', !(await group(`One-off wiring ${RUN}`)));
    refused('revisar otra vez lo ya revisado', await manager.post(`${INBOX}/review`, { categoryId: pending.categoryId, nameNorm: pending.nameNorm, action: 'keep' }), 404, 'CUSTOM_JOB_GROUP_NOT_FOUND');
    ok('deshacer', await manager.post(`${INBOX}/undo`, { categoryId: pending.categoryId, nameNorm: pending.nameNorm }));
    same('vuelve a la bandeja', (await group(`One-off wiring ${RUN}`))?.status, 'pending_review');
  });
});

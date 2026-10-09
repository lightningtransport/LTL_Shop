/**
 * LTR-198 / D30: the Shop Manager manages the whole Job Catalog — Categories, deleting or deactivating Jobs, aliases,
 * the search — with System Jobs protected, and a release's catalog load that never undoes the Manager's changes.
 * `resetDb` keeps the catalog, so every row puts back what it changes.
 */
import { afterAll, beforeEach, describe, it } from 'vitest';
import { applyJobCatalog } from '../../prisma/job-catalog';
import {
  Json, USERS, addShopJobs, as, catalogJob, createWo, inspect, manager, ok, plannedWo, prisma, refused, resetDb, same,
  sameNextStepEverywhere, truckDetail, truthy,
} from '../harness';

const RUN = Date.now();

async function cleanup() {
  await resetDb();
  await prisma.catalogJob.deleteMany({ where: { displayName: { contains: String(RUN) } } });
  await prisma.jobCategory.deleteMany({ where: { name: { contains: String(RUN) } } });
}

const categoryByName = (name: string) => prisma.jobCategory.findFirstOrThrow({ where: { name } });

describe('Manager: maneja el catálogo con protecciones (D30)', () => {
  beforeEach(resetDb);
  afterAll(cleanup);

  it('A45 | Categorías: crear, renombrar, desactivar con motivo, activar y borrar solo vacía; las del flujo del taller no cambian', async () => {
    const created = ok('crear categoría', await manager.post('/admin/catalog/categories', { name: `Body Shop ${RUN}` }));
    refused('mismo nombre', await manager.post('/admin/catalog/categories', { name: `body shop ${RUN}` }), 409, 'CATALOG_CATEGORY_EXISTS');
    ok('renombrar', await manager.patch(`/admin/catalog/categories/${created.id}`, { name: `Body & Paint ${RUN}` }));
    const job = ok('un Job adentro', await manager.post('/admin/catalog/jobs', { categoryId: created.id, displayName: `Bumper ${RUN}` }));

    const off = ok('desactivar con motivo', await manager.patch(`/admin/catalog/categories/${created.id}`, { status: 'inactive', inactiveReason: 'Se hace afuera' }));
    same('queda inactiva con su motivo', [off.status, off.inactiveReason], ['inactive', 'Se hace afuera']);
    const picker = ok('lista para agregar trabajo', await manager.get('/catalog/categories')) as Json[];
    same('no aparece al agregar trabajo', picker.some((category) => category.id === created.id), false);
    refused('con Jobs no se borra', await manager.del(`/admin/catalog/categories/${created.id}`), 409, 'CATALOG_CATEGORY_IN_USE');
    const on = ok('activar', await manager.patch(`/admin/catalog/categories/${created.id}`, { status: 'active' }));
    same('activa y sin motivo', [on.status, on.inactiveReason], ['active', null]);

    ok('borrar el Job nunca usado', await manager.del(`/admin/catalog/jobs/${job.id}`));
    ok('ya vacía, se borra', await manager.del(`/admin/catalog/categories/${created.id}`));

    const pm = await categoryByName('PM');
    refused('PM no se renombra', await manager.patch(`/admin/catalog/categories/${pm.id}`, { name: 'Preventive' }), 409, 'SYSTEM_CATEGORY_LOCKED');
    refused('PM no se desactiva', await manager.patch(`/admin/catalog/categories/${pm.id}`, { status: 'inactive' }), 409, 'SYSTEM_CATEGORY_LOCKED');
    refused('PM no se borra', await manager.del(`/admin/catalog/categories/${pm.id}`), 409, 'SYSTEM_CATEGORY_LOCKED');
    const suspension = await categoryByName('Suspension & Steering');
    refused('una categoría con un Job del sistema (Alignment) sigue activa', await manager.patch(`/admin/catalog/categories/${suspension.id}`, { status: 'inactive' }), 409, 'CATEGORY_HAS_SYSTEM_JOB');
    refused('un mecánico no crea categorías', await as(USERS.general).post('/admin/catalog/categories', { name: `Nope ${RUN}` }), 403);
  });

  it('A46 | Jobs: borrar solo si nunca se usó; si se usó, desactivar; los del sistema no; renombrar Alignment no lo saca de su carril y el nombre viejo queda como alias', async () => {
    const lights = await catalogJob('Electrical & Starting', 'Lights');
    const { truck, workOrderId } = await createWo('905');
    await inspect(truck.id, 'issues_found');
    ok('Lights en un Work Order', await addShopJobs(truck.id, workOrderId, [{ category: 'Electrical & Starting', job: 'Lights' }]));
    const used = await manager.del(`/admin/catalog/jobs/${lights.id}`);
    refused('usado: no se borra', used, 409, 'CATALOG_JOB_IN_USE');
    truthy('dice cuántos Work Orders', used.json.workOrderCount >= 1);

    const alignment = await prisma.catalogJob.findFirstOrThrow({ where: { systemKey: 'alignment' } });
    refused('Alignment no se desactiva', await manager.patch(`/admin/catalog/jobs/${alignment.id}`, { status: 'inactive' }), 409, 'SYSTEM_JOB_LOCKED');
    refused('Alignment no se borra', await manager.del(`/admin/catalog/jobs/${alignment.id}`), 409, 'SYSTEM_JOB_LOCKED');

    ok('renombrar Alignment', await manager.patch(`/admin/catalog/jobs/${alignment.id}`, { displayName: `Wheel Alignment ${RUN}` }));
    try {
      const aliases = await prisma.jobAlias.findMany({ where: { catalogJobId: alignment.id } });
      truthy('el nombre viejo queda como alias (D-SET4)', aliases.some((alias) => alias.aliasText === 'Alignment'));
      const next = await plannedWo('922');
      // The Work Plan's lanes come from the API, which places a System Job by its key.
      const plan = (await truckDetail(next.truck.id)).workPlan.jobs as Json[];
      const inLane = plan.filter((item) => item.lane === 'alignment');
      same('el WO nuevo tiene Alignment en su carril con el nombre nuevo, una sola vez', inLane.map((item) => item.displayName), [`Wheel Alignment ${RUN}`]);
      await sameNextStepEverywhere('Alignment renombrado', next.workOrderId, next.truck.id, 'work');
    } finally {
      await manager.patch(`/admin/catalog/jobs/${alignment.id}`, { displayName: 'Alignment', keepOldNameAsAlias: false });
      await prisma.jobAlias.deleteMany({ where: { catalogJobId: alignment.id, aliasText: { contains: String(RUN) } } });
    }
  });

  it('A47 | Aliases: agregar y quitar; el choque dice de qué Job es; las tildes no cuentan; la búsqueda encuentra Jobs y aliases de todas las categorías', async () => {
    const lines = await catalogJob('Fuel System', 'Fuel Lines');
    const added = ok('agregar alias', await manager.post(`/admin/catalog/jobs/${lines.id}/aliases`, { text: `Mangueras ${RUN}` }));
    const clash = await manager.post(`/admin/catalog/jobs/${lines.id}/aliases`, { text: 'Lights' });
    refused('el alias de otro Job', clash, 409, 'CATALOG_ALIAS_EXISTS');
    same('dice de qué Job y categoría', [clash.json.jobName, clash.json.categoryName], ['Lights', 'Electrical & Starting']);
    refused('con tilde también choca', await manager.post(`/admin/catalog/jobs/${lines.id}/aliases`, { text: `Mángueras ${RUN}` }), 409, 'CATALOG_ALIAS_EXISTS');

    const hits = ok('buscar sin tilde', await manager.get(`/admin/catalog/search?q=${encodeURIComponent('lineas de combustible')}`)) as Json[];
    truthy('encuentra Fuel Lines por su alias con tilde', hits.some((hit) => hit.jobId === lines.id && hit.matchedAlias));
    const byName = ok('buscar por nombre', await manager.get('/admin/catalog/search?q=fuel')) as Json[];
    truthy('encuentra Jobs de otra categoría por nombre', byName.some((hit) => hit.categoryName === 'Fuel System'));

    refused('el nombre del Job no se quita', await manager.del(`/admin/catalog/jobs/${lines.id}/aliases/${(await prisma.jobAlias.findFirstOrThrow({ where: { catalogJobId: lines.id, aliasText: 'Fuel Lines' } })).id}`), 400, 'ALIAS_IS_JOB_NAME');
    ok('quitar el alias', await manager.del(`/admin/catalog/jobs/${lines.id}/aliases/${added.id}`));
    same('ya no está', await prisma.jobAlias.count({ where: { id: added.id } }), 0);
  });

  it('A48 | La carga del catálogo de cada publicación no deshace lo que cambió el Manager ni duplica nada', async () => {
    const lights = await catalogJob('Electrical & Starting', 'Lights');
    const lightsAlias = await prisma.jobAlias.findFirstOrThrow({ where: { catalogJobId: lights.id, aliasText: { not: 'Lights' } } });
    const fuelLines = await catalogJob('Fuel System', 'Fuel Lines');
    const counts = { jobs: await prisma.catalogJob.count(), categories: await prisma.jobCategory.count() };
    ok('renombrar Lights', await manager.patch(`/admin/catalog/jobs/${lights.id}`, { displayName: `Cab Lights ${RUN}`, keepOldNameAsAlias: false }));
    ok('desactivar Fuel Lines', await manager.patch(`/admin/catalog/jobs/${fuelLines.id}`, { status: 'inactive' }));
    ok('mover un alias de Lights a Fuel Lines', await manager.del(`/admin/catalog/jobs/${lights.id}/aliases/${lightsAlias.id}`));
    ok('…y agregarlo a Fuel Lines', await manager.post(`/admin/catalog/jobs/${fuelLines.id}/aliases`, { text: lightsAlias.aliasText }));
    try {
      await applyJobCatalog(prisma);
      await applyJobCatalog(prisma);
      const afterLights = await prisma.catalogJob.findUniqueOrThrow({ where: { id: lights.id } });
      const afterLines = await prisma.catalogJob.findUniqueOrThrow({ where: { id: fuelLines.id } });
      same('Lights sigue con el nombre del Manager', afterLights.displayName, `Cab Lights ${RUN}`);
      same('Fuel Lines sigue inactivo', afterLines.status, 'inactive');
      same('el alias sigue donde lo puso el Manager', (await prisma.jobAlias.findUniqueOrThrow({ where: { aliasNorm: lightsAlias.aliasNorm } })).catalogJobId, fuelLines.id);
      same('no se crearon Jobs ni categorías', [await prisma.catalogJob.count(), await prisma.jobCategory.count()], [counts.jobs, counts.categories]);
    } finally {
      await prisma.jobAlias.deleteMany({ where: { aliasNorm: lightsAlias.aliasNorm } });
      await prisma.jobAlias.create({ data: { catalogJobId: lights.id, aliasText: lightsAlias.aliasText, aliasNorm: lightsAlias.aliasNorm } });
      await prisma.catalogJob.update({ where: { id: lights.id }, data: { displayName: 'Lights' } });
      await prisma.jobAlias.deleteMany({ where: { catalogJobId: lights.id, aliasText: { contains: String(RUN) } } });
      await prisma.jobAlias.createMany({ data: [{ catalogJobId: lights.id, aliasText: 'Lights', aliasNorm: 'lights' }], skipDuplicates: true });
      await prisma.catalogJob.update({ where: { id: fuelLines.id }, data: { status: 'active' } });
    }
  });
});

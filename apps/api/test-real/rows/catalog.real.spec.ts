/**
 * HU-A2 (D25, LTR-57): the Manager keeps the Job catalog. A Job the Manager adds to the catalog
 * (in Admin → Job Catalog, or with "Also add to the catalog" in the Work Plan) goes onto the Work
 * Order as a catalog Job, not as a Custom Job. Categories are not written.
 */
import { afterAll, beforeEach, describe, it } from 'vitest';
import {
  USERS, as, catalogJob, createWo, inspect, manager, meta, namedJob, adminWo, ok, prisma, refused, resetDb, same,
} from '../harness';

const RUN = Date.now();
const NAME = `D25 Revisar arnés ${RUN}`;

async function cleanup() {
  await resetDb();
  await prisma.catalogJob.deleteMany({ where: { displayName: { contains: String(RUN) } } });
}

describe('Manager: catálogo de Jobs (HU-A2, D25)', () => {
  beforeEach(resetDb);
  afterAll(cleanup);

  it('A36 | El Manager crea un Job de catálogo, entra al Work Order como Job de catálogo; mismo nombre en la categoría no se duplica; mecánico y Safety no pueden', async () => {
    const lights = await catalogJob('Electrical & Starting', 'Lights');
    const categoryId = lights.categoryId;

    const created = ok('Manager: crear Job de catálogo', await manager.post('/admin/catalog/jobs', { categoryId, displayName: `  ${NAME}  ` }));
    same('queda en la categoría, activo y con el nombre sin espacios', [created.categoryId, created.status, created.displayName], [categoryId, 'active', NAME]);
    const listed = ok('aparece en la lista de la categoría', await manager.get(`/catalog/jobs?categoryId=${categoryId}`)) as Array<{ id: string }>;
    same('la lista del Work Plan lo trae', listed.some((job) => job.id === created.id), true);

    refused('mismo nombre en otra mayúscula', await manager.post('/admin/catalog/jobs', { categoryId, displayName: NAME.toUpperCase() }), 409, 'CATALOG_JOB_EXISTS');
    const duplicate = await manager.post('/admin/catalog/jobs', { categoryId, displayName: ` ${NAME.toLowerCase()} ` });
    refused('mismo nombre con espacios', duplicate, 409, 'CATALOG_JOB_EXISTS');
    same('la respuesta dice cuál Job ya existe', duplicate.json.jobId, created.id);
    refused('nombre de un Job que ya existe (Lights)', await manager.post('/admin/catalog/jobs', { categoryId, displayName: 'lights' }), 409, 'CATALOG_JOB_EXISTS');

    const { truck: row, workOrderId } = await createWo('905');
    await inspect(row.id, 'issues_found');
    ok('agregar el Job nuevo desde el Work Plan', await manager.post(`/admin/trucks/${row.id}/work-plan/jobs`, {
      ...(await meta(workOrderId)),
      jobs: [{ catalogJobId: created.id, categoryId, displayName: created.displayName }],
    }));
    const job = namedJob(await adminWo(workOrderId), NAME);
    same('es Job de catálogo', job.catalogJobId, created.id);
    const stored = await prisma.workOrderJob.findUniqueOrThrow({ where: { id: job.id } });
    same('no es personalizado', [stored.isCustom, stored.catalogJobId], [false, created.id]);

    ok('Manager: renombrar el Job', await manager.patch(`/admin/catalog/jobs/${created.id}`, { displayName: `${NAME} B` }));

    const body = { categoryId, displayName: `D25 Otro ${RUN}` };
    refused('mecánico: crear Job de catálogo', await as(USERS.alignment).post('/admin/catalog/jobs', body), 403);
    refused('Safety: crear Job de catálogo', await as(USERS.safety).post('/admin/catalog/jobs', body), 403);
    refused('mecánico: editar Job de catálogo', await as(USERS.alignment).patch(`/admin/catalog/jobs/${created.id}`, { displayName: 'X' }), 403);
    refused('Safety: editar Job de catálogo', await as(USERS.safety).patch(`/admin/catalog/jobs/${created.id}`, { displayName: 'X' }), 403);
  });
});

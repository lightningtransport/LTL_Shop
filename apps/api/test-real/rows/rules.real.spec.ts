import { beforeEach, describe, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  USERS, Json, admin, adminWo, as, catalogJob, createWo, inspect, laneJob, manager, meta, namedJob, ok, plannedWo,
  prisma, refused, resetDb, same, truck, truthy, userId,
} from '../harness';

describe('Reglas: Custom Jobs y permisos', () => {
  beforeEach(resetDb);

  it('A24 | Custom Job: agregar y duplicados (la revisión no existe: defecto #3)', async () => {
    const { truck: row, workOrderId } = await createWo('905');
    await inspect(row.id, 'issues_found');
    const category = await prisma.jobCategory.findFirstOrThrow({ where: { name: 'Electrical & Starting' } });
    const add = async (displayName: string) => manager.post(`/admin/trucks/${row.id}/work-plan/jobs`, {
      ...(await meta(workOrderId)),
      jobs: [{ categoryId: category.id, displayName, customDescription: 'Cable pelado bajo el tablero.' }],
    });
    ok('agregar Custom Job', await add('Reparar cable del tablero'));
    const job = namedJob(await adminWo(workOrderId), 'Reparar cable del tablero');
    same('sin Job de catálogo', job.catalogJobId, null);
    const stored = await prisma.workOrderJob.findUniqueOrThrow({ where: { id: job.id } });
    same('queda pendiente de revisión', stored.reviewStatus, 'pending_review');
    refused('mismo nombre (normalizado) no se repite', await add('  reparar CABLE del tablero '), 400);

    const lights = await catalogJob('Electrical & Starting', 'Lights');
    const addLights = async () => manager.post(`/admin/trucks/${row.id}/work-plan/jobs`, {
      ...(await meta(workOrderId)),
      jobs: [{ catalogJobId: lights.id, categoryId: lights.categoryId, displayName: lights.displayName }],
    });
    ok('agregar Job de catálogo', await addLights());
    refused('un Job de catálogo no se repite en el WO', await addLights(), 400);
  });

  it('A26 | Permisos: mecánico 403 en crear/pausar/agregar/terminar; Manager 403 en escrituras de System Admin', async () => {
    const { truck: row, workOrderId } = await plannedWo('922');
    const free = await truck('931');
    const mechanic = as(USERS.alignment);
    const lights = await catalogJob('Electrical & Starting', 'Lights');
    const standardCategory = lights.categoryId;

    refused('mecánico: entrar a Admin', await mechanic.get('/admin/dashboard'), 403);
    refused('mecánico: crear WO (Admin)', await mechanic.post('/admin/work-orders', { truckId: free.id, idempotencyKey: randomUUID() }), 403);
    refused('mecánico: crear WO Standard', await mechanic.post('/work-orders', { truckId: free.id, primaryCategoryId: standardCategory, idempotencyKey: randomUUID() }), 403);
    refused('mecánico Standard: crear PM', await mechanic.post('/work-orders', { truckId: free.id, primaryCategoryId: (await prisma.jobCategory.findFirstOrThrow({ where: { name: 'PM' } })).id, idempotencyKey: randomUUID() }), 403);
    refused('mecánico: pausar', await mechanic.post(`/work-orders/${workOrderId}/pause`, { reason: 'break' }), 403);
    refused('mecánico: agregar Job', await mechanic.post(`/work-orders/${workOrderId}/jobs`, { categoryId: standardCategory, catalogJobId: lights.id, displayName: 'Lights', ...(await meta(workOrderId)) }), 403);
    refused('mecánico: terminar el WO', await mechanic.post(`/work-orders/${workOrderId}/complete`), 403);
    refused('mecánico: registrar inspección', await mechanic.post(`/admin/trucks/${row.id}/work-plan/inspection`, { outcome: 'no_issues_found', idempotencyKey: randomUUID() }), 403);
    refused('mecánico PM: completar un Job Standard', await as(USERS.pm).post(`/work-orders/${workOrderId}/jobs/${laneJob(await adminWo(workOrderId), 'alignment').id}/complete`, {}), 403);

    const newMechanic = { name: 'Prueba', email: `prueba-${Date.now()}@lightning.local`, workspace: 'standard' };
    refused('Manager: crear mecánico', await manager.post('/admin/mechanics', newMechanic), 403);
    refused('Manager: editar mecánico', await manager.patch(`/admin/mechanics/${await userId(USERS.spare)}`, { active: true }), 403);
    refused('Manager: crear Job de catálogo', await manager.post('/admin/catalog/jobs', { categoryId: standardCategory, displayName: 'Prueba' }), 403);
    refused('Manager: editar Job de catálogo', await manager.patch(`/admin/catalog/jobs/${lights.id}`, { displayName: 'Lights' }), 403);

    const asAdmin = await admin.patch(`/admin/catalog/jobs/${lights.id}`, { displayName: 'Lights' });
    truthy('System Admin sí puede escribir el catálogo', asAdmin.status !== 403, asAdmin);
    const users = await prisma.user.findMany({ where: { active: true }, include: { capabilities: true } });
    same('ningún usuario activo sin capabilities', users.filter((user) => !user.capabilities.length).map((user) => user.email), []);
    const reads = ok('Manager: leer roster', await manager.get('/admin/mechanics?assignable=true'));
    truthy('el selector de mecánicos no lista cuentas admin', (reads.items ?? reads as Json[]).every((item: Json) => item.role !== 'admin'), reads);
  });

  it.skip('A27 | NO APLICA: login de Supabase, reset de contraseña, idioma, tema y app instalada son de la web (se prueban en el navegador)', () => {});
});

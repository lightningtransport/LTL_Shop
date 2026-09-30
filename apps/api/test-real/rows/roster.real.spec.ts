/**
 * HU-M9 (D22, LTR-187): the Manager creates the people of the shop, deactivates and reactivates
 * them, and resets a lost temporary password. Locally the API has no Supabase service key, so
 * no access account is created (`temporaryPassword: null`) and reset answers AUTH_ACCOUNT_MISSING.
 */
import { afterAll, beforeEach, describe, it } from 'vitest';
import {
  USERS, Json, adminCompleteJob, adminWo, as, assign, laneJob, manager, ok, plannedWo, prisma, refused, resetDb, same, start, truthy, userId,
} from '../harness';

const RUN = Date.now();
const email = (tag: string) => `d22-${tag}-${RUN}@lightning.local`;

async function createPerson(tag: string, mode: 'standard' | 'pm' | 'safety', actor = manager) {
  return actor.post('/admin/mechanics', { name: `D22 ${tag}`, email: email(tag), mode });
}

async function roster(query = '') {
  return ok('leer roster', await manager.get(`/admin/mechanics?limit=100${query}`)).items as Json[];
}

async function assignable() {
  return ok('leer asignables', await manager.get('/admin/mechanics?assignable=true&limit=100')).items as Json[];
}

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { contains: `-${RUN}@lightning.local` } } });
}

describe('Manager: dar de alta al personal (HU-M9, D22)', () => {
  beforeEach(resetDb);
  afterAll(cleanup);

  it('A29 | Crear Standard, PM y Safety: entran al roster con su tipo; correo repetido y mecánico no pueden; Safety solo es dueño del QC', async () => {
    const standard = ok('crear Standard', await createPerson('std', 'standard'));
    const pm = ok('crear PM', await createPerson('pm', 'pm'));
    const safety = ok('crear Safety', await createPerson('safety', 'safety'));
    for (const [label, created, capability] of [
      ['Standard', standard, 'mechanic.standard'],
      ['PM', pm, 'mechanic.pm'],
      ['Safety', safety, 'quality_check.perform'],
    ] as const) {
      same(`${label}: rol mecánico y activo`, [created.role, created.active], ['mechanic', true]);
      same(`${label}: una sola capacidad`, created.capabilities, [capability]);
      same(`${label}: sin cuenta de acceso en este entorno`, created.temporaryPassword, null);
    }

    refused('correo repetido (misma mayúscula o no)', await manager.post('/admin/mechanics', { name: 'Otro', email: email('std').toUpperCase(), mode: 'pm' }), 409, 'MECHANIC_EMAIL_EXISTS');
    refused('correo del Manager', await manager.post('/admin/mechanics', { name: 'Otro', email: USERS.manager, mode: 'standard' }), 409, 'MECHANIC_EMAIL_EXISTS');
    refused('tipo desconocido', await manager.post('/admin/mechanics', { name: 'Otro', email: email('bad'), mode: 'boss' }), 400);
    refused('un mecánico no crea personal', await createPerson('by-mech', 'standard', as(USERS.general)), 403);
    refused('Safety no crea personal', await createPerson('by-safety', 'standard', as(USERS.safety)), 403);
    const byAdmin = ok('el System Admin sigue pudiendo', await createPerson('by-admin', 'standard', as(USERS.admin)));
    same('System Admin: tipo Standard', byAdmin.capabilities, ['mechanic.standard']);

    const list = await roster();
    const ids = list.map((item) => item.id);
    truthy('los tres aparecen en el roster', [standard.id, pm.id, safety.id].every((id) => ids.includes(id)), ids.length);
    const pickers = await assignable().then((items) => items.map((item) => item.id));
    truthy('Standard y PM salen en los pickers de Jobs', pickers.includes(standard.id) && pickers.includes(pm.id));
    truthy('Safety no sale en los pickers de Jobs', !pickers.includes(safety.id));

    // Owner rules: Safety owns the Quality Check and nothing else; PM owns the PM step; Standard the rest.
    const { workOrderId } = await plannedWo('905', [{ category: 'Electrical & Starting', job: 'Lights' }]);
    const wo = await adminWo(workOrderId);
    const qcJob = laneJob(wo, 'quality_check');
    const pmJob = laneJob(wo, 'pm');
    const lights = (wo.jobs as Json[]).find((job) => job.displayName === 'Lights');
    ok('el Safety nuevo puede ser dueño del QC', await assign(workOrderId, qcJob.id, email('safety')));
    refused('el Standard nuevo no puede ser dueño del QC', await assign(workOrderId, qcJob.id, email('std')), 400, 'QC_OWNER_MUST_BE_SAFETY');
    refused('el Safety nuevo no toma Jobs de mecánico', await assign(workOrderId, lights.id, email('safety')), 400);
    ok('el PM nuevo puede ser dueño del paso PM', await assign(workOrderId, pmJob.id, email('pm')));
    ok('el Standard nuevo toma un Job Standard', await assign(workOrderId, lights.id, email('std')));

    const queue = ok('cola de Safety con la cuenta nueva', await as(email('safety')).get('/qc/queue'));
    truthy('el Safety nuevo entra a su cola', Array.isArray(queue.pending));
    refused('el Safety nuevo no entra a Admin', await as(email('safety')).get('/admin/dashboard'), 403);
  });

  it('A30 | Desactivar: no deja con Jobs pendientes o tiempo corriendo (dice qué reasignar); sin trabajo abierto deja de entrar y de aparecer; reactivar', async () => {
    const person = ok('crear Standard', await createPerson('deact', 'standard'));
    const personEmail = email('deact');
    const { workOrderId } = await plannedWo('922', [{ category: 'Electrical & Starting', job: 'Lights', assignee: personEmail }]);
    const wo = await adminWo(workOrderId);
    const lights = (wo.jobs as Json[]).find((job) => job.displayName === 'Lights');

    const withJob = await manager.patch(`/admin/mechanics/${person.id}`, { active: false });
    refused('con un Job pendiente no deja', withJob, 409, 'MECHANIC_HAS_OPEN_WORK');
    same('dice qué reasignar', withJob.json.pendingJobs.map((job: Json) => [job.workOrderDisplayId, job.truckNumber, job.jobDisplayName]), [[wo.displayId, '922', 'Lights']]);
    same('sin tiempo corriendo todavía', withJob.json.runningSession, false);

    ok('la persona hace Start', await start(personEmail, workOrderId));
    const withClock = await manager.patch(`/admin/mechanics/${person.id}`, { active: false });
    refused('con el reloj corriendo tampoco deja', withClock, 409, 'MECHANIC_HAS_OPEN_WORK');
    same('dice que hay tiempo corriendo', [withClock.json.pendingJobs.length, withClock.json.runningSession], [1, true]);
    ok('el Manager completa el Job por ella', await adminCompleteJob(workOrderId, lights.id));
    // D18: her clock stops with her last Job; if a session were still open, closing it is a time correction.
    await prisma.workSession.updateMany({ where: { userId: person.id, endedAt: null }, data: { endedAt: new Date() } });

    const deactivated = ok('sin trabajo abierto sí deja', await manager.patch(`/admin/mechanics/${person.id}`, { active: false }));
    same('queda inactiva', deactivated.active, false);
    refused('ya no entra', await as(personEmail).get('/auth/me'), 403);
    truthy('no aparece para asignar', !(await assignable()).some((item) => item.id === person.id));
    truthy('no aparece en el roster normal', !(await roster()).some((item) => item.id === person.id));
    truthy('sí aparece con "mostrar inactivos"', (await roster('&includeInactive=true')).some((item) => item.id === person.id));
    const second = await plannedWo('931', [{ category: 'Electrical & Starting', job: 'Lights' }]);
    const secondLights = ((await adminWo(second.workOrderId)).jobs as Json[]).find((job) => job.displayName === 'Lights');
    refused('no se le puede asignar un Job', await assign(second.workOrderId, secondLights.id, personEmail), 400);
    const history = await prisma.workOrderJob.count({ where: { completedAt: { not: null }, assignedMechanicId: person.id } });
    same('su historial se conserva', history, 1);

    const reactivated = ok('reactivar no tiene regla', await manager.patch(`/admin/mechanics/${person.id}`, { active: true }));
    same('vuelve a estar activa', reactivated.active, true);
    ok('vuelve a entrar', await as(personEmail).get('/auth/me'));
    truthy('vuelve a aparecer para asignar', (await assignable()).some((item) => item.id === person.id));
    refused('un mecánico no desactiva a nadie', await as(USERS.general).patch(`/admin/mechanics/${person.id}`, { active: false }), 403);
  });

  it('A31 | Reiniciar contraseña: sin cuenta de acceso la app lo dice (AUTH_ACCOUNT_MISSING); solo Manager o System Admin', async () => {
    const person = ok('crear PM', await createPerson('reset', 'pm'));
    refused('sin cuenta de Supabase en este entorno', await manager.post(`/admin/mechanics/${person.id}/reset-password`), 409, 'AUTH_ACCOUNT_MISSING');
    refused('un mecánico no reinicia contraseñas', await as(USERS.general).post(`/admin/mechanics/${person.id}/reset-password`), 403);
    refused('no se reinicia la del Manager', await manager.post(`/admin/mechanics/${await userId(USERS.manager)}/reset-password`), 404);
    refused('id inventado', await manager.post('/admin/mechanics/not-a-uuid/reset-password'), 400);
  });
});

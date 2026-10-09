/**
 * LTR-199 / D31: People — Remove from Shop keeps the history; a real delete only for someone who never did
 * anything; a person's queue Jobs go back to their team queue; a type change waits until their Jobs move (D-SET3).
 * Each row uses people it creates, so the seeded roster is untouched.
 */
import { afterAll, beforeEach, describe, it } from 'vitest';
import {
  Json, adminWo, as, laneJob, manager, ok, plannedWo, prisma, refused, resetDb, same, start, truthy,
} from '../harness';

const RUN = Date.now();
const email = (tag: string) => `d31-${tag}-${RUN}@lightning.local`;

async function createPerson(tag: string, mode: 'standard' | 'pm' | 'safety') {
  return ok(`crear ${tag}`, await manager.post('/admin/mechanics', { name: `D31 ${tag}`, email: email(tag), mode }));
}

async function roster(query = '') {
  return ok('leer personas', await manager.get(`/admin/mechanics?limit=100${query}`)).items as Json[];
}

async function setTeam(stepKey: string, memberIds: string[]) {
  ok(`equipo de ${stepKey}`, await manager.put('/admin/setup/workflow-steps', { steps: [{ stepKey, memberIds }] }));
}

async function cleanup() {
  await resetDb();
  const people = await prisma.user.findMany({ where: { email: { contains: `-${RUN}@lightning.local` } }, select: { id: true } });
  const ids = people.map((person) => person.id);
  await prisma.workOrderJob.updateMany({ where: { assignedMechanicId: { in: ids } }, data: { assignedMechanicId: null } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
}

describe('Manager: personas del Shop (D31)', () => {
  beforeEach(resetDb);
  afterAll(cleanup);

  it('A49 | Quitar del Shop a alguien sin trabajo: no entra, sale de las listas y de los equipos; su nombre sigue en el historial', async () => {
    const person = await createPerson('quitar', 'standard');
    await setTeam('detailing', [person.id]);
    const { workOrderId } = await plannedWo('905');
    const job = laneJob(await adminWo(workOrderId), 'detailing');
    same('el Job nace a su nombre', job.assignedMechanic?.id, person.id);
    ok('Start', await start(email('quitar'), workOrderId));
    ok('completa su Job', await as(email('quitar')).post(`/work-orders/${workOrderId}/jobs/${job.id}/complete`, {}));

    ok('quitar del Shop', await manager.post(`/admin/mechanics/${person.id}/remove`));
    refused('ya no entra', await as(email('quitar')).get('/auth/me'), 403);
    truthy('no está en la lista', !(await roster()).some((item) => item.id === person.id));
    truthy('ni con los inactivos', !(await roster('&includeInactive=true')).some((item) => item.id === person.id));
    truthy('sí con el filtro de quitadas', (await roster('&status=removed')).some((item) => item.id === person.id && item.removedAt));
    same('salió del equipo de Detailing', (ok('pasos', await manager.get('/admin/setup/workflow-steps')) as Json[]).find((step) => step.stepKey === 'detailing')?.members.length, 0);
    same('su nombre sigue en el Job que completó', laneJob(await adminWo(workOrderId), 'detailing').completedBy?.id, person.id);
    refused('no se la puede reactivar', await manager.patch(`/admin/mechanics/${person.id}`, { active: true }), 409, 'PERSON_REMOVED');
  });

  it('A50 | Quitar con trabajo pendiente: se niega con la lista; después de mandar sus Jobs a la cola del equipo, se puede', async () => {
    const first = await createPerson('cola-a', 'standard');
    const second = await createPerson('cola-b', 'standard');
    await setTeam('detailing', [first.id, second.id]);
    const { workOrderId } = await plannedWo('922');
    const job = laneJob(await adminWo(workOrderId), 'detailing');
    ok('A toma el Job de la cola', await as(email('cola-a')).post(`/team-queue/${job.id}/take`));

    const detail = ok('detalle', await manager.get(`/admin/mechanics/${first.id}`));
    same('el detalle ya trae el Job y su paso', detail.pendingJobs.map((item: Json) => [item.jobId, item.workflowStepKey]), [[job.id, 'detailing']]);
    refused('quitar con trabajo', await manager.post(`/admin/mechanics/${first.id}/remove`), 409, 'MECHANIC_HAS_OPEN_WORK');

    same('mandar a la cola', ok('a la cola', await manager.post(`/admin/mechanics/${first.id}/send-to-queue`, {})), { sent: 1, skipped: 0 });
    same('vuelve sin dueño a la cola', laneJob(await adminWo(workOrderId), 'detailing').assignedMechanic, null);
    truthy('B lo ve en su cola', (ok('cola de B', await as(email('cola-b')).get('/team-queue')) as Json[]).some((item) => item.jobId === job.id));
    ok('ahora sí se quita', await manager.post(`/admin/mechanics/${first.id}/remove`));
  });

  it('A51 | Borrar: solo a alguien que nunca hizo nada; con historial se niega y pide quitar del Shop', async () => {
    const mistake = await createPerson('error', 'pm');
    same('el detalle ofrece borrar', ok('detalle', await manager.get(`/admin/mechanics/${mistake.id}`)).canDelete, true);
    ok('borrar', await manager.del(`/admin/mechanics/${mistake.id}`));
    same('ya no existe', await prisma.user.count({ where: { id: mistake.id } }), 0);

    const worker = await createPerson('historia', 'standard');
    await setTeam('detailing', [worker.id]);
    await plannedWo('931');
    same('con un Job ya no se ofrece borrar', ok('detalle', await manager.get(`/admin/mechanics/${worker.id}`)).canDelete, false);
    refused('con historial no se borra', await manager.del(`/admin/mechanics/${worker.id}`), 409, 'PERSON_HAS_HISTORY');
    refused('un mecánico no quita ni borra a nadie', await as(email('historia')).post(`/admin/mechanics/${worker.id}/remove`), 403);
  });

  it('A52 | Cambiar de tipo: con Jobs pendientes se niega; sin Jobs, sale de los equipos que ya no puede hacer', async () => {
    const person = await createPerson('tipo', 'standard');
    await setTeam('detailing', [person.id]);
    const { workOrderId } = await plannedWo('968');
    refused('con su Job de Detailing no cambia a PM', await manager.patch(`/admin/mechanics/${person.id}`, { mode: 'pm' }), 409, 'MECHANIC_HAS_OPEN_WORK');
    const job = laneJob(await adminWo(workOrderId), 'detailing');
    await prisma.workOrderJob.update({ where: { id: job.id }, data: { assignedMechanicId: null } });
    ok('sin Jobs sí cambia', await manager.patch(`/admin/mechanics/${person.id}`, { mode: 'pm' }));
    same('salió del equipo de Detailing', (ok('pasos', await manager.get('/admin/setup/workflow-steps')) as Json[]).find((step) => step.stepKey === 'detailing')?.members.length, 0);
  });
});

import { beforeEach, describe, it } from 'vitest';
import {
  USERS, Json, adminWo, as, assign, unassign, createWo, doLane, doPm, laneJob, manager, ok, plannedWo, prisma, refused, resetDb, same,
  sameNextStepEverywhere, start, truthy, userId,
} from '../harness';

const teamQueue = async (email: string) => ok(`cola de ${email}`, await as(email).get('/team-queue')) as Json[];
const take = (email: string, jobId: string) => as(email).post(`/team-queue/${jobId}/take`);
const release = (email: string, jobId: string) => as(email).post(`/team-queue/${jobId}/release`);
const steps = async () => ok('leer Shop workflow', await manager.get('/admin/setup/workflow-steps')) as Json[];

async function detailingTeam(emails: string[]) {
  ok('equipo de Detailing', await manager.put('/admin/setup/workflow-steps', {
    steps: [{ stepKey: 'detailing', memberIds: await Promise.all(emails.map((email) => userId(email))) }],
  }));
}

/** LTR-197 / D28, D29: Shop workflow teams, the team queue, and the Manager in Quality Check. */
describe('Manager: equipos por paso y cola (D28, D29)', () => {
  beforeEach(resetDb);

  it('A41 | Equipo de 3 en Detailing: el Job nace en la cola; el primero que lo toma es el dueño; los otros ya no pueden; soltarlo lo devuelve', async () => {
    await detailingTeam([USERS.detailing, USERS.spare, USERS.general]);
    const detailing = (await steps()).find((step) => step.stepKey === 'detailing');
    same('el paso dice "cola"', [detailing?.assignment, detailing?.members.length], ['queue', 3]);

    const { truck, workOrderId } = await plannedWo('905');
    const job = laneJob(await adminWo(workOrderId), 'detailing');
    same('nace sin dueño', job.assignedMechanic, null);
    same('nace en la cola de Detailing', job.workflowStepKey, 'detailing');
    for (const email of [USERS.detailing, USERS.spare, USERS.general]) {
      truthy(`${email} lo ve en su cola`, (await teamQueue(email)).some((item) => item.jobId === job.id));
    }
    same('alguien fuera del equipo no lo ve', (await teamQueue(USERS.alignment)).length, 0);
    // A queued Job is not "unassigned": the next step stays on the Work Order's own flow.
    await sameNextStepEverywhere('Job en la cola del equipo', workOrderId, truck.id, 'work');

    refused('alguien fuera del equipo no puede tomar', await take(USERS.alignment, job.id), 403, 'NOT_ON_STEP_TEAM');
    ok('John lo toma', await take(USERS.spare, job.id));
    same('es de John', laneJob(await adminWo(workOrderId), 'detailing').assignedMechanic?.id, await userId(USERS.spare));
    refused('Anthony llega tarde', await take(USERS.detailing, job.id), 409, 'JOB_ALREADY_TAKEN');
    same('ya no está en la cola de nadie', (await teamQueue(USERS.general)).length, 0);
    const taken = await prisma.activityLog.count({ where: { entityId: job.id, relevantValue: { path: ['action'], equals: 'job_taken_from_team_queue' } } });
    same('queda en el Activity Log', taken, 1);

    ok('John lo suelta', await release(USERS.spare, job.id));
    same('vuelve a la cola sin dueño', laneJob(await adminWo(workOrderId), 'detailing').assignedMechanic, null);
    truthy('Anthony lo vuelve a ver', (await teamQueue(USERS.detailing)).some((item) => item.jobId === job.id));

    ok('Anthony lo toma', await take(USERS.detailing, job.id));
    ok('Anthony hace Start', await start(USERS.detailing, workOrderId));
    refused('con su reloj corriendo no lo puede soltar', await release(USERS.detailing, job.id), 409, 'JOB_RELEASE_CLOCK_RUNNING');
  });

  it('A42 | Equipo de 1: el Job nace asignado a esa persona, como antes', async () => {
    await detailingTeam([USERS.spare]);
    same('el paso dice "directo"', (await steps()).find((step) => step.stepKey === 'detailing')?.assignment, 'direct');
    const { workOrderId } = await createWo('922');
    const job = laneJob(await adminWo(workOrderId), 'detailing');
    same('asignado a John', job.assignedMechanic?.id, await userId(USERS.spare));
    same('sin cola', job.workflowStepKey ?? null, null);
    refused('no se puede soltar a una cola que no existe', await release(USERS.spare, job.id), 400, 'JOB_NOT_IN_TEAM_QUEUE');
  });

  it('A43 | Equipo vacío o con alguien que ya no puede: el Job nace sin dueño y el Manager lo ve para asignar; guardar no se bloquea', async () => {
    await detailingTeam([]);
    same('el paso dice "nadie"', (await steps()).find((step) => step.stepKey === 'detailing')?.assignment, 'none');
    const { truck, workOrderId } = await plannedWo('931');
    const job = laneJob(await adminWo(workOrderId), 'detailing');
    same('sin dueño y sin cola', [job.assignedMechanic, job.workflowStepKey ?? null], [null, null]);
    await sameNextStepEverywhere('paso sin equipo', workOrderId, truck.id, 'assign');
    ok('el Manager lo asigna directo', await assign(workOrderId, job.id, USERS.spare));

    // D-SET2: changing type takes the person off the teams they can no longer be on.
    await detailingTeam([USERS.spare]);
    const spare = await userId(USERS.spare);
    // LTR-199 / D-SET3: not while John still has that Job; once it moves, the type can change.
    refused('con un Job pendiente no cambia de tipo', await manager.patch(`/admin/mechanics/${spare}`, { mode: 'pm' }), 409, 'MECHANIC_HAS_OPEN_WORK');
    ok('el Manager le quita el Job', await unassign(workOrderId, job.id));
    ok('John pasa a PM', await manager.patch(`/admin/mechanics/${spare}`, { mode: 'pm' }));
    try {
      same('John sale del equipo de Detailing', (await steps()).find((step) => step.stepKey === 'detailing')?.members.length, 0);
      ok('el resto de los pasos se sigue guardando', await manager.put('/admin/setup/workflow-steps', {
        steps: [{ stepKey: 'alignment', memberIds: [await userId(USERS.alignment), await userId(USERS.general)] }],
      }));
    } finally {
      await manager.patch(`/admin/mechanics/${spare}`, { mode: 'standard' });
    }
  });

  it('A44 | El paso de PM: equipo de mecánicos de PM; nace con PM A y el mecánico sigue eligiendo A o B', async () => {
    const pm = (await steps()).find((step) => step.stepKey === 'pm');
    same('solo mecánicos de PM', pm?.requiredCapability, 'mechanic.pm');
    refused('un Standard no entra al equipo de PM', await manager.put('/admin/setup/workflow-steps', {
      steps: [{ stepKey: 'pm', memberIds: [await userId(USERS.pm), await userId(USERS.spare)] }],
    }), 400, 'OWNER_NOT_ELIGIBLE');
    const { workOrderId } = await createWo('968');
    const job = laneJob(await adminWo(workOrderId), 'pm');
    same('PM A por defecto, de Daniel', [job.displayName, job.assignedMechanic?.id], ['PM A Service', await userId(USERS.pm)]);
    const pmB = await prisma.catalogJob.findFirstOrThrow({ where: { displayName: 'PM B Service', category: { name: 'PM' } } });
    ok('Daniel lo cambia a PM B', await as(USERS.pm).post(`/work-orders/${workOrderId}/jobs/${job.id}/pm-service`, { catalogJobId: pmB.id }));
    same('ahora es PM B', laneJob(await adminWo(workOrderId), 'pm').displayName, 'PM B Service');
  });

  it('QC11 | El Manager hace QC como respaldo en la pantalla de Safety: toma y aprueba a su nombre; Safety fuera del equipo no ve la cola; un mecánico sigue sin entrar', async () => {
    const planned = await plannedWo('973');
    await doPm(planned.workOrderId, planned.truck.id);
    await doLane(USERS.alignment, planned.workOrderId, 'alignment');
    await doLane(USERS.detailing, planned.workOrderId, 'detailing');

    const list = ok('el Manager ve la cola', await manager.get('/qc/queue'));
    truthy('con el camión listo', (list.pending as Json[]).some((item) => item.workOrderId === planned.workOrderId));
    ok('el Manager lo toma', await manager.post(`/qc/${planned.workOrderId}/take`));
    ok('y lo aprueba', await manager.post(`/qc/${planned.workOrderId}/approve`));
    const qc = laneJob(await adminWo(planned.workOrderId), 'quality_check');
    same('QC completo a nombre del Manager', [qc.status, qc.completedBy?.id], ['completed', await userId(USERS.manager)]);
    const approved = await prisma.activityLog.findFirst({ where: { entityId: qc.id, relevantValue: { path: ['action'], equals: 'quality_check_approved' } } });
    same('queda como respaldo', (approved?.relevantValue as Json)?.actor, 'manager_backup');

    // D-SET7: Safety works the queue only while on Quality Check's team.
    ok('QC solo con Safety 1', await manager.put('/admin/setup/workflow-steps', { steps: [{ stepKey: 'quality_check', memberIds: [await userId(USERS.safety)] }] }));
    const outside = ok('Safety 2 fuera del equipo', await as(USERS.safety2).get('/qc/queue'));
    same('no ve nada y la app lo dice', [outside.pending.length, outside.onTeam], [0, false]);
    refused('un mecánico no entra a la lista de Safety', await as(USERS.general).get('/qc/queue'), 403);
  });
});

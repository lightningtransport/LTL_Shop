/**
 * HU-ME5 (D20, LTR-186): the mechanic's day closes by itself at the shop's day close (5:00 p.m.
 * Monday–Friday by default) and the time counts to the cutoff, not to whenever someone looks.
 * The Manager changes the hours in Setup. One clock per mechanic (D21) is row E7 (edge-cases).
 *
 * A session "from yesterday" is a real Start whose started_at is moved back with Prisma.
 */
import { beforeEach, describe, inject, it } from 'vitest';
import { addLocalDays, isoWeekday, localDateTimeIn, SHOP_TIME_ZONE, zonedTimeToUtc, type LocalDate } from '../../src/common/shop-time';
import { REAL_CRON_SECRET } from '../env';
import {
  USERS, Json, adminWo, as, laneJob, manager, admin, mechanicWo, meta, ok, plannedWo, prisma, refused, resetDb, same, sessionsOf, start, truthy, helpOn,
} from '../harness';

const today = (): LocalDate => {
  const now = localDateTimeIn(new Date(), SHOP_TIME_ZONE);
  return { year: now.year, month: now.month, day: now.day };
};

/** The most recent day before today that matches. */
function lastDay(match: (day: LocalDate) => boolean): LocalDate {
  for (let back = 1; back <= 8; back += 1) {
    const day = addLocalDays(today(), -back);
    if (match(day)) return day;
  }
  throw new Error('no such day in the last week');
}

const lastWorkday = () => lastDay((day) => isoWeekday(day) <= 5);
const lastFriday = () => lastDay((day) => isoWeekday(day) === 5);
const lastSaturday = () => lastDay((day) => isoWeekday(day) === 6);
const at = (day: LocalDate, hour: number, minute = 0) => zonedTimeToUtc(SHOP_TIME_ZONE, day, hour * 60 + minute);
const endOfDay = (day: LocalDate) => new Date(zonedTimeToUtc(SHOP_TIME_ZONE, addLocalDays(day, 1), 0).getTime() - 1);

/** Move the mechanic's running clock back to `startedAt` (as if they started then and went home). */
async function backdateOpenClock(email: string, startedAt: Date) {
  const open = (await sessionsOf(email)).filter((session) => session.endedAt === null);
  same(`${email} tiene un reloj corriendo`, open.length, 1);
  await prisma.workSession.update({ where: { id: open[0].id }, data: { startedAt } });
  return open[0].id;
}

async function session(id: string) {
  return prisma.workSession.findUniqueOrThrow({ where: { id }, select: { endedAt: true, endReason: true } });
}

function cron(authorization?: string) {
  return fetch(`${inject('apiUrl')}/api/internal/day-close`, {
    headers: authorization ? { Authorization: authorization } : {},
  });
}

describe('El día del mecánico se cierra solo (HU-ME5, D20)', () => {
  beforeEach(resetDb);

  it('A32 | Cierre del día: el reloj se cierra a las 5:00 p.m. (no a la hora en que alguien mira), el viernes no corre el fin de semana, fuera de horario a las 11:59 p.m., y al día siguiente "toca Continue"', async () => {
    const { workOrderId } = await plannedWo('905', [{ category: 'Electrical & Starting', job: 'Lights', assignee: USERS.general }]);
    ok('Start alignment', await start(USERS.alignment, workOrderId));
    // D57 §3: the others help on Alignment (D23) so the three clocks run on one truck.
    await helpOn(USERS.detailing, workOrderId, 'Alignment');
    await helpOn(USERS.general, workOrderId, 'Alignment');
    ok('Start detailing (ayudante)', await start(USERS.detailing, workOrderId));
    ok('Start general (ayudante)', await start(USERS.general, workOrderId));

    const workday = lastWorkday();
    const friday = lastFriday();
    const yesterday = await backdateOpenClock(USERS.alignment, at(workday, 14));
    const fromFriday = await backdateOpenClock(USERS.detailing, at(friday, 15));
    const afterHours = await backdateOpenClock(USERS.general, at(workday, 18));

    // Nobody opened the app at 5:00 p.m.; the first read today closes them with the cutoff time.
    const list = ok('el mecánico abre su inicio', await as(USERS.alignment).get('/work-orders?mode=standard'));
    same('ayer: cuenta hasta las 5:00 p.m.', await session(yesterday), { endedAt: at(workday, 17), endReason: 'day_close' });
    same('el viernes: cuenta hasta el viernes a las 5:00 p.m., no el fin de semana', await session(fromFriday), { endedAt: at(friday, 17), endReason: 'day_close' });
    same('arrancó después de las 5:00 p.m.: se cierra a las 11:59 p.m. de ese día', await session(afterHours), { endedAt: endOfDay(workday), endReason: 'day_close' });

    const card = [...list.active, ...list.created].find((item: Json) => item.id === workOrderId);
    same('su inicio dice "Ayer quedó en curso · toca Continue"', card?.myClockStopped, { reason: 'day_close' });
    const detail = await mechanicWo(USERS.alignment, workOrderId);
    same('el detalle: su reloj no corre y lo recuerda', [detail.laborRunning, detail.myClockStopped], [false, { reason: 'day_close' }]);

    const admin1 = await adminWo(workOrderId);
    const segment = admin1.laborSessions.find((item: Json) => item.id === yesterday);
    same('el Admin ve "cierre del día" y 3 horas (14:00 → 17:00)', [segment.endReason, segment.durationMs], ['day_close', 3 * 3600_000]);
    same('el WO sigue en curso y el Job sigue pendiente', [admin1.status, laneJob(admin1, 'alignment').status], ['in_progress', 'to_do']);

    // Left at 4:00 p.m.: the Manager corrects the segment; it still reads "day close".
    ok('el Manager corrige el tramo (se fue a las 4:00)', await manager.post('/admin/time-corrections', {
      ...(await meta(workOrderId)), workOrderId, targetType: 'work_session', targetId: yesterday,
      reason: 'Se fue a las 4:00.', startedAt: at(workday, 14).toISOString(), endedAt: at(workday, 16).toISOString(),
    }));
    const corrected = (await adminWo(workOrderId)).laborSessions.find((item: Json) => item.id === yesterday);
    same('queda 2 horas y sigue diciendo "cierre del día"', [corrected.durationMs, corrected.endReason], [2 * 3600_000, 'day_close']);

    ok('al día siguiente toca Continue', await start(USERS.alignment, workOrderId));
    const resumed = await mechanicWo(USERS.alignment, workOrderId);
    same('su reloj vuelve a correr y el aviso se va', [resumed.laborRunning, resumed.myClockStopped], [true, null]);

    // Started on a Saturday (not a workday): closes at 11:59 p.m. that Saturday. The Vercel Cron backstop closes it.
    ok('general Continue', await start(USERS.general, workOrderId));
    const saturday = await backdateOpenClock(USERS.general, at(lastSaturday(), 10));
    if (inject('ownsApi')) {
      same('cron sin secreto: rechazado', (await cron()).status, 401);
      same('cron con otro secreto: rechazado', (await cron('Bearer otro')).status, 401);
      const first = await cron(`Bearer ${REAL_CRON_SECRET}`);
      same('cron con el secreto: corre', first.status, 200);
      truthy('cerró el reloj del sábado', ((await first.json()) as Json).closedSessions >= 1);
      same('cron otra vez: no cierra nada (idempotente)', ((await (await cron(`Bearer ${REAL_CRON_SECRET}`)).json()) as Json).closedSessions, 0);
    } else {
      ok('leer (cierre perezoso)', await as(USERS.general).get('/work-orders?mode=standard'));
    }
    same('sábado: se cierra a las 11:59 p.m. de ese día', await session(saturday), { endedAt: endOfDay(lastSaturday()), endReason: 'day_close' });
    same('el reloj de alignment (de hoy) sigue corriendo', (await sessionsOf(USERS.alignment)).filter((item) => item.endedAt === null).length, 1);
  });

  it('A33 | Horario del taller en Setup: el Manager (o el System Admin) cambia la hora y los días; aplica desde ese momento; los demás roles no pueden; datos inválidos no', async () => {
    same('por defecto 5:00 p.m., lunes a viernes', (({ cutoff, workdays, timeZone }) => ({ cutoff, workdays, timeZone }))(ok('leer horario', await manager.get('/admin/setup/shop-hours'))), {
      cutoff: '17:00', workdays: [1, 2, 3, 4, 5], timeZone: 'America/New_York',
    });
    const saved = ok('el Manager cambia a 6:30 p.m.', await manager.put('/admin/setup/shop-hours', { cutoff: '18:30', workdays: [1, 2, 3, 4, 5] }));
    same('queda guardado con quién lo cambió', [saved.cutoff, saved.updatedBy?.name ? 'ok' : null], ['18:30', 'ok']);
    same('se lee igual', ok('leer horario', await manager.get('/admin/setup/shop-hours')).cutoff, '18:30');
    truthy('queda en el Activity Log', await prisma.activityLog.findFirst({ where: { entityType: 'shop_settings' }, orderBy: { createdAt: 'desc' } }));

    refused('un mecánico no lo cambia', await as(USERS.alignment).put('/admin/setup/shop-hours', { cutoff: '16:00', workdays: [1] }), 403);
    refused('un mecánico no lo lee (no es Admin)', await as(USERS.alignment).get('/admin/setup/shop-hours'), 403);
    refused('Safety no lo cambia', await as(USERS.safety).put('/admin/setup/shop-hours', { cutoff: '16:00', workdays: [1] }), 403);
    refused('hora de la mañana', await manager.put('/admin/setup/shop-hours', { cutoff: '09:00', workdays: [1] }), 400, 'SHOP_HOURS_INVALID');
    refused('sin días', await manager.put('/admin/setup/shop-hours', { cutoff: '17:00', workdays: [] }), 400, 'SHOP_HOURS_INVALID');
    refused('día que no existe', await manager.put('/admin/setup/shop-hours', { cutoff: '17:00', workdays: [8] }), 400, 'SHOP_HOURS_INVALID');
    refused('hora sin formato', await manager.put('/admin/setup/shop-hours', { cutoff: '5pm', workdays: [1] }), 400, 'SHOP_HOURS_INVALID');

    // From now on the day closes at 6:30 p.m.
    const { workOrderId } = await plannedWo('905');
    ok('Start', await start(USERS.alignment, workOrderId));
    const workday = lastWorkday();
    const id = await backdateOpenClock(USERS.alignment, at(workday, 14));
    ok('leer', await as(USERS.alignment).get(`/work-orders/${workOrderId}`));
    same('se cierra con la hora nueva (6:30 p.m.)', await session(id), { endedAt: at(workday, 18, 30), endReason: 'day_close' });

    ok('el System Admin también puede', await admin.put('/admin/setup/shop-hours', { cutoff: '17:00', workdays: [1, 2, 3, 4, 5, 6] }));
    same('sábado ahora es día hábil', ok('leer horario', await manager.get('/admin/setup/shop-hours')).workdays, [1, 2, 3, 4, 5, 6]);
  });
});

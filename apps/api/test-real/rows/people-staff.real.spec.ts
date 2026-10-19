/**
 * LTR-253 / D48: People also shows the Shop Managers and System Admins. Only a System Admin adds, deactivates,
 * removes or deletes them; a Manager handles Standard, PM and Safety only. Nobody retires themself.
 * Each row uses people it creates, so the seeded staff is untouched.
 */
import { afterAll, describe, it } from 'vitest';
import { Json, USERS, admin, as, manager, ok, prisma, refused, same, truthy } from '../harness';

const RUN = Date.now();
const email = (tag: string) => `d48-${tag}-${RUN}@lightning.local`;
const PACKAGE = ['admin.access', 'work_orders.manage', 'yard.operations.manage'];

async function addStaff(tag: string, role: 'manager' | 'admin') {
  return ok(`alta de ${tag}`, await admin.post('/admin/mechanics', { name: `D48 ${tag}`, email: email(tag), role }));
}

async function people(query = '') {
  return ok('leer People', await manager.get(`/admin/mechanics?limit=100${query}`)).items as Json[];
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: `-${RUN}@lightning.local` } } }).catch(() => undefined);
});

describe('People: Managers y System Admins (D48)', () => {
  it('A145 | El Manager ve en People a los Managers y System Admins con su tipo, y abre su detalle', async () => {
    const list = await people();
    const seededManager = list.find((item) => item.email === USERS.manager);
    const seededAdmin = list.find((item) => item.email === USERS.admin);
    same('el Manager está, con tipo manager', seededManager?.role, 'manager');
    same('el System Admin está, con tipo admin', seededAdmin?.role, 'admin');
    same('su detalle abre', ok('detalle', await manager.get(`/admin/mechanics/${seededAdmin.id}`)).role, 'admin');
    const assignable = ok('para asignar', await manager.get('/admin/mechanics?limit=100&assignable=true')).items as Json[];
    truthy('no aparecen para asignar Jobs', !assignable.some((item) => item.role === 'manager' || item.role === 'admin'));
  });

  it('A146 | El System Admin da de alta un Manager y un System Admin con su paquete completo; el Manager nuevo entra y maneja el taller', async () => {
    const boss = await addStaff('manager', 'manager');
    same('tipo Manager', boss.role, 'manager');
    same('paquete completo', [...boss.capabilities].sort(), PACKAGE);
    const me = ok('entra', await as(email('manager')).get('/auth/me'));
    same('entra con su paquete', [...me.user.capabilities].sort(), PACKAGE);
    ok('da de alta a un mecánico', await as(email('manager')).post('/admin/mechanics', { name: 'D48 mecánico', email: email('mecanico'), mode: 'standard' }));

    const sysAdmin = await addStaff('admin', 'admin');
    same('tipo System Admin', sysAdmin.role, 'admin');
    same('paquete completo del Admin', [...sysAdmin.capabilities].sort(), PACKAGE);
    truthy('los dos aparecen en People', (await people()).filter((item) => [boss.id, sysAdmin.id].includes(item.id)).length === 2);
    refused('el correo repetido se niega', await admin.post('/admin/mechanics', { name: 'Otra', email: email('manager'), role: 'manager' }), 409, 'MECHANIC_EMAIL_EXISTS');
  });

  it('A147 | Un Manager no da de alta ni toca a un Manager o a un System Admin; sí al personal del taller', async () => {
    refused('no da de alta un Manager', await manager.post('/admin/mechanics', { name: 'D48 no', email: email('no'), role: 'manager' }), 403, 'STAFF_ADMIN_ONLY');
    refused('ni un System Admin', await manager.post('/admin/mechanics', { name: 'D48 no', email: email('no'), role: 'admin' }), 403, 'STAFF_ADMIN_ONLY');
    const other = await addStaff('otro', 'manager');
    const seededAdmin = (await people()).find((item) => item.email === USERS.admin);
    for (const target of [other.id, seededAdmin.id]) {
      refused('no desactiva', await manager.patch(`/admin/mechanics/${target}`, { active: false }), 403, 'STAFF_ADMIN_ONLY');
      refused('no quita', await manager.post(`/admin/mechanics/${target}/remove`), 403, 'STAFF_ADMIN_ONLY');
      refused('no borra', await manager.del(`/admin/mechanics/${target}`), 403, 'STAFF_ADMIN_ONLY');
      refused('no reinicia la contraseña', await manager.post(`/admin/mechanics/${target}/reset-password`), 403, 'STAFF_ADMIN_ONLY');
    }
    const worker = ok('sí da de alta a un Safety', await manager.post('/admin/mechanics', { name: 'D48 safety', email: email('safety'), mode: 'safety' }));
    ok('y lo desactiva', await manager.patch(`/admin/mechanics/${worker.id}`, { active: false }));
  });

  it('A148 | El System Admin desactiva, reactiva y quita a un Manager (D31); el tipo no cambia; nadie se quita a sí mismo', async () => {
    const boss = await addStaff('baja', 'manager');
    refused('no se le pone tipo de mecánico', await admin.patch(`/admin/mechanics/${boss.id}`, { mode: 'pm' }), 400, 'STAFF_TYPE_FIXED');
    ok('desactiva', await admin.patch(`/admin/mechanics/${boss.id}`, { active: false }));
    refused('ya no entra', await as(email('baja')).get('/auth/me'), 403);
    ok('reactiva', await admin.patch(`/admin/mechanics/${boss.id}`, { active: true }));
    ok('vuelve a entrar', await as(email('baja')).get('/auth/me'));
    ok('quita del Shop', await admin.post(`/admin/mechanics/${boss.id}/remove`));
    refused('quitado no entra', await as(email('baja')).get('/auth/me'), 403);
    truthy('sale de People', !(await people()).some((item) => item.id === boss.id));
    truthy('se ve con el filtro de quitadas', (await people('&status=removed')).some((item) => item.id === boss.id));

    const mistake = await addStaff('error', 'admin');
    ok('borra a un System Admin creado por error', await admin.del(`/admin/mechanics/${mistake.id}`));
    same('ya no existe', await prisma.user.count({ where: { id: mistake.id } }), 0);

    const self = (await people()).find((item) => item.email === USERS.admin);
    refused('no se desactiva a sí mismo', await admin.patch(`/admin/mechanics/${self.id}`, { active: false }), 409, 'PERSON_IS_SELF');
    refused('ni se quita', await admin.post(`/admin/mechanics/${self.id}/remove`), 409, 'PERSON_IS_SELF');
    refused('ni se borra', await admin.del(`/admin/mechanics/${self.id}`), 409, 'PERSON_IS_SELF');
  });
});

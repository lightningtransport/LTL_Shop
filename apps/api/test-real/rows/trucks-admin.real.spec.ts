/**
 * D44 / HU-M18 (LTR-215): the Manager adds, edits, deactivates and deletes trucks, and connects Samsara from the truck.
 * The sync only proposes a VIN match; a connected truck stays connected. Each row uses trucks it creates (D44-…), so
 * the seeded fleet is untouched. Samsara is the stand-in (`samsara-mock.ts`), never the real one.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, inject, it } from 'vitest';
import { USERS, Json, as, cancelWo, createWo, manager, ok, prisma, refused, resetDb, same, truthy } from '../harness';
import { EMPTY_SAMSARA_FIXTURE, type SamsaraFixture } from '../samsara-mock';

const RUN = String(Date.now()).slice(-6);
const MILE = 1609.344;
let serial = 0;

/** A fresh truck number for this run ("D44-123456-3"). */
function number() {
  serial += 1;
  return `D44-${RUN}-${serial}`;
}

/** A VIN only this run uses (17 characters). */
function vin(tag: string) {
  return `1D44${RUN}${tag}`.padEnd(17, '0').slice(0, 17).toUpperCase();
}

async function addTruck(input: Record<string, unknown> = {}) {
  return ok('agregar camión', await manager.post('/admin/trucks', { truckNumber: number(), ...input })) as Json;
}

async function detail(id: string) {
  return ok('ficha del camión', await manager.get(`/admin/trucks/${id}`)) as Json;
}

async function setSamsara(fixture: Partial<SamsaraFixture>) {
  const response = await fetch(`${inject('samsaraMockUrl')}/__fixture`, { method: 'POST', body: JSON.stringify(fixture) });
  if (!response.ok) throw new Error('Samsara stand-in did not take the fixture');
}

async function sync() {
  return ok('Sync now', await manager.post('/admin/integrations/samsara/sync')) as Json;
}

async function cleanup() {
  await resetDb();
  const trucks = await prisma.truck.findMany({ where: { truckNumber: { startsWith: `D44-${RUN}-` } }, select: { id: true } });
  const ids = trucks.map((truck) => truck.id);
  await prisma.truckFault.deleteMany({ where: { truckId: { in: ids } } });
  await prisma.truck.deleteMany({ where: { id: { in: ids } } });
  await prisma.truck.updateMany({ where: { samsaraVehicleId: { startsWith: 'd44-' } }, data: { samsaraVehicleId: null, samsaraVehicleName: null } });
  await prisma.truck.updateMany({ where: { samsaraProposedVehicleId: { startsWith: 'd44-' } }, data: { samsaraProposedVehicleId: null } });
  if (inject('samsaraMockUrl')) await setSamsara(EMPTY_SAMSARA_FIXTURE);
}

describe('Manager: alta y edición de camiones (D44)', () => {
  beforeEach(resetDb);
  afterAll(cleanup);

  it('A98 | D44: el Manager agrega un camión con solo el número y lo que sepa; aparece en Trucks y en New Work Order; las millas oficiales no se escriben aquí', async () => {
    const created = await addTruck({ vin: ` ${vin('A').toLowerCase()} `, make: 'Freightliner', model: 'Cascadia', year: 2022, licensePlate: 'TX 4471', owner: 'Ana', company: 'Lightning', dispatcher: 'Luis', insurance: 'Progressive' });
    same('el VIN queda en mayúsculas y sin espacios', created.vin, vin('A'));
    same('lo vacío queda vacío y las millas no existen todavía', [created.mileage, created.deactivatedAt], [null, null]);

    const card = await detail(created.id);
    same('la ficha trae placas, dispatcher y aseguradora', [card.truck.licensePlate, card.truck.dispatcher, card.truck.insurance], ['TX 4471', 'Luis', 'Progressive']);
    same('se puede borrar (no tiene historial) y no está conectado a Samsara', [card.admin.canDelete, card.admin.samsara.connectedVehicleId], [true, null]);

    const pickers = ok('lista de camiones (New Work Order)', await as(USERS.alignment).get('/trucks')) as Json[];
    truthy('está en New Work Order', pickers.some((truck) => truck.id === created.id));
    const list = ok('Admin → Trucks', await manager.get(`/admin/trucks?search=${created.truckNumber}`)) as Json;
    same('está en Trucks', (list.items as Json[]).map((item) => item.truck.id), [created.id]);

    refused('las millas oficiales no se escriben desde aquí (D10)', await manager.post('/admin/trucks', { truckNumber: number(), mileage: 1000 }), 400);
    refused('sin número no se guarda', await manager.post('/admin/trucks', { truckNumber: '  ' }), 400);
    ok('el System Admin también agrega', await as(USERS.admin).post('/admin/trucks', { truckNumber: number() }));
  });

  it('A99 | D44: número repetido o VIN de otro camión no se guardan (dice cuál camión lo tiene); un mecánico o Safety no pueden agregar ni editar (403)', async () => {
    const first = await addTruck({ vin: vin('B') });
    refused('el número ya existe', await manager.post('/admin/trucks', { truckNumber: first.truckNumber.toLowerCase() }), 409, 'TRUCK_NUMBER_TAKEN');
    const taken = await manager.post('/admin/trucks', { truckNumber: number(), vin: vin('B').replace(/(.{4})/, '$1-').toLowerCase() });
    refused('el VIN ya es de otro camión (aunque venga con guion y minúsculas)', taken, 409, 'TRUCK_VIN_TAKEN');
    same('dice cuál camión lo tiene', taken.json.truck, { id: first.id, truckNumber: first.truckNumber });

    const second = await addTruck();
    refused('editar al número del otro', await manager.patch(`/admin/trucks/${second.id}`, { truckNumber: first.truckNumber }), 409, 'TRUCK_NUMBER_TAKEN');
    refused('editar al VIN del otro', await manager.patch(`/admin/trucks/${second.id}`, { vin: vin('B') }), 409, 'TRUCK_VIN_TAKEN');

    for (const [who, email] of [['un mecánico', USERS.alignment], ['Safety', USERS.safety]] as const) {
      refused(`${who} no agrega`, await as(email).post('/admin/trucks', { truckNumber: number() }), 403);
      refused(`${who} no edita`, await as(email).patch(`/admin/trucks/${first.id}`, { make: 'Volvo' }), 403);
      refused(`${who} no borra`, await as(email).del(`/admin/trucks/${second.id}`), 403);
    }
  });

  it('A100 | D44: editar la ficha cambia solo lo enviado; lo que se borra queda vacío', async () => {
    const created = await addTruck({ make: 'Volvo', owner: 'Ana', insurance: 'Old Insurance' });
    const edited = ok('editar', await manager.patch(`/admin/trucks/${created.id}`, { model: 'VNL 760', year: 2023, licensePlate: 'TX 9', dispatcher: 'Marta', insurance: 'Progressive', owner: '' })) as Json;
    same('lo enviado cambió, lo demás quedó', [edited.make, edited.model, edited.year, edited.licensePlate, edited.dispatcher, edited.insurance, edited.owner], ['Volvo', 'VNL 760', 2023, 'TX 9', 'Marta', 'Progressive', null]);
    same('la ficha lo muestra', (await detail(created.id)).truck.dispatcher, 'Marta');
    refused('las millas no se editan aquí', await manager.patch(`/admin/trucks/${created.id}`, { mileage: 5 }), 400);
  });

  it('A101 | D44: no se desactiva con una Work Order abierta (dice cuál); desactivado sale de Trucks y de New Work Order y no se le abre trabajo; la ficha sigue abriendo; reactivar lo devuelve', async () => {
    const created = await addTruck();
    const { workOrderId, created: workOrder } = await createWo(created.truckNumber);
    const blocked = await manager.patch(`/admin/trucks/${created.id}`, { active: false });
    refused('con WO abierta no se desactiva', blocked, 409, 'TRUCK_HAS_OPEN_WORK_ORDER');
    same('dice cuál Work Order cerrar', blocked.json.workOrder, { id: workOrderId, displayId: workOrder.displayId });

    ok('cancelar la WO', await cancelWo(workOrderId));
    const off = ok('desactivar', await manager.patch(`/admin/trucks/${created.id}`, { active: false })) as Json;
    truthy('queda la fecha de desactivación', off.deactivatedAt);
    same('quién lo desactivó', (await prisma.truck.findUniqueOrThrow({ where: { id: created.id } })).deactivatedById, (await prisma.user.findUniqueOrThrow({ where: { email: USERS.manager } })).id);

    truthy('no está en New Work Order', !(ok('lista', await as(USERS.alignment).get('/trucks')) as Json[]).some((truck) => truck.id === created.id));
    same('no sale en la búsqueda', (ok('buscar', await as(USERS.alignment).get(`/trucks/search?q=${created.truckNumber}`)) as Json[]).length, 0);
    same('no está en Trucks', (ok('Trucks', await manager.get(`/admin/trucks?search=${created.truckNumber}`)) as Json).items.length, 0);
    same('está en Trucks → Inactive', (ok('Trucks inactivos', await manager.get(`/admin/trucks?status=inactive&search=${created.truckNumber}`)) as Json).items.map((item: Json) => item.truck.id), [created.id]);
    refused('no se le abre una Work Order', await manager.post('/admin/work-orders', { truckId: created.id, idempotencyKey: randomUUID() }), 409, 'TRUCK_INACTIVE');
    const card = await detail(created.id);
    truthy('la ficha y su historial siguen abriendo', card.truck.deactivatedAt && card.repairHistory);

    ok('reactivar', await manager.patch(`/admin/trucks/${created.id}`, { active: true }));
    truthy('vuelve a New Work Order', (ok('lista', await as(USERS.alignment).get('/trucks')) as Json[]).some((truck) => truck.id === created.id));
    ok('y se le abre trabajo', await manager.post('/admin/work-orders', { truckId: created.id, idempotencyKey: randomUUID() }));
  });

  it('A102 | D44: borrar solo un camión que nunca tuvo nada; con historial se desactiva', async () => {
    const used = await addTruck();
    const { workOrderId } = await createWo(used.truckNumber);
    ok('cancelar la WO', await cancelWo(workOrderId));
    same('con historial no se puede borrar', (await detail(used.id)).admin.canDelete, false);
    refused('borrar con historial', await manager.del(`/admin/trucks/${used.id}`), 409, 'TRUCK_HAS_HISTORY');

    const mistake = await addTruck();
    ok('borrar el creado por error', await manager.del(`/admin/trucks/${mistake.id}`));
    refused('ya no existe', await manager.get(`/admin/trucks/${mistake.id}`), 404);
  });
});

/** Samsara vehicles of this run: `d44-…` ids, with what Samsara knows of each. */
function samsaraVehicle(tag: string, data: Record<string, unknown> = {}) {
  return { id: `d44-${RUN}-${tag}`, name: `Unit ${tag}`, ...data };
}

describe('Manager: conectar Samsara desde el camión (D44)', () => {
  beforeEach(async (context) => {
    if (!inject('samsaraMockUrl')) context.skip();
    await resetDb();
  });
  afterAll(async () => {
    if (inject('samsaraMockUrl')) await cleanup();
  });

  it('A103 | D44: Connect Samsara lista los vehículos que no son de ningún camión, arriba el que coincide por VIN y luego por número ("Suggested"); un mecánico no la ve', async () => {
    const other = await addTruck();
    const created = await addTruck({ vin: vin('C') });
    await prisma.truck.update({ where: { id: other.id }, data: { samsaraVehicleId: `d44-${RUN}-taken` } });
    await setSamsara({ vehicles: [
      samsaraVehicle('zz'),
      samsaraVehicle('num', { name: `Truck ${created.truckNumber}` }),
      samsaraVehicle('vin', { vin: vin('C'), make: 'Volvo', model: 'VNL', year: '2021', licensePlate: 'TX 1' }),
      samsaraVehicle('taken'),
    ] });

    const candidates = ok('candidatos', await manager.get(`/admin/trucks/${created.id}/samsara/candidates`)) as Json;
    const mine = (candidates.items as Json[]).filter((item) => item.id.startsWith(`d44-${RUN}-`));
    same('primero el VIN, luego el número, el de otro camión no aparece', mine.map((item) => [item.id, item.suggested]), [[`d44-${RUN}-vin`, 'vin'], [`d44-${RUN}-num`, 'number'], [`d44-${RUN}-zz`, null]]);
    same('trae lo que Samsara sabe del vehículo', [mine[0].make, mine[0].model, mine[0].year, mine[0].licensePlate], ['Volvo', 'VNL', 2021, 'TX 1']);
    refused('un mecánico no ve los vehículos', await as(USERS.alignment).get(`/admin/trucks/${created.id}/samsara/candidates`), 403);
  });

  it('A104 | D44: al conectar, lo vacío se llena con Samsara; lo que difiere pide elegir; conectado trae millas y ubicación enseguida', async () => {
    const created = await addTruck({ vin: vin('D'), year: 2020, make: 'Volvo' });
    const vehicle = samsaraVehicle('d', { vin: vin('D'), make: 'volvo', model: 'VNL 860', year: '2021', licensePlate: 'TX 77' });
    await setSamsara({
      vehicles: [vehicle],
      stats: [{ id: vehicle.id, obdOdometerMeters: { time: '2026-10-14T15:00:00Z', value: Math.round(250_000 * MILE) }, gps: { time: '2026-10-14T15:00:00Z', latitude: 29.7, longitude: -95.3, speedMilesPerHour: 0, reverseGeo: { formattedLocation: 'Houston, TX' } } }],
    });

    const ask = await manager.post(`/admin/trucks/${created.id}/samsara/connect`, { vehicleId: vehicle.id });
    refused('el año difiere: hay que elegir', ask, 400, 'SAMSARA_CHOICE_REQUIRED');
    same('dice qué campos', ask.json.fields, ['year']);
    same('no conectó nada', (await prisma.truck.findUniqueOrThrow({ where: { id: created.id } })).samsaraVehicleId, null);

    const done = ok('conectar quedándose con su año', await manager.post(`/admin/trucks/${created.id}/samsara/connect`, { vehicleId: vehicle.id, choose: { year: 'ours' } })) as Json;
    same('se llenó lo vacío (la marca es la misma)', [done.updatedFields, done.synced], [['model', 'licensePlate'], true]);
    const card = await detail(created.id);
    same('la ficha quedó completa sin pisar el año', [card.truck.make, card.truck.model, card.truck.year, card.truck.licensePlate], ['Volvo', 'VNL 860', 2020, 'TX 77']);
    same('conectado a ese vehículo', [card.admin.samsara.connectedVehicleId, card.admin.samsara.connectedVehicleName], [vehicle.id, 'Unit d']);
    same('trae millas y ubicación de Samsara; las del PM no cambian', [card.truck.samsara?.odometerMiles, card.truck.location, card.truck.mileage], [250_000, 'Houston, TX', null]);
  });

  it('A105 | D44: un vehículo de Samsara que ya es de otro camión no se conecta', async () => {
    const owner = await addTruck();
    const created = await addTruck();
    const vehicle = samsaraVehicle('e');
    await prisma.truck.update({ where: { id: owner.id }, data: { samsaraVehicleId: vehicle.id } });
    await setSamsara({ vehicles: [vehicle] });
    const taken = await manager.post(`/admin/trucks/${created.id}/samsara/connect`, { vehicleId: vehicle.id });
    refused('ya es de otro camión', taken, 409, 'SAMSARA_VEHICLE_TAKEN');
    same('dice de cuál', taken.json.truck.truckNumber, owner.truckNumber);
  });

  it('A106 | D44: la sincronización propone por VIN exacto en la ficha y no conecta sola; por número no propone', async () => {
    const byVin = await addTruck({ vin: vin('F') });
    const byNumber = await addTruck();
    const vehicle = samsaraVehicle('f', { vin: vin('F') });
    await setSamsara({ vehicles: [vehicle, samsaraVehicle('g', { name: byNumber.truckNumber })] });
    await sync();

    const row = await prisma.truck.findUniqueOrThrow({ where: { id: byVin.id } });
    same('propuesto, no conectado', [row.samsaraProposedVehicleId, row.samsaraVehicleId], [vehicle.id, null]);
    same('la ficha muestra la propuesta', (await detail(byVin.id)).admin.samsara.proposedVehicleId, vehicle.id);
    same('por número no se propone ni se conecta', await prisma.truck.findUniqueOrThrow({ where: { id: byNumber.id }, select: { samsaraProposedVehicleId: true, samsaraVehicleId: true } }), { samsaraProposedVehicleId: null, samsaraVehicleId: null });
    const pairing = ok('Setup → Samsara', await manager.get('/admin/integrations/samsara/pairing')) as Json;
    same('Setup → Samsara lo lista como propuesto', (pairing.proposed as Json[]).filter((item) => item.truck.id === byVin.id).map((item) => item.vehicle.id), [vehicle.id]);

    const list = ok('Trucks', await manager.get(`/admin/trucks?search=${byVin.truckNumber}`)) as Json;
    same('Trucks marca la propuesta en la fila', list.items[0].samsaraProposedVehicleId, vehicle.id);

    await setSamsara({ vehicles: [samsaraVehicle('g', { name: byNumber.truckNumber })] });
    await sync();
    same('si el vehículo ya no está, la propuesta se va', (await prisma.truck.findUniqueOrThrow({ where: { id: byVin.id } })).samsaraProposedVehicleId, null);
  });

  it('A109 | D44: la propuesta aparece después de una sincronización y se conecta de un toque (sin elegir: nada difiere); la propuesta desaparece', async () => {
    const created = await addTruck({ vin: vin('J'), make: 'Kenworth' });
    const vehicle = samsaraVehicle('j', { vin: vin('J'), make: 'Kenworth', model: 'T680', year: '2023' });
    await setSamsara({ vehicles: [vehicle] });
    same('antes de sincronizar no hay propuesta', (await detail(created.id)).admin.samsara.proposedVehicleId, null);
    await sync();
    same('después de sincronizar, la propuesta', (await detail(created.id)).admin.samsara.proposedVehicleId, vehicle.id);

    const done = ok('conectar de un toque', await manager.post(`/admin/trucks/${created.id}/samsara/connect`, { vehicleId: vehicle.id })) as Json;
    same('solo se llenó lo vacío', done.updatedFields, ['model', 'year']);
    const card = await detail(created.id);
    same('conectado y sin propuesta', [card.admin.samsara.connectedVehicleId, card.admin.samsara.proposedVehicleId, card.truck.model, card.truck.year], [vehicle.id, null, 'T680', 2023]);
  });

  it('A107 | D44: desconectar deja de sincronizar; las últimas lecturas y las fallas quedan; la sincronización no lo vuelve a conectar por el id de Ninox', async () => {
    const created = await addTruck();
    // Samsara ids are digits; the Ninox copy is a number, so no leading zero.
    const vehicle = { ...samsaraVehicle('h'), id: `9${RUN}0042` };
    await prisma.truck.update({ where: { id: created.id }, data: { samsaraId: vehicle.id } });
    const faults = [{ id: vehicle.id, faultCodes: { j1939: { checkEngineLights: { stopIsOn: false, warningIsOn: true, emissionsIsOn: false, protectIsOn: false }, diagnosticTroubleCodes: [{ spnId: 2659, spnDescription: 'EGR', fmiId: 17, fmiDescription: 'Low', txId: 0, sourceAddressName: 'Engine #1', occurrenceCount: 1, milStatus: 1 }] } } }];
    await setSamsara({ vehicles: [vehicle], stats: [{ id: vehicle.id, obdOdometerMeters: { time: '2026-10-14T15:00:00Z', value: Math.round(10_000 * MILE) } }], faults });
    await sync();
    same('el id de Ninox lo conectó y quedó guardado', (await prisma.truck.findUniqueOrThrow({ where: { id: created.id } })).samsaraVehicleId, vehicle.id);

    ok('desconectar', await manager.post(`/admin/trucks/${created.id}/samsara/disconnect`));
    await setSamsara({ vehicles: [vehicle], stats: [{ id: vehicle.id, obdOdometerMeters: { time: '2026-10-14T16:00:00Z', value: Math.round(20_000 * MILE) } }], faults: [] });
    await sync();
    const row = await prisma.truck.findUniqueOrThrow({ where: { id: created.id } });
    same('no se volvió a conectar y guarda la última lectura', [row.samsaraVehicleId, row.samsaraId, row.samsaraOdometerMiles], [null, null, 10_000]);
    same('la falla sigue en su historial (no se cerró)', await prisma.truckFault.count({ where: { truckId: created.id } }), 1);
    refused('un mecánico no desconecta', await as(USERS.alignment).post(`/admin/trucks/${created.id}/samsara/disconnect`), 403);
  });

  it('A108 | D44: un camión conectado sigue conectado aunque Samsara deje de listar su vehículo; Setup → Samsara lo avisa', async () => {
    const created = await addTruck();
    const vehicle = samsaraVehicle('i');
    await prisma.truck.update({ where: { id: created.id }, data: { samsaraVehicleId: vehicle.id } });
    await setSamsara({ vehicles: [vehicle], stats: [{ id: vehicle.id, obdOdometerMeters: { time: '2026-10-14T15:00:00Z', value: Math.round(30_000 * MILE) } }] });
    await sync();

    await setSamsara({ vehicles: [] });
    await sync();
    const row = await prisma.truck.findUniqueOrThrow({ where: { id: created.id } });
    same('sigue conectado con su última lectura', [row.samsaraVehicleId, row.samsaraOdometerMiles], [vehicle.id, 30_000]);
    const pairing = ok('Setup → Samsara', await manager.get('/admin/integrations/samsara/pairing')) as Json;
    same('aparece conectado con el aviso', (pairing.paired as Json[]).filter((item) => item.truck.id === created.id).map((item) => [item.method, item.warnings]), [['connected', ['vehicle_missing']]]);
  });
});

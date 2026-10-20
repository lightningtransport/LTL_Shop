import { afterAll, beforeEach, describe, inject, it } from 'vitest';
import { REAL_CRON_SECRET } from '../env';
import { randomUUID } from 'node:crypto';
import { USERS, Json, adminCompleteJob, as, catalogJob, createWo, manager, ok, prisma, refused, resetDb, same, truthy, userId } from '../harness';
import { EMPTY_SAMSARA_FIXTURE, type SamsaraFixture } from '../samsara-mock';

/** OPEN_ISSUES §1w and §1x (D35, D42): Samsara pairing, sync of miles and location, and faults. Never the real Samsara. */

const MILE = 1609.344;
const TRUCK = '931';

async function setSamsara(fixture: Partial<SamsaraFixture>) {
  const response = await fetch(`${inject('samsaraMockUrl')}/__fixture`, { method: 'POST', body: JSON.stringify(fixture) });
  if (!response.ok) throw new Error('Samsara stand-in did not take the fixture');
}

async function truckRow() {
  return prisma.truck.findUniqueOrThrow({ where: { truckNumber: TRUCK } });
}

function vehicle(truckNumber = TRUCK) {
  return { id: `v-${truckNumber}`, name: `Truck ${truckNumber}` };
}

function stat(miles: number, address: string, at = '2026-10-14T15:00:00Z', geofence?: { id: string; name: string }) {
  return {
    id: `v-${TRUCK}`,
    obdOdometerMeters: { time: at, value: Math.round(miles * MILE) },
    gps: { time: at, latitude: 29.7355, longitude: -94.9774, speedMilesPerHour: 62, reverseGeo: { formattedLocation: address }, ...(geofence ? { address: geofence } : {}) },
  };
}

/** D49 / P37 (LTR-257): two of our yard's Samsara geofences, and a customer's that is not ours. */
const HOME_OFFICE = { id: '12839282', name: 'Home Office' };
const LIGHTNING_YARD = { id: '32418339', name: 'Lightning Transport and Logistics' };
const CUSTOMER = { id: '87934134', name: 'Monat Global' };

/** S3-4: J1939 as Samsara sends it: lights per truck, `milStatus` per code (1 = check engine). */
function j1939(lights: { stop?: boolean; warning?: boolean; emissions?: boolean }, ...codes: Array<{ spn: number; fmi: number; mil?: number; count?: number }>) {
  return {
    id: `v-${TRUCK}`,
    faultCodes: {
      j1939: {
        checkEngineLights: { stopIsOn: Boolean(lights.stop), warningIsOn: Boolean(lights.warning), emissionsIsOn: Boolean(lights.emissions), protectIsOn: false },
        diagnosticTroubleCodes: codes.map((code) => ({
          spnId: code.spn, spnDescription: `SPN ${code.spn} part`, fmiId: code.fmi, fmiDescription: 'Too high',
          txId: 0, sourceAddressName: 'Engine #1', occurrenceCount: code.count ?? 1, milStatus: code.mil ?? 0,
        })),
      },
    },
  };
}

async function cleanSamsara() {
  await prisma.samsaraFaultCodeJob.deleteMany({});
  await prisma.truckFault.deleteMany({});
  await prisma.truck.updateMany({
    data: {
      samsaraVehicleId: null, samsaraVehicleName: null, samsaraProposedVehicleId: null, samsaraId: null,
      samsaraOdometerMiles: null, samsaraOdometerSource: null, samsaraOdometerAt: null, samsaraAddress: null,
      samsaraLatitude: null, samsaraLongitude: null, samsaraSpeedMph: null, samsaraLocationAt: null, samsaraSyncedAt: null,
      samsaraGeofenceId: null, samsaraGeofenceName: null, samsaraInYardSince: null,
    },
  });
  await setSamsara(EMPTY_SAMSARA_FIXTURE);
}

/** D44: the Manager connected these trucks to their Samsara vehicles (the sync never connects by number). */
async function connectTestTrucks(...truckNumbers: string[]) {
  for (const truckNumber of truckNumbers) {
    await prisma.truck.update({ where: { truckNumber }, data: { samsaraVehicleId: `v-${truckNumber}` } });
  }
}

function cron(method: 'GET' | 'POST', secret?: string) {
  return fetch(`${inject('apiUrl')}/api/internal/samsara-sync`, { method, headers: secret ? { Authorization: `Bearer ${secret}` } : {} });
}

describe('Manager: Samsara (D35, D42)', () => {
  beforeEach(async (context) => {
    if (!inject('samsaraMockUrl')) context.skip();
    await cleanSamsara();
    await connectTestTrucks(TRUCK);
  });
  afterAll(async () => {
    if (inject('samsaraMockUrl')) await cleanSamsara();
  });

  it('A91 | S-1: Setup → Samsara dice qué vehículo es cada camión sin escribir nada; un mecánico no entra', async () => {
    await setSamsara({ vehicles: [vehicle(), { id: 'v-trailer', name: 'Trailer 9001' }] });
    const before = await prisma.truck.findMany({ select: { id: true, samsaraId: true, samsaraVehicleId: true, mileage: true }, orderBy: { id: 'asc' } });

    const pairing = ok('leer Setup → Samsara', await manager.get('/admin/integrations/samsara/pairing')) as Json;
    same('el 931 está conectado a su vehículo (D44: la conexión guardada)', (pairing.paired as Json[]).map((row) => [row.truck.truckNumber, row.vehicle.id, row.method]), [[TRUCK, `v-${TRUCK}`, 'connected']]);
    same('el trailer queda como vehículo sin camión', (pairing.unpairedVehicles as Json[]).map((row) => row.name), ['Trailer 9001']);
    same('leer no cambió ningún camión', await prisma.truck.findMany({ select: { id: true, samsaraId: true, samsaraVehicleId: true, mileage: true }, orderBy: { id: 'asc' } }), before);
    refused('un mecánico no ve Setup → Samsara', await as(USERS.alignment).get('/admin/integrations/samsara/pairing'), 403);
  });

  it('A92 | S-2: Sync now guarda millas y ubicación de Samsara en el camión sin tocar las millas del PM; la ficha y Trucks las muestran; otra corrida no duplica nada', async () => {
    const { id, mileage } = await truckRow();
    await setSamsara({ vehicles: [vehicle()], stats: [stat(418_612, 'I-10 W, Baytown, TX')] });

    const run = ok('Sync now', await manager.post('/admin/integrations/samsara/sync')) as Json;
    same('la corrida terminó y dejó su estado', [run.status, run.state.vehicles, run.state.trucksUpdated, run.state.lastTrigger], ['ok', 1, 1, 'manual']);

    const truck = await truckRow();
    same('millas y ubicación de Samsara guardadas', [truck.samsaraVehicleId, truck.samsaraOdometerMiles, truck.samsaraOdometerSource, truck.samsaraAddress, truck.samsaraSpeedMph], [`v-${TRUCK}`, 418_612, 'obd', 'I-10 W, Baytown, TX', 62]);
    same('las millas oficiales (PM) no cambian', truck.mileage, mileage);

    const detail = ok('ficha del camión', await manager.get(`/admin/trucks/${id}`)) as Json;
    same('la ficha trae la ubicación y las millas de Samsara', [detail.truck.location, detail.truck.locationUpdatedOn, detail.truck.samsara.odometerMiles, detail.truck.mileage], ['I-10 W, Baytown, TX', '2026-10-14', 418_612, mileage]);

    // Samsara sends no stats this time: the last good reading stays.
    await setSamsara({ vehicles: [vehicle()], stats: [] });
    ok('segunda corrida', await manager.post('/admin/integrations/samsara/sync'));
    const again = await truckRow();
    same('sin lectura nueva se conserva la anterior', [again.samsaraOdometerMiles, again.samsaraAddress], [418_612, 'I-10 W, Baytown, TX']);
    truthy('la hora de sincronización avanzó', again.samsaraSyncedAt! >= truck.samsaraSyncedAt!);

    const pairing = ok('Setup → Samsara muestra la última corrida', await manager.get('/admin/integrations/samsara/pairing')) as Json;
    same('estado de la última corrida', [pairing.sync.lastError, pairing.sync.trucksUpdated], [null, 1]);
  });

  it('A149 | D49: en un geofence de nuestra yard el camión está "In yard" desde la primera lectura adentro; con Work Order abierta está "In shop"; pasar de un geofence de la yard a otro no cambia la llegada; afuera no es ni uno ni otro, aunque tenga WO', async () => {
    await resetDb();
    const { id } = await truckRow();
    const listed = async (place: 'in_yard' | 'in_shop' | 'in_yard_no_wo') => ((ok(`Trucks → ${place}`, await manager.get(`/admin/trucks?place=${place}`)) as Json).items as Json[]).map((item) => item.truck.truckNumber);
    const sync = async (label: string, stats: unknown[]) => {
      await setSamsara({ vehicles: [vehicle()], stats: stats as Array<Record<string, unknown>> });
      ok(label, await manager.post('/admin/integrations/samsara/sync'));
      return (ok('ficha del camión', await manager.get(`/admin/trucks/${id}`)) as Json).truck.samsara as Json;
    };

    let samsara = await sync('sync: llega a Home Office', [stat(418_612, '6015 US-301, Tampa, FL 33610', '2026-10-19T13:00:00Z', HOME_OFFICE)]);
    same('guarda el geofence y la hora de llegada a la yard', [samsara.geofenceId, samsara.geofenceName, samsara.inYardSince], ['12839282', 'Home Office', '2026-10-19T13:00:00.000Z']);
    same('sin Work Order está en la yard, no en el shop', [(await listed('in_yard')).includes(TRUCK), (await listed('in_shop')).includes(TRUCK)], [true, false]);
    truthy('D51: sale en "In yard without a Work Order"', (await listed('in_yard_no_wo')).includes(TRUCK));

    await createWo(TRUCK);
    same('con Work Order abierta está en el shop (y sigue en la yard)', [(await listed('in_yard')).includes(TRUCK), (await listed('in_shop')).includes(TRUCK)], [true, true]);
    truthy('D51: con WO ya no sale en "In yard without a Work Order"', !(await listed('in_yard_no_wo')).includes(TRUCK));

    samsara = await sync('sync: pasa al otro geofence de la yard', [stat(418_615, 'Tampa, FL', '2026-10-19T15:00:00Z', LIGHTNING_YARD)]);
    same('sigue en la yard y la llegada no cambia', [samsara.geofenceName, samsara.inYardSince], ['Lightning Transport and Logistics', '2026-10-19T13:00:00.000Z']);

    await sync('sync sin lectura nueva', []);
    same('sin lectura nueva sigue en la yard', (await truckRow()).samsaraGeofenceId, '32418339');

    samsara = await sync('sync: está donde un cliente', [stat(418_640, 'Orlando, FL', '2026-10-19T17:00:00Z', CUSTOMER)]);
    same('el geofence de un cliente no es la yard: se guarda su nombre y se borra la llegada', [samsara.geofenceName, samsara.inYardSince], ['Monat Global', null]);
    same('con WO abierta pero afuera no sale ni en la yard ni en el shop', [(await listed('in_yard')).includes(TRUCK), (await listed('in_shop')).includes(TRUCK)], [false, false]);

    await sync('sync: en la carretera', [stat(418_700, 'I-75 N, Ocala, FL', '2026-10-19T19:00:00Z')]);
    const row = await truckRow();
    same('fuera de todo geofence no hay geofence', [row.samsaraGeofenceId, row.samsaraInYardSince], [null, null]);
    await resetDb();
  });

  it('A93 | S-3, S3-4: las luces del tablero (STOP, advertencia) y los códigos que encendieron check engine se ven en Trucks y en Faults; una falla sigue abierta sin duplicarse y se cierra cuando Samsara deja de reportarla; si la lectura de fallas falla no se cierra nada', async () => {
    const { id } = await truckRow();
    await setSamsara({ vehicles: [vehicle()], faults: [j1939({ stop: true, emissions: true }, { spn: 2659, fmi: 17, mil: 1, count: 3 }, { spn: 111, fmi: 1, mil: 0 }, { spn: 520837, fmi: 12, mil: 3 })] });
    ok('primera corrida', await manager.post('/admin/integrations/samsara/sync'));

    let faults = ok('pestaña Faults', await manager.get(`/admin/trucks/${id}/faults`)) as Json;
    same('las luces del tablero del camión', [faults.lamps.stop, faults.lamps.warning, faults.lamps.emissions], [true, false, true]);
    same('check engine solo con milStatus 1; 0 y 3 (no disponible) son info', (faults.active as Json[]).map((fault) => [fault.code, fault.severity]), [['SPN 2659 · FMI 17', 'check_engine'], ['SPN 111 · FMI 1', 'info'], ['SPN 520837 · FMI 12', 'info']]);
    let list = ok('lista de Trucks', await manager.get(`/admin/trucks?search=${TRUCK}`)) as Json;
    same('Trucks muestra STOP por la luz del camión y cuenta los 3 códigos', (list.items as Json[]).find((item) => item.truck.truckNumber === TRUCK)?.faults, { active: 3, worst: 'stop' });

    await setSamsara({ vehicles: [vehicle()], faults: [j1939({ warning: true }, { spn: 2659, fmi: 17, mil: 1, count: 14 })] });
    const second = ok('segunda corrida: la STOP se apagó, quedó la advertencia; la 111 y la 520837 ya no vienen', await manager.post('/admin/integrations/samsara/sync')) as Json;
    same('no se abrió nada nuevo y se cerraron dos', [second.state.faultsOpened, second.state.faultsCleared], [0, 2]);
    faults = ok('pestaña Faults', await manager.get(`/admin/trucks/${id}/faults`)) as Json;
    same('la 2659 sigue siendo la misma fila, con las veces al día', (faults.active as Json[]).map((fault) => [fault.code, fault.occurrenceCount]), [['SPN 2659 · FMI 17', 14]]);
    same('las dos cerradas pasaron al historial', (faults.history as Json[]).map((fault) => fault.code).sort(), ['SPN 111 · FMI 1', 'SPN 520837 · FMI 12']);
    same('una sola fila por falla activa', await prisma.truckFault.count({ where: { truckId: id, clearedAt: null } }), 1);
    list = ok('lista de Trucks', await manager.get(`/admin/trucks?search=${TRUCK}`)) as Json;
    same('Trucks pasa a advertencia', (list.items as Json[]).find((item) => item.truck.truckNumber === TRUCK)?.faults.worst, 'warning');

    await setSamsara({ vehicles: [vehicle()], faults: [], fail: 'faults' });
    const failed = ok('corrida con la lectura de fallas caída', await manager.post('/admin/integrations/samsara/sync')) as Json;
    same('millas y ubicación siguen; las fallas y las luces quedan como estaban', [failed.status, failed.state.lastError, failed.state.faultsCleared], ['ok', 'faults_unavailable', 0]);
    same('la advertencia sigue', (await truckRow()).samsaraWarningLamp, true);
    same('la 2659 sigue activa', await prisma.truckFault.count({ where: { truckId: id, clearedAt: null } }), 1);

    await setSamsara({ vehicles: [vehicle()], faults: [j1939({}, { spn: 111, fmi: 1, mil: 0 })] });
    ok('corrida solo con un código que no enciende nada', await manager.post('/admin/integrations/samsara/sync'));
    list = ok('lista de Trucks', await manager.get(`/admin/trucks?search=${TRUCK}`)) as Json;
    same('Trucks no marca nada: un código info no enciende ninguna luz', (list.items as Json[]).find((item) => item.truck.truckNumber === TRUCK)?.faults, { active: 1, worst: null });
  });

  it('A151 | D50: un camión que Dispatch tiene y la app no se agrega desde Samsara: crea el camión con VIN, marca, modelo, año y placa y lo deja conectado; sin vehículo en Samsara no ofrece nada; un mecánico no puede', async () => {
    const NEW = '9751';
    await prisma.truck.deleteMany({ where: { truckNumber: NEW } });
    const samsaraTruck = { id: 'v-9751', name: `Truck ${NEW}`, vin: '1XKYD49X0RJ009751', make: 'KENWORTH', model: 'T680', year: '2024', licensePlate: 'FL-9751' };
    await setSamsara({ vehicles: [vehicle(), samsaraTruck] });

    const preview = ok('ver qué se agregaría', await manager.get(`/admin/trucks/from-samsara?truckNumber=${NEW}`)) as Json;
    same('Samsara tiene el vehículo con ese número', [preview.existingTruckId, preview.vehicle?.id, preview.vehicle?.vin], [null, 'v-9751', '1XKYD49X0RJ009751']);
    const none = ok('número que Samsara no tiene', await manager.get('/admin/trucks/from-samsara?truckNumber=9752')) as Json;
    same('sin vehículo en Samsara no ofrece nada', none.vehicle, null);
    refused('un mecánico no puede agregar', await as(USERS.alignment).post('/admin/trucks/from-samsara', { truckNumber: NEW, vehicleId: 'v-9751' }), 403);

    const created = ok('Add from Samsara', await manager.post('/admin/trucks/from-samsara', { truckNumber: NEW, vehicleId: 'v-9751' })) as Json;
    const row = await prisma.truck.findUniqueOrThrow({ where: { id: created.truckId } });
    same('el camión nuevo trae los datos de Samsara y queda conectado', [row.truckNumber, row.vin, row.make, row.model, row.year, row.licensePlate, row.samsaraVehicleId], [NEW, '1XKYD49X0RJ009751', 'Kenworth', 'T680', 2024, 'FL-9751', 'v-9751']);
    const again = ok('ver de nuevo', await manager.get(`/admin/trucks/from-samsara?truckNumber=${NEW}`)) as Json;
    same('ya está en la app: lleva al camión', again.existingTruckId, created.truckId);
    refused('agregarlo dos veces no duplica', await manager.post('/admin/trucks/from-samsara', { truckNumber: NEW, vehicleId: 'v-9751' }), 409);
    await prisma.truck.deleteMany({ where: { truckNumber: NEW } });
  });

  it('A94 | S-2: GitHub Actions corre la sincronización con el secreto de cron; sin secreto 401; un mecánico no puede Sync now', async () => {
    await setSamsara({ vehicles: [vehicle()], stats: [stat(500_000, 'Laredo, TX')] });
    same('sin secreto', (await cron('POST')).status, 401);
    same('secreto equivocado', (await cron('GET', 'wrong')).status, 401);
    const response = await cron('GET', REAL_CRON_SECRET);
    same('con el secreto corre', response.status, 200);
    same('quedó como corrida del cron', ((await response.json()) as Json).state.lastTrigger, 'cron');
    same('guardó las millas', (await truckRow()).samsaraOdometerMiles, 500_000);
    refused('un mecánico no puede Sync now', await as(USERS.alignment).post('/admin/integrations/samsara/sync'), 403);
  });
});

/** D42 / S-6: a Samsara vehicle and its J1939 reading for another test truck. */
function readingFor(truckNumber: string, lights: { stop?: boolean; warning?: boolean; emissions?: boolean }, ...codes: Array<{ spn: number; fmi: number; mil?: number }>) {
  return { ...j1939(lights, ...codes), id: `v-${truckNumber}` };
}

async function sync() {
  return ok('Sync now', await manager.post('/admin/integrations/samsara/sync')) as Json;
}

async function recommendations(truckId: string) {
  return (ok('recomendaciones de fallas', await manager.get(`/admin/trucks/${truckId}/fault-recommendations`)) as Json).items as Json[];
}

describe('Manager: fallas de Samsara → Jobs recomendados (D42, S-6)', () => {
  beforeEach(async (context) => {
    if (!inject('samsaraMockUrl')) context.skip();
    await resetDb();
    await cleanSamsara();
    await connectTestTrucks(TRUCK, '944');
  });
  afterAll(async () => {
    if (inject('samsaraMockUrl')) await cleanSamsara();
  });

  it('A95 | S-6: se recomiendan los códigos que encendieron check engine; con la luz STOP también los demás, marcados por la luz', async () => {
    const { id } = await truckRow();
    await setSamsara({ vehicles: [vehicle()], faults: [j1939({ emissions: true }, { spn: 2659, fmi: 17, mil: 1 }, { spn: 111, fmi: 1, mil: 0 })] });
    await sync();
    let items = await recommendations(id);
    same('sin STOP: solo el código de check engine, sin Job aprendido', items.map((item) => [item.fault.code, item.reason, item.suggestedJob]), [['SPN 2659 · FMI 17', 'check_engine', null]]);

    await setSamsara({ vehicles: [vehicle()], faults: [j1939({ stop: true, emissions: true }, { spn: 2659, fmi: 17, mil: 1 }, { spn: 111, fmi: 1, mil: 0 })] });
    await sync();
    items = await recommendations(id);
    same('con STOP: también el otro código, marcado por la luz', items.map((item) => [item.fault.code, item.reason]).sort(), [['SPN 111 · FMI 1', 'stop_light'], ['SPN 2659 · FMI 17', 'check_engine']].sort());
    refused('un mecánico no ve las recomendaciones', await as(USERS.alignment).get(`/admin/trucks/${id}/fault-recommendations`), 403);
  });

  it('A96 | S-6: agregar el Job desde Add work lo liga a la falla, aprende el código, el mecánico la ve en su Job; otra falla se agrega al mismo Job; el código aprendido se sugiere en otro camión', async () => {
    const { id } = await truckRow();
    const other = await prisma.truck.findUniqueOrThrow({ where: { truckNumber: '944' } });
    const airLeak = await catalogJob('Air & Brake System', 'Air Leak');
    const mechanic = await userId(USERS.alignment);
    await setSamsara({
      vehicles: [vehicle(), vehicle('944')],
      faults: [j1939({ stop: true }, { spn: 2659, fmi: 17, mil: 1 }, { spn: 111, fmi: 1, mil: 0 }), readingFor('944', {}, { spn: 2659, fmi: 17, mil: 1 })],
    });
    await sync();
    const items = await recommendations(id);
    const egr = items.find((item) => item.fault.code === 'SPN 2659 · FMI 17');
    const coolant = items.find((item) => item.fault.code === 'SPN 111 · FMI 1');

    const plan = ok('Add work con la falla', await manager.post(`/admin/trucks/${id}/work-plan/jobs`, {
      idempotencyKey: randomUUID(),
      jobs: [{ catalogJobId: airLeak.id, categoryId: airLeak.categoryId, displayName: airLeak.displayName, assignedMechanicId: mechanic, samsaraFaultIds: [egr.fault.id] }],
    })) as Json;
    const job = (plan.jobs as Json[]).find((row) => row.catalogJobId === airLeak.id);
    truthy('el Job está en el plan', job);
    same('la falla quedó ligada a ese Job', (await prisma.workOrderJobSource.findMany({ where: { truckFaultId: egr.fault.id }, select: { workOrderJobId: true, kind: true } })), [{ workOrderJobId: job.id, kind: 'samsara_fault' }]);
    same('el código aprendió su Job', (await prisma.samsaraFaultCodeJob.findUnique({ where: { codeKey: 'j1939:SPN:2659:FMI:17' } }))?.catalogJobId, airLeak.id);
    same('ya no se recomienda', (await recommendations(id)).map((item) => item.fault.code), ['SPN 111 · FMI 1']);

    refused('agregarla otra vez se rechaza', await manager.post(`/admin/trucks/${id}/work-plan/jobs`, {
      idempotencyKey: randomUUID(),
      expectedVersion: plan.workOrder.version,
      jobs: [{ catalogJobId: airLeak.id, categoryId: airLeak.categoryId, displayName: airLeak.displayName, samsaraFaultIds: [egr.fault.id] }],
    }), 409, 'FAULT_ALREADY_IN_WORK');

    ok('la otra falla se agrega al mismo Job', await manager.post(`/admin/trucks/${id}/faults/link`, { workOrderJobId: job.id, faultIds: [coolant.fault.id] }));
    same('no queda nada por recomendar', (await recommendations(id)).length, 0);

    const faults = ok('pestaña Faults', await manager.get(`/admin/trucks/${id}/faults`)) as Json;
    same('cada falla dice en qué WO y Job está', (faults.active as Json[]).map((fault) => [fault.code, fault.jobs[0]?.jobName, fault.jobs[0]?.status]).sort(), [['SPN 111 · FMI 1', 'Air Leak', 'to_do'], ['SPN 2659 · FMI 17', 'Air Leak', 'to_do']].sort());

    const detail = ok('el mecánico abre su Work Order', await as(USERS.alignment).get(`/work-orders/${plan.workOrder.id}`)) as Json;
    const mine = (detail.jobs as Json[]).find((row) => row.id === job.id);
    same('ve las fallas en su Job', (mine.samsaraFaults as Json[]).map((fault) => fault.code).sort(), ['SPN 111 · FMI 1', 'SPN 2659 · FMI 17']);

    const elsewhere = await recommendations(other.id);
    same('en otro camión el mismo código ya viene con su Job', elsewhere.map((item) => [item.fault.code, item.suggestedJob?.catalogJobId, item.existingJob]), [['SPN 2659 · FMI 17', airLeak.id, null]]);
  });

  it('A97 | S-6: "Ahora no" pide razón y saca la falla de las recomendaciones; completado el Job y cerrada la falla queda "Fixed"; si vuelve dentro de 48 h queda "Came back"', async () => {
    const { id } = await truckRow();
    const airLeak = await catalogJob('Air & Brake System', 'Air Leak');
    await setSamsara({ vehicles: [vehicle()], faults: [j1939({ emissions: true }, { spn: 2659, fmi: 17, mil: 1 }, { spn: 3216, fmi: 5, mil: 1 })] });
    await sync();
    const items = await recommendations(id);
    const egr = items.find((item) => item.fault.code === 'SPN 2659 · FMI 17');
    const nox = items.find((item) => item.fault.code === 'SPN 3216 · FMI 5');

    refused('descartar sin razón', await manager.post(`/admin/trucks/${id}/faults/${nox.fault.id}/dismiss`, { reason: ' ' }), 400);
    ok('descartar con razón', await manager.post(`/admin/trucks/${id}/faults/${nox.fault.id}/dismiss`, { reason: 'Pieza pedida' }));
    same('ya no se recomienda', (await recommendations(id)).map((item) => item.fault.code), ['SPN 2659 · FMI 17']);
    let faults = ok('pestaña Faults', await manager.get(`/admin/trucks/${id}/faults`)) as Json;
    same('la falla dice por qué', (faults.active as Json[]).find((fault) => fault.id === nox.fault.id)?.dismissed?.reason, 'Pieza pedida');

    const plan = ok('Add work con la falla', await manager.post(`/admin/trucks/${id}/work-plan/jobs`, {
      idempotencyKey: randomUUID(),
      jobs: [{ catalogJobId: airLeak.id, categoryId: airLeak.categoryId, displayName: airLeak.displayName, samsaraFaultIds: [egr.fault.id] }],
    })) as Json;
    const job = (plan.jobs as Json[]).find((row) => row.catalogJobId === airLeak.id);
    ok('el Manager completa el Job', await adminCompleteJob(plan.workOrder.id, job.id));

    await setSamsara({ vehicles: [vehicle()], faults: [j1939({}, { spn: 3216, fmi: 5, mil: 1 })] });
    await sync();
    faults = ok('pestaña Faults', await manager.get(`/admin/trucks/${id}/faults`)) as Json;
    const fixed = (faults.history as Json[]).find((fault) => fault.id === egr.fault.id);
    same('cerrada con su Job completado (Fixed)', [Boolean(fixed?.clearedAt), fixed?.jobs[0]?.status, fixed?.jobs[0]?.workOrderDisplayId], [true, 'completed', plan.workOrder.displayId]);

    await setSamsara({ vehicles: [vehicle()], faults: [j1939({ emissions: true }, { spn: 2659, fmi: 17, mil: 1 }, { spn: 3216, fmi: 5, mil: 1 })] });
    await sync();
    faults = ok('pestaña Faults', await manager.get(`/admin/trucks/${id}/faults`)) as Json;
    const back = (faults.active as Json[]).find((fault) => fault.code === 'SPN 2659 · FMI 17');
    same('volvió dentro de 48 h: dice de qué WO', back?.cameBackAfter?.displayId, plan.workOrder.displayId);
    same('y se recomienda otra vez', (await recommendations(id)).map((item) => item.fault.code), ['SPN 2659 · FMI 17']);
  });
});

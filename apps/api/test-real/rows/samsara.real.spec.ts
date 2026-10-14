import { afterAll, beforeEach, describe, inject, it } from 'vitest';
import { REAL_CRON_SECRET } from '../env';
import { USERS, Json, as, manager, ok, prisma, refused, same, truthy } from '../harness';
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

function stat(miles: number, address: string, at = '2026-10-14T15:00:00Z') {
  return {
    id: `v-${TRUCK}`,
    obdOdometerMeters: { time: at, value: Math.round(miles * MILE) },
    gps: { time: at, latitude: 29.7355, longitude: -94.9774, speedMilesPerHour: 62, reverseGeo: { formattedLocation: address } },
  };
}

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
  await prisma.truckFault.deleteMany({});
  await prisma.truck.updateMany({
    data: {
      samsaraVehicleId: null, samsaraOdometerMiles: null, samsaraOdometerSource: null, samsaraOdometerAt: null, samsaraAddress: null,
      samsaraLatitude: null, samsaraLongitude: null, samsaraSpeedMph: null, samsaraLocationAt: null, samsaraSyncedAt: null,
    },
  });
  await setSamsara(EMPTY_SAMSARA_FIXTURE);
}

function cron(method: 'GET' | 'POST', secret?: string) {
  return fetch(`${inject('apiUrl')}/api/internal/samsara-sync`, { method, headers: secret ? { Authorization: `Bearer ${secret}` } : {} });
}

describe('Manager: Samsara (D35, D42)', () => {
  beforeEach(async (context) => {
    if (!inject('samsaraMockUrl')) context.skip();
    await cleanSamsara();
  });
  afterAll(async () => {
    if (inject('samsaraMockUrl')) await cleanSamsara();
  });

  it('A91 | S-1: Setup → Samsara dice qué vehículo es cada camión sin escribir nada; un mecánico no entra', async () => {
    await setSamsara({ vehicles: [vehicle(), { id: 'v-trailer', name: 'Trailer 9001' }] });
    const before = await prisma.truck.findMany({ select: { id: true, samsaraId: true, samsaraVehicleId: true, mileage: true }, orderBy: { id: 'asc' } });

    const pairing = ok('leer Setup → Samsara', await manager.get('/admin/integrations/samsara/pairing')) as Json;
    same('el 931 casa por número con su vehículo', (pairing.paired as Json[]).map((row) => [row.truck.truckNumber, row.vehicle.id, row.method]), [[TRUCK, `v-${TRUCK}`, 'number']]);
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

/**
 * Demo only (`reset-demo-work-orders --demo`): Parts & costs in use — vendors (one inactive), part prices and usual
 * vendors, purchases over four months (several lines, tax and freight, one split across two trucks, one for shop stock,
 * one corrected and one voided) and outside repairs (one tied to a Job that came back, one to a truck out now, two
 * loose ones). Everything goes through the API services as the Manager; `retime` moves each save to its invoice day.
 */
import { randomUUID } from 'node:crypto';
import type { Actors, DemoKit, TruckRow } from './demo-kit';
import type { HistoryResult } from './demo-history';
import { daysAgo, isoDay, retime, seededRandom, shopToday } from './demo-time';

const VENDORS = [
  { key: 'fleetpride', name: 'FleetPride', doesParts: true, doesRepairs: false, phone: '(813) 555-0142', accountNumber: 'LTL-20931', prefix: 'FP' },
  { key: 'truckpro', name: 'TruckPro', doesParts: true, doesRepairs: false, phone: '(813) 555-0177', accountNumber: 'C-88412', prefix: 'TP' },
  { key: 'rush', name: 'Rush Truck Centers', doesParts: true, doesRepairs: true, phone: '(813) 555-0110', accountNumber: 'RTC-5521', prefix: 'RTC' },
  { key: 'dieselpro', name: 'Diesel Pro Repair', doesParts: false, doesRepairs: true, phone: '(813) 555-0190', prefix: 'DP' },
  { key: 'bodyshop', name: 'Bay Area Body Shop', doesParts: false, doesRepairs: true, phone: '(813) 555-0163', prefix: 'BA' },
  { key: 'oldsupply', name: 'Old Supply Co', doesParts: true, doesRepairs: false, notes: 'Ya no les compramos.', prefix: 'OS' },
] as const;

type VendorKey = (typeof VENDORS)[number]['key'];

/** What each repair needs from a parts store (description, quantity, unit cost in cents, vendor). */
const REPAIR_PARTS: Record<string, { description: string; quantity: number; unitCostCents: number; vendor: VendorKey }> = {
  'Brake Chambers': { description: 'Brake chamber 30/30 long stroke', quantity: 2, unitCostCents: 6450, vendor: 'fleetpride' },
  'Air Leak': { description: 'Air line fitting kit', quantity: 1, unitCostCents: 2875, vendor: 'fleetpride' },
  Alternator: { description: 'Alternator 160A remanufactured', quantity: 1, unitCostCents: 28900, vendor: 'rush' },
  Lights: { description: 'LED marker light', quantity: 2, unitCostCents: 1899, vendor: 'truckpro' },
  Tires: { description: 'Drive tire 11R22.5', quantity: 2, unitCostCents: 43500, vendor: 'rush' },
  'Wheel Seals': { description: 'Wheel seal kit', quantity: 1, unitCostCents: 8950, vendor: 'fleetpride' },
  'Cooling Hoses': { description: 'Upper radiator hose', quantity: 1, unitCostCents: 11200, vendor: 'truckpro' },
  'DPF/DEF Service': { description: 'DPF gasket kit', quantity: 1, unitCostCents: 6400, vendor: 'rush' },
  'Shock Replacement': { description: 'Front shock absorber', quantity: 2, unitCostCents: 9800, vendor: 'fleetpride' },
  Mirrors: { description: 'Driver mirror assembly', quantity: 1, unitCostCents: 32500, vendor: 'truckpro' },
  'A/C': { description: 'R-134a refrigerant 30 lb', quantity: 1, unitCostCents: 15900, vendor: 'truckpro' },
  '5th Wheel': { description: 'Fifth wheel grease 35 lb', quantity: 1, unitCostCents: 5400, vendor: 'fleetpride' },
};

/** Reference price of the PM parts, by part category. */
const PM_PART_COST: Record<string, number> = {
  'Fuel Filter': 3200,
  'Paper Fuel Filter': 2800,
  'Cabin Air Filter': 2400,
  'Engine Air Filter': 8900,
  'Wiper Blades': 1500,
  'Coolant Filter': 2100,
  'Oil Filter 2 Unit': 1950,
  'Oil Filter 1 Unit': 1850,
  'Desiccant Filter': 4600,
};

type Line = { partId?: string; description?: string; quantity: number; unitCostCents: number; truckId?: string | null };
type PurchaseInput = { vendorId: string; invoiceNumber: string; invoiceDate: string; taxCents: number; freightCents: number; notes?: string; lines: Line[] };

export type CurrentJobs = {
  /** DEMO-external-truck: the Job whose truck is at an outside shop now. */
  truckOut?: { truck: TruckRow; jobId: string };
  /** M03-blocked: the truck waiting for parts. */
  waitingForParts?: { truck: TruckRow };
};

export async function buildPartsCosts(kit: DemoKit, actors: Actors, history: HistoryResult, current: CurrentJobs) {
  const random = seededRandom(7310);
  const manager = actors.manager;
  const counters = new Map<VendorKey, number>();
  const invoiceNumber = (vendor: VendorKey) => {
    const next = (counters.get(vendor) ?? 0) + 1;
    counters.set(vendor, next);
    return `${VENDORS.find((item) => item.key === vendor)!.prefix}-${48100 + next * 37}`;
  };

  // Vendors.
  const vendorIds = new Map<VendorKey, string>();
  for (const vendor of VENDORS) {
    const { key, prefix: _prefix, ...input } = vendor;
    const saved = await kit.partsCatalog.createVendor(manager, input) as { id: string };
    vendorIds.set(key, saved.id);
  }
  await kit.partsCatalog.updateVendor(manager, vendorIds.get('oldsupply')!, { active: false });
  const vendorId = (key: VendorKey) => vendorIds.get(key)!;

  // Prices and usual vendor for the PM parts the shop uses, plus one part added in the app.
  // Every PM part gets a price; the ones the shop used also get their usual vendor.
  const usedPartIds = (await kit.prisma.pmServicePart.findMany({ select: { partId: true }, distinct: ['partId'] })).map((row) => row.partId);
  const parts = await kit.prisma.part.findMany({ where: { active: true }, include: { category: { select: { name: true } } }, orderBy: { displayName: 'asc' } });
  for (const [index, part] of parts.entries()) {
    const base = PM_PART_COST[part.category.name] ?? 2500;
    await kit.partsCatalog.updatePart(manager, part.id, {
      unitCostCents: base + (index % 5) * 125,
      ...(usedPartIds.includes(part.id) ? { defaultVendorId: vendorId(index % 2 ? 'truckpro' : 'fleetpride') } : {}),
    });
  }
  const wiperCategory = await kit.prisma.partCategory.findFirst({ where: { name: 'Wiper Blades' } });
  if (wiperCategory) {
    await kit.partsCatalog.createPart(manager, {
      categoryId: wiperCategory.id, partNumber: 'WB-22HD', displayName: 'Wiper blade 22 in heavy duty', unitCostCents: 1650, defaultVendorId: vendorId('truckpro'),
    });
  }
  const price = new Map((await kit.prisma.part.findMany({ select: { id: true, unitCostCents: true } })).map((row) => [row.id, row.unitCostCents ?? 2500]));

  // Purchases: what each past visit bought (its repair parts and its PM filters), on the visit's day.
  const saved: Array<{ id: string; input: PurchaseInput; day: string }> = [];
  const save = async (input: PurchaseInput, day: string) => {
    const since = new Date();
    const result = await kit.purchases.create(manager, input, randomUUID()) as { id: string };
    await retime(kit.prisma, since, parseDay(day), { startMinutes: 9 * 60 + Math.floor(random() * 300), random });
    saved.push({ id: result.id, input, day });
    return result.id;
  };

  for (const visit of history.workOrders) {
    const repairLines = visit.repairs.filter((repair) => REPAIR_PARTS[repair.job]);
    const pmParts = await kit.prisma.pmServicePart.findMany({ where: { pmService: { workOrderId: visit.id } }, select: { partId: true } });
    if (!repairLines.length && random() < 0.5) continue;
    const vendor = repairLines.length ? REPAIR_PARTS[repairLines[0].job].vendor : 'fleetpride';
    const lines: Line[] = [
      ...repairLines.map((repair) => {
        const { description, quantity, unitCostCents } = REPAIR_PARTS[repair.job];
        return { description, quantity, unitCostCents, truckId: visit.truck.id };
      }),
      ...pmParts.map((part) => ({ partId: part.partId, quantity: 1, unitCostCents: price.get(part.partId) ?? 2500, truckId: visit.truck.id })),
    ];
    if (!lines.length) continue;
    const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitCostCents, 0);
    await save({
      vendorId: vendorId(vendor),
      invoiceNumber: invoiceNumber(vendor),
      invoiceDate: visit.day,
      taxCents: random() < 0.6 ? Math.round(subtotal * 0.07) : 0,
      freightCents: random() < 0.3 ? 2500 : 0,
      lines,
    }, visit.day);
  }

  // One invoice for two trucks, one for shop stock, one for the truck waiting for parts.
  const [firstTruck, secondTruck] = [...new Map(history.workOrders.map((visit) => [visit.truck.id, visit.truck])).values()];
  if (firstTruck && secondTruck) {
    const day = isoDay(daysAgo(45));
    await save({
      vendorId: vendorId('rush'), invoiceNumber: invoiceNumber('rush'), invoiceDate: day, taxCents: 4116, freightCents: 3500,
      notes: 'Llantas para dos unidades.',
      lines: [
        { description: 'Steer tire 295/75R22.5', quantity: 2, unitCostCents: 39900, truckId: firstTruck.id },
        { description: 'Steer tire 295/75R22.5', quantity: 2, unitCostCents: 39900, truckId: secondTruck.id },
      ],
    }, day);
  }
  const stockDay = isoDay(daysAgo(60));
  const stockLines: Line[] = usedPartIds.slice(0, 4).map((partId) => ({ partId, quantity: 6, unitCostCents: price.get(partId) ?? 2500, truckId: null }));
  if (stockLines.length) {
    await save({ vendorId: vendorId('fleetpride'), invoiceNumber: invoiceNumber('fleetpride'), invoiceDate: stockDay, taxCents: 0, freightCents: 1800, notes: 'Filtros para el estante.', lines: stockLines }, stockDay);
  }
  if (current.waitingForParts) {
    const today = isoDay(shopToday());
    await save({
      vendorId: vendorId('truckpro'), invoiceNumber: invoiceNumber('truckpro'), invoiceDate: today, taxCents: 1652, freightCents: 0,
      notes: 'Bolsa de aire pedida; llega mañana.',
      lines: [{ description: 'Rear air spring, driver side', quantity: 1, unitCostCents: 23600, truckId: current.waitingForParts.truck.id }],
    }, today);
  }

  // A correction (quantity fixed two days later) and a voided invoice.
  const tenDaysAgo = isoDay(daysAgo(10));
  const toCorrect = saved.find((item) => item.day < tenDaysAgo && item.input.lines.length > 1 && item.input.lines[0].quantity === 1);
  if (toCorrect) {
    const since = new Date();
    const corrected = { ...toCorrect.input, lines: toCorrect.input.lines.map((line, index) => (index === 0 ? { ...line, quantity: 2 } : line)) };
    await kit.purchases.update(manager, toCorrect.id, corrected);
    await retime(kit.prisma, since, nextDay(toCorrect.day, 2), { startMinutes: 11 * 60, random });
  }
  const voidDay = isoDay(daysAgo(20));
  if (firstTruck) {
    const voidId = await save({
      vendorId: vendorId('truckpro'), invoiceNumber: invoiceNumber('truckpro'), invoiceDate: voidDay, taxCents: 0, freightCents: 0,
      lines: [{ description: 'Headlight assembly', quantity: 1, unitCostCents: 18900, truckId: firstTruck.id }],
    }, voidDay);
    const since = new Date();
    await kit.purchases.void(manager, voidId, { reason: 'Pieza devuelta: el proveedor anuló la factura.' });
    await retime(kit.prisma, since, nextDay(voidDay, 1), { startMinutes: 10 * 60, random });
  }

  // Outside repairs.
  const repairs: Array<{ truck: TruckRow; vendor: VendorKey; day: string; description: string; amountCents: number; workOrderJobId?: string }> = [];
  if (history.external) {
    repairs.push({ truck: history.external.truck, vendor: 'dieselpro', day: history.external.day, description: 'Transmission rebuild', amountCents: 385000, workOrderJobId: history.external.jobId });
  }
  if (current.truckOut) {
    repairs.push({ truck: current.truckOut.truck, vendor: 'bodyshop', day: isoDay(shopToday()), description: 'Rear air bag and bracket repair', amountCents: 68500, workOrderJobId: current.truckOut.jobId });
  }
  const others = history.workOrders.map((visit) => visit.truck);
  if (others.length > 2) {
    repairs.push({ truck: others[1], vendor: 'rush', day: isoDay(daysAgo(75)), description: 'DPF cleaning (outside)', amountCents: 65000 });
    repairs.push({ truck: others[others.length - 2], vendor: 'bodyshop', day: isoDay(daysAgo(50)), description: 'Windshield replacement', amountCents: 48000 });
  }
  for (const repair of repairs) {
    const since = new Date();
    await kit.outsideRepairs.create(manager, {
      truckId: repair.truck.id,
      vendorId: vendorId(repair.vendor),
      invoiceNumber: invoiceNumber(repair.vendor),
      invoiceDate: repair.day,
      description: repair.description,
      amountCents: repair.amountCents,
      workOrderJobId: repair.workOrderJobId ?? null,
    }, randomUUID());
    // A repair tied to a Job that is out now keeps today's time (the Job's own rows are in this window too).
    if (repair.day !== isoDay(shopToday())) await retime(kit.prisma, since, parseDay(repair.day), { startMinutes: 14 * 60, random });
  }

  return { vendors: VENDORS.length, partsPriced: parts.length, partsWithVendor: usedPartIds.length, purchases: saved.length, outsideRepairs: repairs.length };
}

function parseDay(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function nextDay(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return parseDay(date.toISOString().slice(0, 10));
}

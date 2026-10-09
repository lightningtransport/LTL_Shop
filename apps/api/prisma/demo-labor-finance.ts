/**
 * Demo only (`reset-demo-work-orders --demo`), after the history and Parts & costs: the shop labor rate (D34, LB-1)
 * and internal invoices to Finance (LB-2).
 *
 * Rates: $95/h from about four and a half months ago and $105/h from the first of this month. The newer one is saved
 * first, so each completed Work Order gets one labor row at the rate of its day (no reversals in Costs).
 * Invoices: two accepted, one sent, one voided (from earlier months) and a draft for this month.
 */
import type { Actors, DemoKit, TruckRow } from './demo-kit';
import type { HistoryResult } from './demo-history';
import { daysAgo, isoDay, retime, shopToday } from './demo-time';
import type { LocalDate } from '../src/common/shop-time';

const monthKey = (day: LocalDate) => `${day.year}-${String(day.month).padStart(2, '0')}`;
const firstOfMonth = (day: LocalDate, back = 0): LocalDate => {
  const date = new Date(Date.UTC(day.year, day.month - 1 - back, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: 1 };
};
const dayOfMonth = (first: LocalDate, day: number): LocalDate => ({ ...first, day });

export async function buildLaborAndInvoices(kit: DemoKit, actors: Actors, history: HistoryResult) {
  const manager = actors.manager;
  const today = shopToday();
  const thisMonth = firstOfMonth(today);

  // Labor rate. The newer first: then the older one adds each earlier Work Order once.
  let since = new Date();
  await kit.laborRates.set(manager, { rateCentsPerHour: 10500, effectiveFrom: isoDay(thisMonth), notes: 'Ajuste anual de la tarifa.' });
  if (thisMonth.day !== today.day) await retime(kit.prisma, since, thisMonth, { startMinutes: 8 * 60 });
  const older = daysAgo(135);
  since = new Date();
  await kit.laborRates.set(manager, { rateCentsPerHour: 9500, effectiveFrom: isoDay(older), notes: 'Tarifa del taller.' });
  await retime(kit.prisma, since, older, { startMinutes: 8 * 60 });

  // Internal invoices: one per truck and month, sent a few days after the month closes.
  const trucks = [...new Map(history.workOrders.map((visit) => [visit.truck.id, visit.truck])).values()];
  const invoice = async (truck: TruckRow, back: number, steps: Array<'send' | 'accept' | 'void'>) => {
    const month = firstOfMonth(today, back);
    const next = firstOfMonth(today, back - 1);
    let start = new Date();
    let created: { id: string };
    try {
      created = await kit.internalInvoices.create(manager, { truckId: truck.id, month: monthKey(month) });
    } catch (error) {
      // Nothing to charge for that truck up to that month: try the next truck.
      const code = (error as { getResponse?: () => { code?: string } }).getResponse?.()?.code;
      if (code === 'NOTHING_TO_CHARGE') return null;
      throw error;
    }
    if (steps.includes('send')) await kit.internalInvoices.send(manager, created.id);
    if (back > 0) await retime(kit.prisma, start, dayOfMonth(next, 3), { startMinutes: 10 * 60 });
    if (steps.includes('accept')) {
      start = new Date();
      await kit.internalInvoices.accept(manager, created.id);
      if (back > 0) await retime(kit.prisma, start, dayOfMonth(next, 7), { startMinutes: 11 * 60 });
    }
    if (steps.includes('void')) {
      start = new Date();
      await kit.internalInvoices.void(manager, created.id, { reason: 'Se mandó con el mes equivocado; va en la siguiente.' });
      if (back > 0) await retime(kit.prisma, start, dayOfMonth(next, 5), { startMinutes: 9 * 60 });
    }
    return created.id;
  };

  // Each one goes to the next truck that still has something to charge up to that month.
  const specs: Array<{ back: number; steps: Array<'send' | 'accept' | 'void'> }> = [
    { back: 2, steps: ['send', 'accept'] },
    { back: 2, steps: ['send', 'accept'] },
    { back: 1, steps: ['send', 'void'] },
    { back: 1, steps: ['send'] },
    { back: 0, steps: [] },
  ];
  const made: string[] = [];
  let next = 0;
  for (const spec of specs) {
    for (let tries = 0; tries < trucks.length; tries += 1) {
      const id = await invoice(trucks[next++ % trucks.length], spec.back, spec.steps);
      if (id) {
        made.push(id);
        break;
      }
    }
  }
  return { rates: 2, invoices: made.length };
}

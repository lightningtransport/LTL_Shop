import { describe, expect, it } from 'vitest';
import { WorkOrderStatus, type AdminWorkOrderSummaryDto, type TruckNextStepDto } from '@ltl-shop/shared';
import { dashboardCounts, dashboardGroupOf, groupDashboardQueue, leavingSoonNotReady, nextShopDay, shopDay } from './dashboard-queue';

function item(id: string, step: TruckNextStepDto['kind'], extra: Partial<AdminWorkOrderSummaryDto> = {}): AdminWorkOrderSummaryDto {
  return {
    id, displayId: id, truck: { id: `t-${id}`, truckNumber: id, make: null, model: null, year: null },
    category: { id: 'c', name: 'Engine' }, status: 'in_progress', priority: 'normal', jobsCompleted: 1, jobsTotal: 4,
    mechanics: [], currentPause: null, latestReportedBlocker: null, createdAt: '', startedAt: null, completedAt: null, updatedAt: '',
    nextStep: { kind: step, workOrderId: id }, ...extra,
  } as AdminWorkOrderSummaryDto;
}

describe('Dashboard queue (stage 3 / D1, UX-5-002)', () => {
  it('D52 (LTR-260): in Return to Service, a truck Samsara saw leave the yard (or come back) goes first', () => {
    const plain = item('r1', 'return_to_service', { status: WorkOrderStatus.COMPLETED });
    const left = item('r2', 'return_to_service', { status: WorkOrderStatus.COMPLETED, nextStep: { kind: 'return_to_service', workOrderId: 'r2', yardMove: { kind: 'left_yard', at: '2026-10-21T15:00:00.000Z' } } });
    expect(groupDashboardQueue([plain, left]).map((entry) => entry.items.map((row) => row.id))).toEqual([['r2', 'r1']]);
  });

  it('groups by the action the Manager takes, in order, and leaves plain work out', () => {
    const queue = [item('w', 'work'), item('r', 'return_to_service', { status: WorkOrderStatus.COMPLETED }), item('b', 'resolve_blocker'), item('p', 'resume'), item('c', 'close'), item('a', 'assign')];
    expect(groupDashboardQueue(queue).map((entry) => [entry.group, entry.items.map((row) => row.id)])).toEqual([
      ['blocked', ['b', 'p']],
      ['close', ['c']],
      ['return_to_service', ['r']],
      ['assign', ['a']],
    ]);
    expect(dashboardGroupOf(item('w', 'work'))).toBeNull();
  });

  it('a counter filters the queue to its group', () => {
    const queue = [item('b', 'resolve_blocker'), item('c', 'close')];
    expect(groupDashboardQueue(queue, 'close').map((entry) => entry.group)).toEqual(['close']);
  });

  it('"Blocked" counts official pauses and active blockers, like the Yard (D5)', () => {
    const pause = { reason: 'waiting_for_parts' } as AdminWorkOrderSummaryDto['currentPause'];
    const counts = dashboardCounts([
      item('paused', 'resume', { status: WorkOrderStatus.WAITING_PAUSED, currentPause: pause }),
      // A blocker counts even when another step (here "close") comes first.
      item('blocked', 'close', { latestReportedBlocker: pause }),
      item('rtg', 'return_to_service', { status: WorkOrderStatus.COMPLETED }),
      item('a', 'assign'),
    ]);
    expect(counts).toEqual({ blocked: 2, close: 1, return_to_service: 1, assign: 1 });
  });
});

describe('Leaving soon and not ready (UX-5-004)', () => {
  it('the next shop day skips the weekend (D20, Monday–Friday)', () => {
    expect(nextShopDay('2026-10-05')).toBe('2026-10-06'); // Monday → Tuesday
    expect(nextShopDay('2026-10-09')).toBe('2026-10-12'); // Friday → Monday
  });

  it('the shop day is the Eastern date', () => {
    expect(shopDay(new Date('2026-10-06T02:30:00.000Z'))).toBe('2026-10-05');
  });

  it('crosses Dispatch departures (today or the next shop day) with open Work Orders only', () => {
    const open = item('601', 'work', { jobsCompleted: 2, jobsTotal: 5 });
    const ready = item('282', 'return_to_service', { status: WorkOrderStatus.COMPLETED });
    const later = item('604', 'close');
    const result = leavingSoonNotReady([open, ready, later], [
      { truckNumber: '601', outDate: '2026-10-06' },
      { truckNumber: '282', outDate: '2026-10-06' },
      { truckNumber: '604', outDate: '2026-10-08' },
      { truckNumber: '999', outDate: '2026-10-05' },
    ], '2026-10-05');
    expect(result.map((entry) => [entry.item.id, entry.outDate])).toEqual([['601', '2026-10-06']]);
  });
});

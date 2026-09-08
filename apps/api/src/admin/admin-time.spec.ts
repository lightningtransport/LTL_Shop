import { describe, expect, it } from 'vitest';
import { getShopDashboardWindows } from './admin-time';

describe('Admin dashboard calendar windows', () => {
  it('uses the New York calendar day and handles spring DST', () => {
    const windows = getShopDashboardWindows(new Date('2026-03-08T16:00:00.000Z'));

    expect(windows.timeZone).toBe('America/New_York');
    expect(windows.today).toEqual({
      from: '2026-03-08T05:00:00.000Z',
      to: '2026-03-09T04:00:00.000Z',
    });
    expect(windows.last7Days.from).toBe('2026-03-02T05:00:00.000Z');
  });

  it('uses the New York calendar day and handles fall DST', () => {
    const windows = getShopDashboardWindows(new Date('2026-11-01T17:00:00.000Z'));

    expect(windows.today).toEqual({
      from: '2026-11-01T04:00:00.000Z',
      to: '2026-11-02T05:00:00.000Z',
    });
    expect(windows.last7Days.from).toBe('2026-10-26T04:00:00.000Z');
  });
});

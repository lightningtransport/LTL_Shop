import { describe, expect, it } from 'vitest';
import { cutoffToMinutes, minutesToCutoff, updateShopHoursSchema } from './shop-hours';

describe('shop hours (LTR-186 / D20)', () => {
  it('converts HH:MM and minutes both ways', () => {
    expect(cutoffToMinutes('17:00')).toBe(1020);
    expect(cutoffToMinutes('23:59')).toBe(1439);
    expect(cutoffToMinutes('7:00')).toBeNull();
    expect(cutoffToMinutes('24:00')).toBeNull();
    expect(minutesToCutoff(1020)).toBe('17:00');
    expect(minutesToCutoff(750)).toBe('12:30');
  });

  it('accepts a cutoff from 12:00 to 23:59 and a non-empty set of weekdays', () => {
    expect(updateShopHoursSchema.safeParse({ cutoff: '17:00', workdays: [1, 2, 3, 4, 5] }).success).toBe(true);
    expect(updateShopHoursSchema.safeParse({ cutoff: '12:00', workdays: [6] }).success).toBe(true);
    expect(updateShopHoursSchema.safeParse({ cutoff: '23:59', workdays: [1, 2, 3, 4, 5, 6, 7] }).success).toBe(true);
  });

  it('refuses a morning cutoff, a bad time, no days, an unknown day or a repeated day', () => {
    expect(updateShopHoursSchema.safeParse({ cutoff: '11:59', workdays: [1] }).success).toBe(false);
    expect(updateShopHoursSchema.safeParse({ cutoff: '5pm', workdays: [1] }).success).toBe(false);
    expect(updateShopHoursSchema.safeParse({ cutoff: '17:00', workdays: [] }).success).toBe(false);
    expect(updateShopHoursSchema.safeParse({ cutoff: '17:00', workdays: [0] }).success).toBe(false);
    expect(updateShopHoursSchema.safeParse({ cutoff: '17:00', workdays: [8] }).success).toBe(false);
    expect(updateShopHoursSchema.safeParse({ cutoff: '17:00', workdays: [1, 1] }).success).toBe(false);
    expect(updateShopHoursSchema.safeParse({ workdays: [1] }).success).toBe(false);
  });
});

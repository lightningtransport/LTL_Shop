import { describe, expect, it } from 'vitest';
import { formatIsoDate, formatVehicleYmm, pauseLabel, statusLabel, formatMileage } from './format';
import { formatAdminDateOnly } from './admin-format';
import { getShopCopy } from './locale-context';

describe('date-only identity formatters', () => {
  it('formats a stored ISO date without implying a time or yard state', () => {
    expect(formatIsoDate('2026-09-11', 'en')).toMatch(/Sep(t)?\.? 11, 2026|September 11, 2026/);
    expect(formatAdminDateOnly('2026-09-11', 'en')).toMatch(/Sep(t)?\.? 11, 2026|September 11, 2026/);
    expect(formatIsoDate(null)).toBe('—');
    expect(formatAdminDateOnly(null, 'es')).toBe('—');
  });

  it('localizes Work Order status chips from the shop catalog', () => {
    expect(statusLabel('created')).toBe('Created');
    expect(statusLabel('in_progress')).toBe('In Progress');
    expect(statusLabel('created', getShopCopy('es').status)).toBe('Creado');
    expect(statusLabel('in_progress', getShopCopy('es').status)).toBe('En progreso');
  });

  it('formats year/make/model without duplicating make when model already includes it', () => {
    expect(formatVehicleYmm({ year: 2024, make: 'PETERBILT', model: 'PETERBILT 579' })).toBe('2024 PETERBILT 579');
    expect(formatVehicleYmm({ year: 2024, make: 'Peterbilt', model: 'PETERBILT 579' })).toBe('2024 PETERBILT 579');
    expect(formatVehicleYmm({ year: 2024, make: 'Volvo', model: 'VNL' })).toBe('2024 Volvo VNL');
    expect(formatVehicleYmm({ year: 2022, make: 'Freightliner', model: 'Cascadia' })).toBe('2022 Freightliner Cascadia');
    expect(formatVehicleYmm({ year: 2024, make: 'Peterbilt', model: 'Peterbilt' })).toBe('2024 Peterbilt');
    expect(formatVehicleYmm({ year: null, make: 'Volvo', model: 'VNL' })).toBe('Volvo VNL');
    expect(formatVehicleYmm({ year: 2024, make: null, model: null })).toBe('2024');
    expect(formatVehicleYmm({ year: null, make: null, model: null })).toBe('');
  });

  it('localizes pause reasons from the shop catalog', () => {
    expect(pauseLabel('waiting_for_parts', getShopCopy('en').pauseReason)).toBe('Waiting for Parts');
    expect(pauseLabel('waiting_for_parts', getShopCopy('es').pauseReason)).toBe('En espera de piezas');
    expect(pauseLabel('end_of_shift', getShopCopy('es').pauseReason)).toBe('Fin del turno');
  });
});

describe('formatMileage (LTR-293 §13)', () => {
  it('writes miles the same way whatever the browser language', () => {
    expect(formatMileage(195676)).toBe('195,676 mi');
    expect(formatMileage(null)).toBe('—');
  });
});


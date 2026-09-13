import { describe, expect, it } from 'vitest';
import { formatIsoDate, pauseLabel, statusLabel } from './format';
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

  it('localizes pause reasons from the shop catalog', () => {
    expect(pauseLabel('waiting_for_parts', getShopCopy('en').pauseReason)).toBe('Waiting for Parts');
    expect(pauseLabel('waiting_for_parts', getShopCopy('es').pauseReason)).toBe('En espera de piezas');
    expect(pauseLabel('end_of_shift', getShopCopy('es').pauseReason)).toBe('Fin del turno');
  });
});

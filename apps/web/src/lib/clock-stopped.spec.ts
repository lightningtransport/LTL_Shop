import { describe, expect, it } from 'vitest';
import { clockStoppedLine } from './clock-stopped';
import { getShopCopy } from './locale-context';

describe('clockStoppedLine (LTR-186)', () => {
  const en = getShopCopy('en');
  const es = getShopCopy('es');

  it('says the day closed, in both languages', () => {
    expect(clockStoppedLine({ reason: 'day_close' }, en)).toBe('Yesterday\'s work is still open · tap Continue');
    expect(clockStoppedLine({ reason: 'day_close' }, es)).toBe('Ayer quedó en curso · toca Continuar');
  });

  it('names the Truck where my clock runs after a switch, or says it moved', () => {
    const elsewhere = { id: 'wo-2', displayId: 'WO-002', truckNumber: '944' };
    expect(clockStoppedLine({ reason: 'switched_truck', elsewhereWorkOrder: elsewhere }, en)).toBe('Your clock is on Truck 944 · tap Continue');
    expect(clockStoppedLine({ reason: 'switched_truck', elsewhereWorkOrder: elsewhere }, es)).toBe('Tu reloj está en la unidad 944 · toca Continuar');
    expect(clockStoppedLine({ reason: 'switched_truck', elsewhereWorkOrder: null }, en)).toBe('Your clock is stopped · tap Continue');
    expect(clockStoppedLine({ reason: 'switched_truck', elsewhereWorkOrder: null }, es)).toBe('Tu reloj está detenido · toca Continuar');
  });

  it('nothing when the clock was not stopped by the app', () => {
    expect(clockStoppedLine(null, en)).toBeNull();
    expect(clockStoppedLine(undefined, en)).toBeNull();
  });
});

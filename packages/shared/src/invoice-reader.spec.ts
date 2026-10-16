import { describe, expect, it } from 'vitest';
import { moneyToCents, readInvoiceLines } from './invoice-reader';

const context = {
  vendors: [{ id: 'v-fp', name: 'FleetPride' }, { id: 'v-tp', name: 'TruckPro' }, { id: 'v-x', name: 'Pro' }],
  parts: [
    { id: 'p-ff', partNumber: 'FF5825NN', displayName: 'Fuel filter' },
    { id: 'p-wp', partNumber: 'WP-1234', displayName: 'Water pump' },
  ],
};

describe('ST-6: reading a supplier PDF invoice (D45, P30)', () => {
  it('proposes vendor, number, date, lines with quantity × price, tax, freight and total', () => {
    const proposal = readInvoiceLines([
      'FleetPride Inc.  1234 Industrial Blvd, Dallas TX',
      'Invoice # 88412093           Invoice Date: 10/06/2026',
      'Item  Description  Qty  Price  Amount',
      'FF5825NN Fuel filter Fleetguard 2 24.10 48.20',
      'Brake pads (axle set) 1 89.99 89.99',
      'Bulk oil 15W-40 5.5 12.99 71.45',
      'Subtotal 209.64',
      'Sales Tax 4.37',
      'Freight 15.00',
      'Invoice Total $229.01',
    ], context);
    expect(proposal.vendorId).toBe('v-fp');
    expect(proposal.invoiceNumber).toBe('88412093');
    expect(proposal.invoiceDate).toBe('2026-10-06');
    expect(proposal.lines).toEqual([
      { description: 'FF5825NN Fuel filter Fleetguard', partId: 'p-ff', partNumber: 'FF5825NN', quantity: '2', unitCostCents: 2410 },
      { description: 'Brake pads (axle set)', partId: null, partNumber: null, quantity: '1', unitCostCents: 8999 },
      { description: 'Bulk oil 15W-40', partId: null, partNumber: null, quantity: '5.5', unitCostCents: 1299 },
    ]);
    expect([proposal.taxCents, proposal.freightCents, proposal.totalCents]).toEqual([437, 1500, 22901]);
  });

  it('reads "Oct 6, 2026" dates, thousands and lines with quantity and amount only', () => {
    const proposal = readInvoiceLines([
      'TRUCKPRO LLC',
      'INVOICE NO: TP-55210',
      'Date Oct 16, 2026',
      'Water pump WP-1234 reman 2 1,240.00',
      'TOTAL DUE 1,240.00',
    ], context);
    expect(proposal.vendorId).toBe('v-tp');
    expect(proposal.invoiceNumber).toBe('TP-55210');
    expect(proposal.invoiceDate).toBe('2026-10-16');
    expect(proposal.lines).toEqual([{ description: 'Water pump WP-1234 reman', partId: 'p-wp', partNumber: 'WP-1234', quantity: '2', unitCostCents: 62000 }]);
    expect(proposal.totalCents).toBe(124000);
  });

  it('proposes nothing it cannot read: no text, no vendor, no lines', () => {
    expect(readInvoiceLines([], context)).toEqual({ vendorId: null, invoiceNumber: null, invoiceDate: null, lines: [], taxCents: null, freightCents: null, totalCents: null });
    const proposal = readInvoiceLines(['Some shop', 'Thank you for your business', 'Page 1 of 1'], context);
    expect([proposal.vendorId, proposal.lines.length]).toEqual([null, 0]);
  });

  it('a line whose quantity × price does not match the amount is not guessed wrong', () => {
    const proposal = readInvoiceLines(['Mud flaps 2 35.00 99.00'], context);
    // 2 × 35.00 ≠ 99.00; falls back to quantity and amount only (35 is not a plausible quantity with cents).
    expect(proposal.lines).toEqual([]);
  });

  it('money', () => {
    expect([moneyToCents('$1,234.50'), moneyToCents('12'), moneyToCents('(4.00)'), moneyToCents('abc')]).toEqual([123450, 1200, -400, null]);
  });
});

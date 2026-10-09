import { expect, test, type Page, type Route } from './support/test';
import { devLogin } from './support/dev-login';

// LTR-201 / D34 (LB-2): the internal invoice to Finance, with the API mocked per test.
const invoiceId = '00000000-0000-4000-8000-0000000c0001';
const truck = { id: 'truck-606', truckNumber: '606' };

function invoice(status: 'draft' | 'sent', removed = false) {
  const lines = [
    { id: 'l1', costEntryId: 'e1', kind: 'part_purchase', description: 'FleetPride · 88412093 · Fuel Filter × 2', occurredOn: '2026-10-06', amountCents: 4820, sourceType: 'part_purchase', sourceId: 'p1', workOrder: null },
    { id: 'l2', costEntryId: 'e2', kind: 'outside_repair', description: 'Diesel Pro · 7712 · Radiator recore', occurredOn: '2026-10-08', amountCents: 184000, sourceType: 'outside_repair', sourceId: 'r1', workOrder: { id: 'wo1', displayId: 'WO-001' } },
    { id: 'l3', costEntryId: 'e3', kind: 'labor', description: 'WO-001 · 6.00 h × $95.00/h', occurredOn: '2026-10-09', amountCents: 57000, sourceType: 'work_order_labor', sourceId: 'wo1', workOrder: { id: 'wo1', displayId: 'WO-001' } },
  ];
  const active = removed ? lines.filter((line) => line.id !== 'l2') : lines;
  const sum = (kind: string) => active.filter((line) => line.kind === kind).reduce((total, line) => total + line.amountCents, 0);
  return {
    id: invoiceId, number: status === 'sent' ? 'SHOP-2026-0001' : null, truck, periodStart: '2026-10-01', periodEnd: '2026-10-31', status,
    totalCents: active.reduce((total, line) => total + line.amountCents, 0), lineCount: active.length, sentAt: status === 'sent' ? '2026-10-31T18:00:00.000Z' : null,
    subtotals: { partsCents: sum('part_purchase'), outsideCents: sum('outside_repair'), laborCents: sum('labor') },
    lines: active, removedLines: removed ? lines.filter((line) => line.id === 'l2') : [],
    notes: null, createdBy: { id: 'm', name: 'Shop Manager' }, createdAt: '2026-10-31T17:00:00.000Z', sentBy: status === 'sent' ? { id: 'm', name: 'Shop Manager' } : null,
    acceptedAt: null, acceptedBy: null, voidedAt: null, voidedBy: null, voidReason: null, availableCount: status === 'draft' ? 1 : 0,
  };
}

async function mockInvoices(page: Page) {
  let state: ReturnType<typeof invoice> | null = null;
  let removed = false;
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/admin/parts-costs/internal-invoices**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/internal-invoices') && request.method() === 'GET') return json(route, state ? [state] : []);
    if (path.endsWith('/internal-invoices') && request.method() === 'POST') { state = invoice('draft'); return json(route, { id: invoiceId }, 201); }
    if (path.endsWith('/lines/l2/remove')) { removed = true; state = invoice('draft', true); return json(route, { id: invoiceId }, 201); }
    if (path.endsWith('/send')) { state = invoice('sent', removed); return json(route, { id: invoiceId, number: 'SHOP-2026-0001' }, 201); }
    if (path.endsWith(`/internal-invoices/${invoiceId}`)) return json(route, state);
    return json(route, { message: 'Not mocked' }, 404);
  });
}

test('manager makes a truck invoice for the month, takes a line off, sends it and gets the PDF', async ({ page }) => {
  await mockInvoices(page);
  await devLogin(page, 'manager@lightning.local');
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
  await page.goto('/admin/parts/internal-invoices');
  await expect(page.getByText('No internal invoices yet.')).toBeVisible();
  await page.getByRole('button', { name: 'New invoice' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Make draft' }).click();
  await expect(dialog.getByText('Required')).toBeVisible();
  await dialog.getByLabel('Truck').selectOption({ label: 'Truck 606' });
  await dialog.getByLabel('Month').fill('2026-10');
  await dialog.getByRole('button', { name: 'Make draft' }).click();

  await expect(page.getByRole('heading', { name: 'Draft · Truck 606 · Oct 2026' })).toBeVisible();
  await expect(page.getByTestId('invoice-total')).toHaveText('$2,458.20');
  await expect(page.getByTestId('invoice-available')).toContainText('1 new movements can be added.');
  await page.getByRole('button', { name: 'Take off: Diesel Pro · 7712 · Radiator recore' }).click();
  await expect(page.getByTestId('invoice-total')).toHaveText('$618.20');
  await expect(page.getByTestId('invoice-removed')).toContainText('Radiator recore');

  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText('Invoice SHOP-2026-0001 sent')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SHOP-2026-0001 · Truck 606 · Oct 2026' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take off: FleetPride · 88412093 · Fuel Filter × 2' })).toHaveCount(0);
  await expect(page.locator('#invoice-print')).toContainText('SHOP-2026-0001');
  await expect(page.locator('#invoice-print')).toContainText('$618.20');
});

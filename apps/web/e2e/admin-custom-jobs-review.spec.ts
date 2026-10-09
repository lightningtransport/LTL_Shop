import { expect, test, type Route } from './support/test';
import { devLogin } from './support/dev-login';

// LTR-57 / D25: the Custom Jobs review inbox, with the inbox API mocked.
const group = (name: string, extra: Record<string, unknown> = {}) => ({
  categoryId: '00000000-0000-4000-8000-00000000e001', categoryName: 'Electrical & Starting', nameNorm: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
  displayName: name, otherNames: [], count: 1, lastAddedAt: '2026-10-08T15:00:00.000Z',
  workOrders: [{ id: 'wo1', displayId: 'WO-001', truckNumber: '601' }], descriptions: ['Cable under the dash'],
  status: 'pending_review', mappedTo: null, suggestions: [], ...extra,
});

test('manager ties a group to its catalog Job, adds another, keeps a one-off and undoes it', async ({ page }) => {
  let pending = [
    group('Fix dash light', { count: 2, otherNames: ['fix  DASH light'] }),
    group('lights', { suggestions: [{ catalogJobId: 'cat-lights', displayName: 'Lights', categoryName: 'Electrical & Starting', matchedAlias: null }] }),
    group('Replace mirror bracket'),
  ];
  let reviewed: ReturnType<typeof group>[] = [];
  const reviews: Array<Record<string, unknown>> = [];
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/admin/catalog/custom-jobs**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET') return json(route, url.searchParams.get('status') === 'reviewed' ? reviewed : pending);
    const body = request.postDataJSON() as Record<string, string>;
    const target = [...pending, ...reviewed].find((item) => item.nameNorm === body.nameNorm)!;
    if (url.pathname.endsWith('/undo')) {
      reviewed = reviewed.filter((item) => item !== target);
      pending = [...pending, { ...target, status: 'pending_review', mappedTo: null }];
      return json(route, { updated: target.count }, 201);
    }
    reviews.push(body);
    const catalogJob = body.action === 'map' ? { id: body.catalogJobId, displayName: 'Lights' } : body.action === 'add' ? { id: 'new', displayName: body.displayName } : null;
    pending = pending.filter((item) => item !== target);
    reviewed = [...reviewed, { ...target, status: body.action === 'map' ? 'mapped' : body.action === 'add' ? 'added' : 'kept', mappedTo: catalogJob }];
    return json(route, { updated: target.count, status: 'x', catalogJob, aliasAdded: true }, 201);
  });

  await devLogin(page, 'manager@lightning.local');
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
  await page.goto('/admin/catalog/review');
  await expect(page.getByRole('heading', { name: 'Custom Jobs to review' })).toBeVisible();
  const cards = page.getByTestId('custom-job-group');
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toContainText('Used 2 times');
  await expect(cards.first()).toContainText('Also written: "fix  DASH light"');

  await cards.filter({ hasText: 'lights' }).getByRole('button', { name: 'Tie to Lights (Electrical & Starting)' }).click();
  await expect(page.getByText('Tied 1 Jobs to Lights')).toBeVisible();
  await expect(cards).toHaveCount(2);

  await cards.filter({ hasText: 'Fix dash light' }).getByRole('button', { name: 'Add to catalog…' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Name in the catalog')).toHaveValue('Fix dash light');
  await dialog.getByLabel('Name in the catalog').fill('Dash light repair');
  await dialog.getByRole('button', { name: 'Add to catalog' }).click();
  await expect(page.getByText('Added Dash light repair and tied 2 Jobs')).toBeVisible();

  await cards.filter({ hasText: 'Replace mirror bracket' }).getByRole('button', { name: 'Keep as one-off' }).click();
  await expect(page.getByText('Nothing to review.')).toBeVisible();
  expect(reviews.map((item) => item.action)).toEqual(['map', 'add', 'keep']);

  await page.getByRole('tab', { name: 'Reviewed' }).click();
  await expect(cards.filter({ hasText: 'lights' })).toContainText('Tied to Lights');
  await expect(cards.filter({ hasText: 'Replace mirror bracket' })).toContainText('One-off');
  await cards.filter({ hasText: 'Replace mirror bracket' }).getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Back in the inbox')).toBeVisible();
});

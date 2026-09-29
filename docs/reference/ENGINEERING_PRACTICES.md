# Engineering practices

This guide captures the rules learned while improving Lightning Shop's
production performance. Apply them to new screens and revisit them whenever a
user reports that an interaction feels slow.

The goal is not to remove the API or move business rules into the browser. The
goal is to keep authentication and domain decisions on the server while making
the client avoid unnecessary waits.

## Performance budgets

Use the P75 targets from [PERFORMANCE.md](./PERFORMANCE.md):

- usable application in less than 2 seconds;
- authenticated navigation in less than 1 second;
- warm API responses in less than 500 milliseconds.

For direct interactions such as typing, changing a category, or moving a job
between lists, the visible response should occur in the same frame when the
client already has enough information. Network synchronization can continue in
the background.

## Measure before changing architecture

Measure the complete interaction, not only page load:

1. Record when the user acts and when the UI visibly changes.
2. Inspect the browser request waterfall and `Server-Timing` headers.
3. Compare cold and warm API requests.
4. Measure the database query with `EXPLAIN (ANALYZE, BUFFERS)` when a query is
   suspected.
5. Check runtime, API, pooler, and database regions.

Do not infer that PostgreSQL, React, or the bundle is slow without separating
their timings. In the 2026-08-29 investigation, the affected database queries
completed in about 1 ms; the visible delay came from client-side request
waterfalls and redundant refetches.

Never use production write operations for performance testing. Use local or
staging data. Production read probes must not expose tokens, credentials,
request bodies, or database URLs.

## Design read paths by data shape

### Bounded reference data

Small, slowly changing collections should be loaded once with SWR and filtered
locally. Current examples are:

- trucks;
- job categories and aliases;
- mechanics.

This avoids one request per keystroke or category selection. Use one stable SWR
key for the complete catalog, deduplicate requests, disable focus revalidation
when freshness does not require it, and derive filtered results with
`useMemo`.

Before applying this pattern to a new collection, verify that its payload is
bounded. Reconsider local filtering when the response approaches 250 KB or
1,000 records, or when authorization differs per record.

### Large or volatile data

Keep filtering on the server when a collection is large, changes frequently,
or cannot safely be sent to the client. A remote search must:

- require a useful minimum query length;
- use an indexed predicate confirmed with an execution plan;
- cancel superseded requests with `AbortController`;
- prevent older responses from replacing newer results;
- preserve the previous useful result while revalidating;
- display a scoped loading state rather than block the screen.

A debounce reduces request count but does not make the result instantaneous.
Do not add one as the only response to a latency problem.

## Avoid request waterfalls

Independent requests should start together. Do not require the application
profile to finish loading before starting a screen query when a valid session
token is sufficient.

Authentication state distinguishes:

- `sessionLoading`: whether a valid Supabase session/token is available;
- `profileLoading`: whether `/api/auth/me` has returned application user data.

Screens may load protected data as soon as the token exists. They should wait
for the profile only when rendering or deciding something that genuinely
depends on the application user or role. NestJS must continue validating the
JWT, active user, permissions, and domain rules on every protected request.

## Make mutations feel immediate

Mutation endpoints should return the updated domain DTO. The client should use
that response to populate the detail cache rather than immediately issue a
duplicate GET.

Use an optimistic update when the local result is deterministic and reversible:

1. Save the current cache value as a snapshot.
2. Apply the predicted state immediately.
3. Send the mutation to the API.
4. Replace the prediction with the authoritative API response.
5. Restore the snapshot and show a useful error if the mutation fails.
6. Revalidate related lists in the background.

Do not optimistically predict server-generated results that the client cannot
derive safely. In those cases, keep a small control-level pending state and use
the mutation response as soon as it arrives.

Never weaken validation to support optimistic UI. The database transaction and
API response remain the source of truth.

## Cache and invalidation rules

Keep cache keys centralized in `apps/web/src/lib/shop-data.ts`. Do not invent
slightly different strings for the same resource in individual components.

Current freshness policy:

| Data | Policy |
| --- | --- |
| Trucks, categories, job aliases | Deduplicate for 5 minutes; no focus revalidation |
| Mechanics | Deduplicate for 1 minute |
| Work-order lists | Deduplicate for 10 seconds; refresh every 30 seconds |
| Work-order detail | Deduplicate for 5 seconds; refresh every 15 seconds |
| Repair history | Deduplicate for 30 seconds |

After a mutation, update the affected detail cache from the response and
invalidate only related keys. Background list/history revalidation must not
delay the visible success state. Avoid broad cache invalidation and avoid
blocking on data that is not needed for the current screen.

## Loading and error states

- Render the page shell while profile or screen data is loading.
- Use skeletons or loading indicators local to the affected section.
- Keep existing content visible during background revalidation.
- Disable only controls that could submit a conflicting mutation.
- Show errors near the action that failed.
- Roll back optimistic changes before reporting the failure.

A global `Loading...` screen is appropriate only while the session itself is
unknown and protected routing cannot yet be decided.

## API and database practices

- Keep API functions in the same region as the Supabase pooler/database.
- Use Supavisor transaction mode for serverless runtime connections.
- Reserve `DIRECT_URL` for migrations and administrative tasks.
- Keep transactions short and perform independent reads in parallel.
- Add indexes from measured query plans, not guesses.
- Return the updated DTO from commands that change a work order.
- Preserve `Server-Timing`, request IDs, duration, and cold/warm indicators.
- Never log JWTs, passwords, credential-bearing URLs, sensitive bodies, or
  unfiltered query strings.

## Required verification

### Work Order Job mutation contract

The multi-Category target does not relax mutation safety. Before enabling it:

- require `expectedVersion` and a unique `idempotencyKey` for Add Job;
- lock/re-read the Work Order in the transaction and return 409 for stale state;
- validate the submitted Category is active and that a Catalog Job belongs to
  it; Standard must reject the PM Category;
- deduplicate catalog work by `catalogJobId` and Custom Jobs by normalized
  custom name, not by a display name shared across different catalog entries;
- include Job ID, Category, actor, and before/after-relevant values in the
  Activity Log;
- return the updated DTO and roll back optimistic UI on any failure.

Create Work Order currently protects the one-open-per-Truck rule with a
transaction-scoped advisory lock and verifies idempotency actor/payload. Preserve
that behavior. A rollback may disable new multi-Category writes, but readers
must continue rendering already persisted Jobs from different Categories.

Every change to authentication, data fetching, caching, or work-order
mutations must cover the relevant cases:

- valid, expired, and missing sessions;
- inactive users and role checks;
- first load, reload, navigation, and return from background;
- mutation success and failure/rollback;
- cache invalidation after create, start, pause, resume, add job, complete job,
  and finish work order;
- cold and warm API behavior when infrastructure changes;
- no unexpected 401/500 responses or connection exhaustion;
- no material initial-bundle or layout-shift regression.

Run at minimum:

```bash
npm run lint --workspace=@ltl-shop/api
npm run lint --workspace=@ltl-shop/web
npm run test --workspace=@ltl-shop/api
npm run test --workspace=@ltl-shop/web
npm run build
```

Run Playwright against a seeded local or staging database for user-visible flow
changes. Do not substitute production data for a missing local database.

## Review questions

Before approving a data-flow change, answer:

1. Does this interaction wait for a request it does not actually need?
2. Is a small reference collection being fetched repeatedly?
3. Does a mutation discard an updated response and immediately refetch it?
4. Can the visible state be updated optimistically with a safe rollback?
5. Are invalidations scoped and non-blocking?
6. Are authorization and business rules still enforced by the API?
7. What measurement proves the suspected bottleneck and the improvement?

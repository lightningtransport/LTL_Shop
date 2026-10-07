'use client';

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import {
  AppCapability,
  MechanicMode,
  Priority,
  type TruckDto,
  type WorkOrderSummaryDto,
} from '@ltl-shop/shared';
import { OpenWorkOrderTag } from '@/components/open-work-order-tag';
import { normalizeTruckSearch, rankTruckResults } from '@/lib/truck-search';
import { useAuth } from '@/lib/auth-context';
import { defaultWorkspacePath } from '@/lib/admin-routing';
import { SessionSignInFallback } from '@/components/session-sign-in-fallback';
import { replaceAppLocation } from '@/lib/session-restore';
import { ApiError, apiFetch } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error-message';
import { TruckInformationFields } from '@/components/truck-information-fields';
import { useCategories, useTrucks, useWorkOrders } from '@/lib/shop-data';
import { PmInProgressNotice } from '@/components/pm-in-progress-notice';
import { isWorkOrderRelatedListKey } from '@/lib/swr-cache-keys';
import {
  Button,
  CardListSkeleton,
  EmptyState,
  InlineAlert,
  Input,
  Label,
  LoadFailure,
  PageSkeleton,
  PageHeader,
  WorkspaceNav,
} from '@/components/ui';
import { useShopLocale } from '@/lib/locale-context';
import { statusLabel } from '@/lib/format';

/**
 * "Create PM service" for the PM mechanic (LTR-147: joins or creates the
 * truck's Work Order). A Standard mechanic asks the Shop Manager instead; the
 * Standard create form was removed in LTR-180.
 */
export default function NewWorkOrderPage() {
  const { user, token, sessionLoading, profileLoading, sessionError, retrySession } = useAuth();
  const { messages } = useShopLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { mutate } = useSWRConfig();
  const { data: categoryData, error: categoryError, mutate: mutateCategories } = useCategories(!!token);
  const { data: truckData, error: truckError, mutate: mutateTrucks } = useTrucks(!!token);
  const pmCategory = (categoryData ?? []).find((category) => category.name === 'PM');
  const explicitPm = pathname.startsWith('/mechanic/pm/');
  const explicitStandard = pathname.startsWith('/mechanic/standard/');
  const isPmOnly = !!user?.capabilities.includes(AppCapability.MECHANIC_PM) &&
    !user.capabilities.includes(AppCapability.MECHANIC_STANDARD);
  const mechanicMode = explicitPm || (!explicitStandard && isPmOnly)
    ? MechanicMode.PM
    : MechanicMode.STANDARD;
  const requiredCapability = mechanicMode === MechanicMode.PM
    ? AppCapability.MECHANIC_PM
    : AppCapability.MECHANIC_STANDARD;
  const isPmMechanic = mechanicMode === MechanicMode.PM;
  // Block A (PM5): the PM in progress, so the screen says so before the mechanic picks a truck.
  const { data: pmLists } = useWorkOrders(!!token && isPmMechanic, MechanicMode.PM);
  const runningPm = pmLists?.active[0] ?? null;
  const [query, setQuery] = useState('');
  const [truck, setTruck] = useState<TruckDto | null>(null);
  const [openWo, setOpenWo] = useState<WorkOrderSummaryDto | null>(null);
  const [hasOpenWo, setHasOpenWo] = useState(false);
  // LTR-147: with PM in the Work Plan, Create PM joins the truck's open Work Order.
  const [pmJoin, setPmJoin] = useState<PmJoinPreview | null>(null);
  const pmJoinable = Boolean(pmJoin && ['add', 'join', 'mine'].includes(pmJoin.status));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResult, setActiveResult] = useState(-1);
  const [openWoCheck, setOpenWoCheck] = useState<
    'idle' | 'checking' | 'verified' | 'error'
  >('idle');
  const openWoRequest = useRef(0);

  useEffect(() => {
    if (!sessionLoading && !token && !sessionError) replaceAppLocation('/login', router);
    if (!sessionLoading && token && user && !user.capabilities.includes(requiredCapability)) {
      replaceAppLocation(defaultWorkspacePath(user), router);
    }
  }, [sessionLoading, token, sessionError, user, requiredCapability, router]);

  const { results, isFallback } = useMemo(() => {
    if (!query.trim() || truck) return { results: [], isFallback: false };
    return rankTruckResults(truckData ?? [], query);
  }, [query, truck, truckData]);

  const hasSearchTerm = query.trim().replace(/^#/, '').length > 0;
  const resultsOpen = searchOpen && hasSearchTerm && !truck;
  const otherPmRunning = Boolean(runningPm && pmJoin?.status !== 'mine');
  const createBlocked = busy || hasOpenWo || openWoCheck !== 'verified' || !pmCategory || otherPmRunning;
  const createActionLabel = openWoCheck === 'checking'
    ? messages.checkingTruck
    // Stage PM-4: the button says what will happen.
    : pmJoin?.status === 'mine'
      ? messages.continuePmOn(truck?.truckNumber ?? '')
      : pmJoin?.status === 'add'
        ? messages.addPmTo(pmJoin.displayId)
        : pmJoin?.status === 'join' ? messages.startPmOnWo(pmJoin.displayId) : messages.createPmService;

  useEffect(() => {
    setActiveResult(results.length ? 0 : -1);
  }, [results]);

  async function selectTruck(t: TruckDto) {
    const requestId = ++openWoRequest.current;
    setTruck(t);
    setQuery(t.truckNumber);
    setSearchOpen(false);
    setOpenWo(null);
    setHasOpenWo(false);
    setPmJoin(null);
    setOpenWoCheck('checking');
    setError(null);
    try {
      const open = await apiFetch<
        { exists: false } | { exists: true; workOrder?: WorkOrderSummaryDto; pmJoin?: PmJoinPreview }
      >(`/api/trucks/${t.id}/open-work-order`);
      if (requestId !== openWoRequest.current) return;
      const join = open.exists ? open.pmJoin ?? null : null;
      setPmJoin(join);
      // A joinable Work Order is not a dead end for the PM mechanic.
      setHasOpenWo(open.exists && !(join && ['add', 'join', 'mine'].includes(join.status)));
      if (open.exists && open.workOrder) setOpenWo(open.workOrder);
      setOpenWoCheck('verified');
    } catch {
      if (requestId !== openWoRequest.current) return;
      setOpenWoCheck('error');
      setError(messages.openWorkOrderCheckFailed);
    }
  }

  async function create() {
    if (!truck || openWoCheck !== 'verified' || !pmCategory) {
      setError(messages.selectTruckForPm);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const wo = await apiFetch<{ id: string; pmJob?: { id: string } | null }>('/api/work-orders', {
        method: 'POST',
        body: JSON.stringify({
          truckId: truck.id,
          primaryCategoryId: pmCategory.id,
          priority: Priority.NORMAL,
          mechanicIds: [],
          jobs: [],
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      void mutate(isWorkOrderRelatedListKey);
      router.push(`/work-orders/${wo.id}${wo.pmJob ? '?view=pm' : ''}`, { scroll: true });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && (e.body as { code?: string } | null)?.code === 'PM_ALREADY_IN_PROGRESS') {
        // LTR-95: one running PM per PM mechanic; point to the one in progress.
        const body = e.body as { workOrder?: WorkOrderSummaryDto; runningDisplayId?: string };
        setError(messages.pmAlreadyRunning(body.workOrder?.displayId ?? body.runningDisplayId ?? ''));
      } else if (e instanceof ApiError && e.status === 409) {
        const body = e.body as { workOrder?: WorkOrderSummaryDto };
        if (body.workOrder) setOpenWo(body.workOrder);
        setHasOpenWo(true);
        setError(messages.workOrderOpen(truck.truckNumber));
      } else {
        setError(apiErrorMessage(e, messages, messages.createFailed));
      }
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading && !token) {
    return <NewWorkOrderLoading mode={mechanicMode} label={messages.restoringSession} />;
  }

  if (!token && sessionError) {
    return (
      <NewWorkOrderLoading mode={mechanicMode}>
        <LoadFailure message={sessionError} onRetry={retrySession} retryLabel={messages.retry} />
      </NewWorkOrderLoading>
    );
  }

  if (!token) {
    return <SessionSignInFallback />;
  }

  if (profileLoading || !user) {
    return (
      <NewWorkOrderLoading mode={mechanicMode}>
        {sessionError ? (
            <LoadFailure message={sessionError} onRetry={retrySession} retryLabel={messages.retry} />
        ) : (
          <CardListSkeleton count={2} />
        )}
      </NewWorkOrderLoading>
    );
  }

  if (!user.capabilities.includes(requiredCapability)) {
    const allowedHome = defaultWorkspacePath(user);
    return (
      <div>
        <PageHeader
          className="mb-6"
          title={isPmMechanic ? messages.newPmService : messages.newWorkOrder}
          subtitle={messages.workspaceUnavailable}
          backHref={allowedHome}
        />
        <EmptyState>
          <p>{messages.workspaceUnavailable}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href={allowedHome}>{messages.openAllowedHome}</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  if (!isPmMechanic) {
    return (
      <div>
        <WorkspaceNav mode={mechanicMode} />
        <PageHeader
          className="mb-6"
          title={messages.newWorkOrder}
          subtitle={messages.askManagerToCreateHint}
          backHref={`/mechanic/${mechanicMode}`}
        />
        <EmptyState>{messages.askManagerToCreate}</EmptyState>
      </div>
    );
  }

  const referenceError = categoryError || truckError;
  if (referenceError || !categoryData || !truckData) {
    return (
      <NewWorkOrderLoading mode={mechanicMode}>
        {referenceError ? (
          <LoadFailure
            message={messages.referenceDataLoadError}
            onRetry={() => void Promise.all([mutateCategories(), mutateTrucks()])}
            retryLabel={messages.retry}
          />
        ) : (
          <CardListSkeleton count={2} />
        )}
      </NewWorkOrderLoading>
    );
  }

  return (
    <div className={truck && !hasOpenWo ? 'pb-[calc(6rem+var(--app-safe-bottom))]' : undefined}>
      <WorkspaceNav mode={mechanicMode} />
      <PageHeader
        className="mb-6"
        title={messages.newPmService}
        subtitle={messages.pmServiceHint}
        backHref={`/mechanic/${mechanicMode}`}
      />

      {runningPm && otherPmRunning ? <PmInProgressNotice running={runningPm} className="mb-4" /> : null}

      <section className="card mb-4 space-y-3">
        <Label htmlFor="truck-search">
          {messages.truck}
        </Label>
        <div className="relative">
          <Input
            id="truck-search"
            placeholder={messages.searchTruck}
            value={query}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={resultsOpen}
            aria-controls="truck-search-results"
            aria-activedescendant={
              resultsOpen && activeResult >= 0
                ? `truck-result-${results[activeResult]?.id}`
                : undefined
            }
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (!resultsOpen) return;
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveResult((current) =>
                  Math.min(current + 1, results.length - 1),
                );
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveResult((current) => Math.max(current - 1, 0));
              } else if (event.key === 'Enter' && activeResult >= 0) {
                event.preventDefault();
                const activeTruck = results[activeResult];
                if (activeTruck) void selectTruck(activeTruck);
              } else if (event.key === 'Escape') {
                setSearchOpen(false);
              }
            }}
            onChange={(e) => {
              openWoRequest.current += 1;
              setQuery(e.target.value);
              setTruck(null);
              setOpenWo(null);
              setHasOpenWo(false);
              setOpenWoCheck('idle');
              setSearchOpen(true);
              setError(null);
            }}
          />
          {resultsOpen ? (
            <ul
              id="truck-search-results"
              role="listbox"
              className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-shop-border bg-shop-panel shadow-lg"
            >
              {results.map((t) => (
                <li key={t.id} role="presentation">
                  <Button
                    id={`truck-result-${t.id}`}
                    role="option"
                    aria-selected={results[activeResult]?.id === t.id}
                    variant="ghost"
                    className="w-full justify-start rounded-none px-4 py-3 text-left font-normal hover:bg-shop-accent focus:bg-shop-accent"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void selectTruck(t)}
                  >
                    <span className="min-w-0 flex-1 truncate">#{t.truckNumber} · {t.make} {t.model}</span>
                    {t.openWorkOrder ? <OpenWorkOrderTag label={messages.truckOpenWorkOrder(t.openWorkOrder.displayId)} /> : null}
                  </Button>
                </li>
              ))}
              {isFallback ? (
                <li className="px-4 pt-3 text-xs text-shop-muted" role="status">
                  {messages.truckStartsWithFallback(normalizeTruckSearch(query))}
                </li>
              ) : null}
              {!results.length ? (
                <li className="px-4 py-3 text-sm text-shop-muted" role="option">
                  {messages.noTrucks}
                </li>
              ) : null}
            </ul>
          ) : null}
          <div className="sr-only" aria-live="polite">
            {openWoCheck === 'checking'
              ? messages.checkingOpenWorkOrder
              : resultsOpen
                ? `${messages.truckResults(results.length)}${isFallback ? messages.truckContainsMatchesNote : ''}`
                : ''}
          </div>
        </div>
        {openWoCheck === 'error' && truck ? (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => void selectTruck(truck)}
          >
            {messages.retryWorkOrderCheck}
          </Button>
        ) : null}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="group-title">{messages.truckInformation}</p>
          </div>
          {!truck ? (
            <EmptyState>{messages.selectTruck}</EmptyState>
          ) : (
            <div className="space-y-3">
              <TruckInformationFields truck={truck} locale={messages.locale} />
              <Button asChild variant="secondary" className="w-full">
                <Link href={`/trucks/${truck.id}/history?from=${encodeURIComponent(pathname)}`}>
                  {messages.repairHistory}
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {pmJoin ? (
        <InlineAlert
          className={pmJoinable ? 'mb-4' : 'mb-4 border-[var(--warning)] bg-warning-surface text-warning-foreground'}
        >
          {pmJoin.status === 'add'
            ? messages.pmJoinAdd(pmJoin.displayId)
            : pmJoin.status === 'join'
              ? messages.pmJoinJoin(pmJoin.displayId)
              : pmJoin.status === 'mine'
                ? messages.pmJoinMine(pmJoin.displayId)
                : pmJoin.status === 'taken'
                  ? messages.pmJoinTaken(pmJoin.displayId, pmJoin.assignedMechanicName ?? '—')
                  : messages.pmJoinDone(pmJoin.displayId)}
        </InlineAlert>
      ) : null}

      {openWo && !pmJoin ? (
        <div
          className="mb-4 rounded-2xl border border-[var(--warning)] bg-warning-surface p-4 text-warning-foreground"
          role="alert"
          aria-live="polite"
        >
          <p className="font-semibold">
            {messages.workOrderOpen(truck?.truckNumber ?? '')}
          </p>
          <p className="mt-1 text-sm">
            {messages.workOrderSummary(openWo.displayId, messages.status[openWo.status] ?? statusLabel(openWo.status, messages.status), openWo.jobsCompleted, openWo.jobsTotal)}
          </p>
          <Button asChild className="mt-3 w-full">
            <Link href={`/work-orders/${openWo.id}`}>{messages.openWorkOrder}</Link>
          </Button>
        </div>
      ) : null}

      {hasOpenWo && !openWo && !pmJoin ? (
        <InlineAlert className="mb-4 border-[var(--warning)] bg-warning-surface text-warning-foreground">
          {messages.truckOpenOtherMechanic(truck?.truckNumber ?? '')}
        </InlineAlert>
      ) : null}

      {truck && !hasOpenWo ? (
        <>
          {error ? (
            <InlineAlert className="mb-3">{error}</InlineAlert>
          ) : null}

          <div className="fixed inset-x-4 bottom-[max(1rem,var(--app-safe-bottom))] z-30 mx-auto max-w-[calc(28rem-2rem)] rounded-xl border border-shop-border bg-background/95 p-2 shadow-lg backdrop-blur">
            <Button
              className="w-full"
              disabled={createBlocked}
              onClick={create}
            >
              {createActionLabel}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function NewWorkOrderLoading({
  mode,
  label,
  children,
}: {
  mode: MechanicMode;
  label?: string;
  children?: ReactNode;
}) {
  const { messages } = useShopLocale();
  return (
    <div>
      <WorkspaceNav mode={mode} />
      <PageHeader
        className="mb-6"
        title={mode === MechanicMode.PM ? messages.newPmService : messages.newWorkOrder}
        subtitle={mode === MechanicMode.PM ? messages.pmServiceHint : messages.workOrderHint}
        backHref={`/mechanic/${mode}`}
      />
      {children ?? <PageSkeleton label={label ?? messages.loadingWorkOrderForm} />}
    </div>
  );
}

/** LTR-147: what Create PM will do on a truck with an open Work Order. */
type PmJoinPreview = {
  displayId: string;
  status: 'add' | 'join' | 'mine' | 'taken' | 'done';
  assignedMechanicName: string | null;
};

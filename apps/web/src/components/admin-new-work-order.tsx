'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import {
  AppCapability,
  Priority,
  type TruckDto,
  type WorkOrderSummaryDto,
} from '@ltl-shop/shared';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useActionToast } from './action-toast';
import { adminFaultRecommendationsKey, createAdminWorkOrder } from '@/lib/admin-data';
import type { TruckFaultRecommendationsDto } from '@ltl-shop/shared';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { adminPriorityLabel } from '@/lib/status-chips';
import { useTrucks } from '@/lib/shop-data';
import { OpenWorkOrderTag } from './open-work-order-tag';
import { RequiredNote, focusField } from './parts-costs-form-ui';
import { rankTruckResults } from '@/lib/truck-search';
import { isAdminWorkOrdersListKey, isWorkOrderRelatedListKey } from '@/lib/swr-cache-keys';
import { prependAdminWorkOrderPage, WORK_ORDER_LIST_REVALIDATE } from '@/lib/swr-work-order-cache';
import {
  AdminBackLink,
  PageHeader,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  InlineAlert,
  Input,
  PageSkeleton,
  Select,
  Textarea,
} from './ui';
import { draftKeys, useLocalDraft } from '@/lib/local-draft';

type SelectedTruck = {
  truck: TruckDto;
  openWorkOrder: { id: string; displayId: string } | null;
};

type OpenWorkOrderCheck = 'idle' | 'checking' | 'verified' | 'error';

/**
 * LTR-157 / D13: a Work Order starts with only the truck (plus priority and a
 * note). The mandatory steps (PM, Alignment, Detailing, QC) and their default
 * owners come from Setup → Shop workflow; extra work is added from the Truck
 * after the inspection.
 */
export function AdminNewWorkOrder({
  locale,
  messages,
  preselectTruckId,
}: {
  locale: AdminLocale;
  messages: AdminMessages;
  preselectTruckId?: string;
}) {
  void locale;
  const router = useRouter();
  const { showToast } = useActionToast();
  const { mutate } = useSWRConfig();
  const { user, sessionLoading } = useAuth();
  const canCreateWorkOrder = !!user?.capabilities.includes(AppCapability.WORK_ORDERS_MANAGE);
  const [truckQuery, setTruckQuery] = useState('');
  const [debouncedTruckQuery, setDebouncedTruckQuery] = useState('');
  const [selectedTruck, setSelectedTruck] = useState<SelectedTruck | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResult, setActiveResult] = useState(-1);
  const [priority, setPriority] = useState<Priority>(Priority.NORMAL);
  // LTR-293 §2: the note stays on this device if the page is left or reloaded before Create.
  const [notes, setNotes, clearNotes] = useLocalDraft(draftKeys.newWorkOrderNote('page'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preselectApplied, setPreselectApplied] = useState(false);
  const [openWorkOrderCheck, setOpenWorkOrderCheck] = useState<OpenWorkOrderCheck>('idle');
  const openWorkOrderRequest = useRef(0);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedTruckQuery(truckQuery.trim()), 250);
    return () => window.clearTimeout(handle);
  }, [truckQuery]);

  const { data: truckData, error: truckError, isLoading: trucksLoading } = useTrucks(true);

  const trucks = useMemo(
    () => (debouncedTruckQuery && !selectedTruck
      ? rankTruckResults(truckData ?? [], debouncedTruckQuery).results
      : []),
    [debouncedTruckQuery, selectedTruck, truckData],
  );

  const resultsOpen = searchOpen && Boolean(debouncedTruckQuery) && !selectedTruck;
  const canSubmit = Boolean(selectedTruck)
    && openWorkOrderCheck === 'verified'
    && !selectedTruck?.openWorkOrder
    && !busy;
  // LTR-293 §3: no truck yet is not a reason to grey the button — Create says "Pick a truck" under the search and
  // goes there. It stays off only while saving or when the picked truck is still being checked, could not be
  // checked, or already has an open Work Order (that block has its own message above).
  const [showErrors, setShowErrors] = useState(false);
  const truckMissing = showErrors && !selectedTruck;
  const submitBlocked = busy || (Boolean(selectedTruck) && !canSubmit);

  useEffect(() => {
    setActiveResult(trucks.length ? 0 : -1);
  }, [trucks]);

  const [faultCount, setFaultCount] = useState(0);

  function selectTruck(item: TruckDto) {
    const requestId = ++openWorkOrderRequest.current;
    setSelectedTruck({ truck: item, openWorkOrder: null });
    // D42 / S-6: say how many Samsara faults are waiting; they become Jobs in Add work (D13: the WO starts empty).
    setFaultCount(0);
    void apiFetch<TruckFaultRecommendationsDto>(adminFaultRecommendationsKey(item.id)).then((recommendations) => {
      if (requestId === openWorkOrderRequest.current) setFaultCount(recommendations.items.length);
    }).catch(() => undefined);
    setTruckQuery(item.truckNumber);
    setSearchOpen(false);
    setError(null);
    setOpenWorkOrderCheck('checking');
    void apiFetch<{ exists: false } | { exists: true; workOrder?: WorkOrderSummaryDto }>(
      `/api/trucks/${item.id}/open-work-order`,
    ).then((open) => {
      if (requestId !== openWorkOrderRequest.current) return;
      setSelectedTruck((current) => (
        current?.truck.id === item.id
          ? {
            truck: item,
            openWorkOrder: open.exists && open.workOrder
              ? { id: open.workOrder.id, displayId: open.workOrder.displayId }
              : null,
          }
          : current
      ));
      setOpenWorkOrderCheck('verified');
    }).catch(() => {
      if (requestId !== openWorkOrderRequest.current) return;
      setOpenWorkOrderCheck('error');
    });
  }

  useEffect(() => {
    if (preselectApplied || !preselectTruckId || !truckData?.length) return;
    const match = truckData.find((item) => item.id === preselectTruckId);
    if (!match) return;
    selectTruck(match);
    setPreselectApplied(true);
  }, [preselectApplied, preselectTruckId, truckData]);

  function clearTruck() {
    openWorkOrderRequest.current += 1;
    setSelectedTruck(null);
    setTruckQuery('');
    setSearchOpen(false);
    setOpenWorkOrderCheck('idle');
  }


  async function submit() {
    if (!selectedTruck) {
      setShowErrors(true);
      focusField('admin-truck-search');
      return;
    }
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createAdminWorkOrder({
        truckId: selectedTruck.truck.id,
        priority,
        notes: notes.trim() || undefined,
        jobs: [],
      });
      await mutate(
        isAdminWorkOrdersListKey,
        (current) => prependAdminWorkOrderPage(
          Array.isArray(current) ? current : undefined,
          created,
        ) ?? current,
        { revalidate: true },
      );
      void mutate(isWorkOrderRelatedListKey, undefined, WORK_ORDER_LIST_REVALIDATE);
      clearNotes();
      showToast('success', messages.createWorkOrderSuccess.replace('{id}', created.displayId));
      router.push(`/admin/work-orders/${created.id}`);
    } catch (failure) {
      setBusy(false);
      setError(failure instanceof ApiError && failure.message ? failure.message : messages.createWorkOrderFailed);
    }
  }

  // LTR-164 (#1): no "no permission" flash while the session is still loading.
  if (sessionLoading || !user) return <PageSkeleton label={messages.newWorkOrderTitle} />;

  if (!canCreateWorkOrder) {
    return (
      <div className="flex flex-col gap-5">
        <AdminBackLink href="/admin/work-orders">{messages.backToWorkOrders}</AdminBackLink>
        <EmptyState>{messages.createRequiresManage}</EmptyState>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AdminBackLink href="/admin/work-orders">{messages.backToWorkOrders}</AdminBackLink>
      <PageHeader title={messages.newWorkOrderTitle} subtitle={messages.newWorkOrderSubtitle} />

      <Card>
        <CardHeader>
          <CardTitle>{messages.createStepTruck}</CardTitle>
          <CardDescription>{messages.selectTruckHelp}</CardDescription>
        </CardHeader>
            <CardContent>
              {selectedTruck ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">{messages.selectedTruckLabel}</p>
                    <p className="truncate font-semibold">
                      {selectedTruck.truck.truckNumber} · {selectedTruck.truck.make} {selectedTruck.truck.model}
                    </p>
                    {openWorkOrderCheck === 'checking' ? (
                      <p className="mt-1 text-xs text-muted-foreground" role="status">{messages.checkingOpenWorkOrder}</p>
                    ) : null}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={clearTruck}>{messages.changeTruckAction}</Button>
                </div>
              ) : (
                <div className="relative">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="admin-truck-search">
                    {messages.searchTrucksLabel}
                  </label>
                  <Input
                    id="admin-truck-search"
                    placeholder={messages.searchTruckPlaceholder}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={resultsOpen}
                    aria-controls="admin-truck-search-results"
                    aria-invalid={truckMissing || undefined}
                    aria-describedby={truckMissing ? 'admin-truck-search-error' : undefined}
                    aria-activedescendant={
                      resultsOpen && activeResult >= 0
                        ? `admin-truck-result-${trucks[activeResult]?.id}`
                        : undefined
                    }
                    value={truckQuery}
                    onFocus={() => setSearchOpen(true)}
                    onKeyDown={(event) => {
                      if (!resultsOpen) return;
                      if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setActiveResult((current) => Math.min(current + 1, trucks.length - 1));
                      } else if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        setActiveResult((current) => Math.max(current - 1, 0));
                      } else if (event.key === 'Enter' && activeResult >= 0) {
                        event.preventDefault();
                        const active = trucks[activeResult];
                        if (active) selectTruck(active);
                      } else if (event.key === 'Escape') {
                        setSearchOpen(false);
                      }
                    }}
                    onChange={(event) => {
                      openWorkOrderRequest.current += 1;
                      setTruckQuery(event.target.value);
                      setSelectedTruck(null);
                      setOpenWorkOrderCheck('idle');
                      setSearchOpen(true);
                      setError(null);
                    }}
                  />
                  {resultsOpen ? (
                    <ul
                      id="admin-truck-search-results"
                      role="listbox"
                      className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border bg-popover shadow-lg"
                    >
                      {trucksLoading ? (
                        <li className="px-4 py-3 text-sm text-muted-foreground">{messages.searchingTrucks}</li>
                      ) : truckError ? (
                        <li className="px-4 py-3 text-sm text-destructive-text">{messages.loadError}</li>
                      ) : trucks.length ? trucks.map((item, index) => (
                        <li key={item.id} role="presentation">
                          <Button
                            id={`admin-truck-result-${item.id}`}
                            type="button"
                            role="option"
                            aria-selected={activeResult === index}
                            variant="ghost"
                            // UX-2-007: the keyboard-active row shows the same accent tint as hover.
                            className="w-full justify-start rounded-none px-4 py-3 text-left font-normal aria-selected:bg-accent aria-selected:text-foreground"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectTruck(item)}
                          >
                            <span className="min-w-0 flex-1 truncate">{item.truckNumber} · {item.make} {item.model}</span>
                            {item.openWorkOrder ? <OpenWorkOrderTag label={messages.truckOpenWorkOrder.replace('{displayId}', item.openWorkOrder.displayId)} /> : null}
                          </Button>
                        </li>
                      )) : (
                        <li className="px-4 py-3 text-sm text-muted-foreground">{messages.noTrucksFound}</li>
                      )}
                    </ul>
                  ) : null}
                  <RequiredNote show={truckMissing} id="admin-truck-search-error" messages={messages} text={messages.pcPickTruck} />
                </div>
              )}

              {openWorkOrderCheck === 'error' && selectedTruck ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <InlineAlert className="min-w-0 flex-1">{messages.verifyOpenWorkOrderError}</InlineAlert>
                  <Button type="button" variant="outline" size="sm" onClick={() => selectTruck(selectedTruck.truck)}>
                    {messages.retry}
                  </Button>
                </div>
              ) : null}

              {selectedTruck && faultCount ? (
                <p className="mt-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground" role="status" data-testid="new-wo-faults">
                  {faultCount === 1 ? messages.newWoFaultsWarningOne : fillPlaceholders(messages.newWoFaultsWarning, { count: String(faultCount) })}
                </p>
              ) : null}
              {selectedTruck?.openWorkOrder ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <InlineAlert className="min-w-0 flex-1">{messages.openWoWarning}</InlineAlert>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/work-orders/${selectedTruck.openWorkOrder.id}`}>
                      {messages.openExistingWorkOrder} {selectedTruck.openWorkOrder.displayId}
                    </Link>
                  </Button>
                </div>
              ) : null}
            </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.createDetailsTitle}</CardTitle>
          <CardDescription>{messages.createMandatoryStepsHelp}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{messages.priority}</span>
            <Select aria-label={messages.priority} value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              {Object.values(Priority).map((value) => (
                <option key={value} value={value}>{adminPriorityLabel(value, messages)}</option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-sm font-medium">{messages.notesOptional}</span>
            <Textarea
              aria-label={messages.notesOptional}
              className="min-h-20"
              placeholder={messages.notesPlaceholder}
              value={notes}
              maxLength={2000}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          {error ? <InlineAlert className="sm:col-span-2">{error}</InlineAlert> : null}
        </CardContent>
        <CardFooter className="border-t pt-4">
          <Button type="button" className="w-full sm:ml-auto sm:w-auto" disabled={submitBlocked} onClick={() => void submit()}>
            {busy ? messages.creatingWorkOrder : messages.createWorkOrderSubmit}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { AppCapability } from '@ltl-shop/shared';
import { useSWRConfig } from 'swr';
import { useRouter } from 'next/navigation';
import { useAdminAssignableMechanics } from '@/lib/admin-data';
import type { AdminLocale } from '@/lib/admin-messages';
import { inspectionCopy } from '@/lib/inspection-copy';
import { useTruckInspection } from '@/lib/inspection-data';
import { isYardRelatedListKey } from '@/lib/swr-cache-keys';
import { useActionToast } from './action-toast';
import { useAdminBreadcrumb } from './admin-breadcrumb';
import { InspectionSheet } from './inspection-sheet';

/** D41 / HU-M16: the Manager's inspection sheet — "Trucks › 601 › Inspection", with who can do each new Job. */
export function AdminTruckInspection({ truckId, locale }: { truckId: string; locale: AdminLocale }) {
  const copy = inspectionCopy(locale);
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { showToast } = useActionToast();
  const { data } = useTruckInspection('admin', truckId);
  const truckHref = `/admin/trucks/${truckId}`;
  useAdminBreadcrumb(data ? [
    { label: copy.crumbTrucks, href: '/admin/trucks' },
    { label: data.truck.truckNumber, href: truckHref },
    { label: copy.crumbInspection },
  ] : null);
  const { data: pages } = useAdminAssignableMechanics();
  const standardMechanics = useMemo(
    () => (pages?.flatMap((page) => page.items) ?? []).filter((mechanic) => mechanic.active && mechanic.capabilities.includes(AppCapability.MECHANIC_STANDARD)),
    [pages],
  );
  return (
    <InspectionSheet
      mode="admin"
      truckId={truckId}
      locale={locale}
      doneHref={truckHref}
      standardMechanics={standardMechanics}
      barClassName="app-safe-bottom md:left-[var(--admin-aside)]"
      onSaved={(message) => {
        showToast('success', message);
        void mutate(`/api/admin/trucks/${truckId}`);
        void mutate(isYardRelatedListKey, undefined, { revalidate: true, populateCache: false });
        router.push(truckHref);
      }}
    />
  );
}

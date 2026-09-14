'use client';

import { Suspense } from 'react';
import WorkOrderDetailPage from './detail-client';
import { PageSkeleton } from '@/components/ui';
import { useShopLocale } from '@/lib/locale-context';

function WorkOrderFallback() {
  const { messages } = useShopLocale();
  return <PageSkeleton label={messages.loadingWorkOrder} />;
}

export default function Page() {
  return (
    <Suspense fallback={<WorkOrderFallback />}>
      <WorkOrderDetailPage />
    </Suspense>
  );
}

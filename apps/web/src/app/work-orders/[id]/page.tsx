'use client';

import { Suspense } from 'react';
import WorkOrderDetailPage from './detail-client';
import { PageSkeleton } from '@/components/ui';

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton label="Loading work order" />}>
      <WorkOrderDetailPage />
    </Suspense>
  );
}

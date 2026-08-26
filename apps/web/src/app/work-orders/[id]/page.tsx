'use client';

import { Suspense } from 'react';
import WorkOrderDetailPage from './detail-client';

export default function Page() {
  return (
    <Suspense fallback={<p className="text-shop-muted">Loading…</p>}>
      <WorkOrderDetailPage />
    </Suspense>
  );
}

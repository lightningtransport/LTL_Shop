'use client';

import { Suspense } from 'react';
import { QualityCheckPage } from '@/components/quality-check-page';
import { PageSkeleton } from '@/components/ui';

// Stage QC-2: the tabs live in `?tab=`, so the page reads the search params inside a Suspense boundary.
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton label="Quality Check" />}>
      <QualityCheckPage />
    </Suspense>
  );
}

'use client';

import Link from 'next/link';
import { Button, LoadFailure, ScreenHeader } from '@/components/ui';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;

  return (
    <div>
      <ScreenHeader
        title="Something went wrong"
        subtitle="This screen could not be loaded. Your saved work has not been changed."
      />
      <LoadFailure message="Try loading this screen again." onRetry={reset} retryLabel="Retry screen" />
      <Button asChild variant="secondary" className="mt-3 w-full">
        <Link href="/">Back to Home</Link>
      </Button>
    </div>
  );
}

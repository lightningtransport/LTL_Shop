'use client';

import Link from 'next/link';
import { Button, LoadFailure, PageHeader } from '@/components/ui';
import { useShopLocale } from '@/lib/locale-context';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;
  // LTR-170: the root layout (and its locale provider) still wraps a route error, so it follows the language.
  const { messages } = useShopLocale();

  return (
    <div>
      <PageHeader
        className="mb-6"
        title={messages.errorScreenTitle}
        subtitle={messages.errorScreenSubtitle}
      />
      <LoadFailure message={messages.errorScreenRetryMessage} onRetry={reset} retryLabel={messages.errorScreenRetry} />
      <Button asChild variant="secondary" className="mt-3 w-full">
        <Link href="/">{messages.backToHome}</Link>
      </Button>
    </div>
  );
}
